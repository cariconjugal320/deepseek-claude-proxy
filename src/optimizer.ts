// Tool result truncation limits
const TOOL_RESULT_LIMIT: Record<string, number> = {
  default: 12_000,
  web_fetch: 20_000,
};

/**
 * Truncate oversized tool results to prevent context explosion
 */
function truncateToolResults(messages: any[]): void {
  for (const msg of messages) {
    if (msg.role !== 'user' || !Array.isArray(msg.content)) continue;
    for (const block of msg.content) {
      if (block.type !== 'tool_result') continue;
      const limit = TOOL_RESULT_LIMIT.default;
      if (typeof block.content === 'string' && block.content.length > limit) {
        const original = block.content.length;
        block.content = block.content.slice(0, limit) +
          `\n\n[TRUNCATED — ${original} chars total, showing first ${limit}. Request a specific range if you need more.]`;
      } else if (Array.isArray(block.content)) {
        // Handle array content (mixed text/image blocks)
        let totalLength = 0;
        const truncated: any[] = [];
        for (const item of block.content) {
          if (item.type === 'text' && typeof item.text === 'string') {
            const remaining = limit - totalLength;
            if (remaining <= 0) break;
            if (item.text.length > remaining) {
              truncated.push({
                ...item,
                text: item.text.slice(0, remaining) +
                  `\n\n[TRUNCATED — ${item.text.length} chars total, showing first ${remaining}.]`
              });
              totalLength += remaining;
              break;
            } else {
              truncated.push(item);
              totalLength += item.text.length;
            }
          } else {
            truncated.push(item);
          }
        }
        block.content = truncated;
      }
    }
  }
}

/**
 * Apply DeepSeek-specific optimizations to request body
 * - Smart model routing (reasoner for initial planning, chat for coding)
 * - Output token cap (16k max)
 * - System prompt injection with caching
 */
export function applyDeepSeekOptimizations(body: any, logPrefix: string = '[DeepSeek]'): any {
  if (!body) return body;

  // ── 0. Truncate oversized tool results ────────────────────────────────────
  if (Array.isArray(body.messages)) {
    truncateToolResults(body.messages);
  }

  // ── 1. Smart Model Routing (V3.2-aware) ────────────────────────────────────
  //
  //  deepseek-chat     = DeepSeek-V3.2 non-thinking
  //                      Fast. Has "thinking-in-tool-use" built in.
  //                      Outperforms R1 by 40%+ on SWE-bench (coding agents).
  //                      DEFAULT for all agentic coding turns.
  //
  //  deepseek-reasoner = DeepSeek-V3.2 thinking (CoT trace)
  //                      Slower. Better for complex initial problem decomposition.
  //                      RESERVED for the very first turn of a fresh session
  //                      where there is no tool history yet.
  //
  const msgs: any[] = body.messages ?? [];
  const lastMsg = msgs.at(-1);

  const isToolResultTurn =
    lastMsg?.role === 'user' &&
    Array.isArray(lastMsg?.content) &&
    lastMsg.content.length > 0 &&
    lastMsg.content.every((c: any) => c.type === 'tool_result');

  // "Fresh session" heuristic: ≤2 messages, no tool_use/tool_result anywhere
  const hasToolHistory = msgs.some((m: any) =>
    Array.isArray(m.content) &&
    m.content.some((c: any) => c.type === 'tool_use' || c.type === 'tool_result')
  );
  const isInitialPlanningTurn = msgs.length <= 2 && !hasToolHistory;

  // const selectedModel = isInitialPlanningTurn ? 'deepseek-reasoner' : 'deepseek-chat';
  const selectedModel = 'deepseek-chat'; // Always use chat for now; reasoner is still being evaluated
  body.model = selectedModel;

  if (selectedModel === 'deepseek-chat') {
    body.temperature = 0; // deterministic; ignored by reasoner
  }

  // Budget tokens: prevent runaway CoT on initial planning turns
  // if (selectedModel === 'deepseek-reasoner') {
  //   body.thinking = { type: 'enabled', budget_tokens: 8000 };
  // }

  console.log(`${logPrefix} model → ${selectedModel} (initial-planning: ${isInitialPlanningTurn}, tool-result: ${isToolResultTurn}, history-depth: ${msgs.length})`);

  // ── 2. Output Token Cap ────────────────────────────────────────────────────
  // ANTHROPIC_MAX_TOKENS=128000 is the context *window* — not a sane output
  // limit. Code responses are rarely >2k tokens. Cap at 16k for headroom.
  if (body.max_tokens && body.max_tokens > 16384) {
    console.log(`${logPrefix} capping max_tokens: ${body.max_tokens} → 16384`);
    body.max_tokens = 16384;
  }

  // ── 3. System Prompt Injection + Prefix Caching ───────────────────────────
  // The CLAUDE.md system prompt is large (~600 lines) and identical on every
  // turn. Wrapping it in cache_control: ephemeral lets DeepSeek reuse the KV
  // cache, cutting input-token cost and reducing latency on long sessions.
  // The injected instructions go in a separate uncached block.
  const injection = [
    "STRICT TOKEN BUDGET: You MUST be maximally concise at all times.",
    "Execute ONE tool per turn. Never use multiple tool_use blocks in a single response.",
    "NEVER restate, summarize, or acknowledge tool results — proceed directly to the next action.",
    "NEVER add preamble, commentary, or closing remarks around tool calls.",
    "When reading files, use offset+limit parameters to fetch only the relevant section.",
    "Prefer targeted Grep/Glob searches over reading entire files.",
    "Stop immediately when the task is done. Do not explain what you did.",
  ].join(' ');

  if (body.system) {
    if (typeof body.system === 'string') {
      // Convert to array: cached CLAUDE.md block + uncached injection
      body.system = [
        { type: 'text', text: body.system, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: injection },
      ];
    } else if (Array.isArray(body.system)) {
      // Mark the last existing block as the cache boundary, then append injection
      const last = body.system.length - 1;
      body.system = body.system.map((block: any, i: number) =>
        i === last ? { ...block, cache_control: { type: 'ephemeral' } } : block
      );
      body.system.push({ type: 'text', text: injection });
    }
  } else {
    body.system = injection;
  }

  return body;
}