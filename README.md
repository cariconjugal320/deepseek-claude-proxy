# deepseek-claude-proxy — Claude Code at DeepSeek prices

**Run Claude Code with DeepSeek's API — same experience, ~50x lower cost**

## One-line pitch

Replace Anthropic's $15/million tokens with DeepSeek's $0.30/million tokens while keeping the exact same Claude Code workflow.

## Cost Comparison

| Provider | Price per million tokens | Relative Cost |
|----------|--------------------------|---------------|
| Anthropic (Claude 3.5 Sonnet) | ~$15.00 | 50x more expensive |
| **DeepSeek (V3.2)** | **~$0.30** | **Baseline** |

**That's 50x cheaper.** A typical coding session that would cost $1.50 with Anthropic costs just **$0.03** with DeepSeek.

## Quick Start (3 steps)

### 1. Install globally
```bash
npm install -g deepseek-claude-proxy
```

### 2. Run setup wizard
```bash
deepseek-claude-proxy init
```
Follow the prompts to:
- Enter your DeepSeek API key (get one at [platform.deepseek.com](https://platform.deepseek.com/api_keys))
- Configure VSCode settings automatically
- Set up global CLAUDE.md with delegate-first instructions

### 3. Start coding
```bash
deepseek-claude-proxy start
```
Now open VSCode and use Claude Code as usual — all requests route through DeepSeek automatically.

## How It Works

The proxy sits between Claude Code and the AI API:

```
Claude Code (VSCode) → deepseek-claude-proxy (localhost:1849) → DeepSeek API
```

### Smart Model Routing
- **Initial planning turns** → `deepseek-reasoner` (CoT thinking for complex problem decomposition)
- **All other turns** → `deepseek-chat` (fast, deterministic coding with "thinking-in-tool-use")

### Token Optimization
- **Tool results truncated** at 12k characters to prevent context explosion
- **Output capped** at 16k tokens (code responses rarely need more)
- **System prompt caching** with `cache_control: ephemeral` to reduce repeated token costs

### Claude Compatibility
- Preserves all Claude Code features (tools, streaming, images via text descriptions)
- Handles Anthropic API format exactly
- Automatic fallback to real Claude API if you explicitly request Claude models

## Configuration

### Environment Variables
```bash
DEEPSEEK_API_KEY=sk-...          # Your DeepSeek API key
PROXY_PORT=1849                  # Port to listen on (default: 1849)
PROXY_VERBOSE=true               # Enable verbose logging
ENABLE_VISION=false              # Enable image analysis (experimental)
```

### Config File
Create `.deepseek-proxy.json` in your project directory:
```json
{
  "apiKey": "sk-...",
  "port": 1849,
  "verbose": false,
  "enableVision": false
}
```

### CLI Commands
```bash
# Start proxy server
deepseek-claude-proxy start --port 1849 --key sk-...

# Check status
deepseek-claude-proxy status

# Set API key
deepseek-claude-proxy config set-key sk-...

# Show current config
deepseek-claude-proxy config show
```

## VSCode Integration

Add to your VSCode `settings.json`:
```json
{
  "claudeCode.environmentVariables": [
    {
      "name": "ANTHROPIC_BASE_URL",
      "value": "http://localhost:1849"
    },
    {
      "name": "ANTHROPIC_DEFAULT_HAIKU_MODEL",
      "value": "deepseek-chat"
    },
    {
      "name": "CLAUDE_CODE_SUBAGENT_MODEL",
      "value": "deepseek-chat"
    }
  ]
}
```

Or let the setup wizard do it for you:
```bash
deepseek-claude-proxy init
```

## Stretching the $20 Claude Pro Subscription

Claude Pro ($20/month) has a rate limit window that resets periodically. In a normal session, every tool call, every file read, every code generation turn burns Anthropic tokens — and long sessions hit the rate limit fast.

This proxy changes that by shifting work to subagents.

When Claude Code uses the Agent tool, it spawns background subprocesses to handle tasks in parallel. With this proxy configured, those subagents inherit the same `ANTHROPIC_BASE_URL` environment variable and route through DeepSeek — not Anthropic. The main Claude session (your orchestrator) handles high-level reasoning and delegation. The subagents handle the implementation work at DeepSeek prices.

In practice:
- A 2-hour session that would normally exhaust your Claude Pro rate limit might only consume a fraction of it, because most of the token-heavy work (reading files, writing code, running searches) is done by DeepSeek subagents
- The rate limit window stretches from an hour or less to lasting most of the day
- The cost per task drops to near-zero on the DeepSeek side

The included `CLAUDE.md` template reinforces this by instructing Claude to delegate aggressively — use the Agent tool for anything touching more than one file, run multiple subagents in parallel, and reserve direct execution only for single atomic actions.

The result is that your $20 subscription covers strategic orchestration while DeepSeek handles the labour.

## CLAUDE.md Optimization

The proxy includes a pre-configured `CLAUDE.md` template with:

### Delegate-First Architecture
- **Use Agent tool for all non-trivial work**
- Parallel subagent dispatch (Explore, Executor, Custodian)
- Integration completeness checking

### DeepSeek-Specific Guidance
- Model routing strategy
- Token budget awareness
- Tool usage patterns optimized for DeepSeek

### Cost Consciousness
- Aggressive parallelization (subagents are cheap!)
- File reading with offset/limit
- Targeted searches over full-file reads

## Troubleshooting

### "No API key configured"
```bash
# Set API key via environment variable
export DEEPSEEK_API_KEY=sk-...

# Or via config file
deepseek-claude-proxy config set-key sk-...
```

### Proxy won't start (port in use)
```bash
# Use a different port
deepseek-claude-proxy start --port 1850

# Or find what's using port 1849
lsof -i :1849
```

### Claude Code not connecting
1. Verify proxy is running: `deepseek-claude-proxy status`
2. Check VSCode settings match proxy port
3. Try health endpoint: `curl http://localhost:1849/health`

## Programmatic Usage

```javascript
import { startProxy } from 'deepseek-claude-proxy';

const proxy = await startProxy({
  port: 1849,
  apiKey: 'sk-...',
  verbose: true
});

// Proxy runs until stopped
// await proxy.stop();
```

## Development

```bash
# Clone and install
git clone https://github.com/yourusername/deepseek-claude-proxy.git
cd deepseek-claude-proxy
npm install

# Development mode
npm run dev

# Build
npm run build

# Test
npm test
```

## License

MIT — see [LICENSE](LICENSE) file.

## Acknowledgements

- DeepSeek for their excellent and affordable API
- Anthropic for the Claude Code ecosystem

---

**Save 98% on your Claude Code usage while keeping the exact same workflow.**