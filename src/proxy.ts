import express, { Request, Response } from 'express';
import { applyDeepSeekOptimizations } from './optimizer.js';
import { ProxyConfig } from './config.js';

export interface DeepSeekProxyOptions {
  /** Port to listen on (default: 1849) */
  port?: number;
  /** DeepSeek API key (if not provided, will try to get from env/config) */
  apiKey?: string;
  /** Enable verbose logging (default: false) */
  verbose?: boolean;
  /** Enable vision/image analysis (default: false) */
  enableVision?: boolean;
}

export class DeepSeekProxyService {
  private app: express.Application;
  private port: number;
  private apiKey: string | null = null;
  private verbose: boolean;
  private enableVision: boolean;
  private server: any = null;

  constructor(options: DeepSeekProxyOptions = {}) {
    this.port = options.port || 1849;
    this.verbose = options.verbose || false;
    this.enableVision = options.enableVision || false;

    if (options.apiKey) {
      this.apiKey = options.apiKey;
    }

    this.app = express();
    this.app.use(express.json({ limit: '50mb' }));

    // Add CORS headers for all requests
    this.app.use((req: Request, res: Response, next) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, anthropic-version');

      if (req.method === 'OPTIONS') {
        return res.status(200).end();
      }

      next();
    });

    // Health check endpoint
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({
        status: 'ok',
        service: 'deepseek-claude-proxy',
        hasApiKey: !!this.apiKey,
        port: this.port,
        timestamp: new Date().toISOString()
      });
    });

    // Main proxy endpoint - matches /v1/messages and other Anthropic API paths
    this.app.all('/*', async (req: Request, res: Response) => {
      await this.handleProxyRequest(req, res);
    });

    // Error handling middleware
    this.app.use((err: any, req: Request, res: Response, next: any) => {
      console.error('[DeepSeek Proxy] Unhandled error:', err);
      res.status(500).json({
        error: 'Internal proxy error',
        message: err.message,
        timestamp: new Date().toISOString()
      });
    });
  }

  /**
   * Initialize the proxy service
   */
  async initialize(): Promise<void> {
    try {
      // Try to load API key from environment if not already set
      if (!this.apiKey && process.env.DEEPSEEK_API_KEY) {
        this.apiKey = process.env.DEEPSEEK_API_KEY.trim();
        if (this.verbose) console.log('[DeepSeek Proxy] Loaded API key from environment');
      }

      if (!this.apiKey) {
        console.warn('[DeepSeek Proxy] No API key loaded. Proxy will reject requests until key is configured.');
      } else {
        console.log(`[DeepSeek Proxy] API key loaded (${this.apiKey.slice(0, 8)}...)`);
      }

      console.log(`[DeepSeek Proxy] Service initialized, ready to start on port ${this.port}`);
    } catch (error) {
      console.error('[DeepSeek Proxy] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Detect target API based on model name
   */
  private detectTargetApi(model: string): { url: string, provider: 'deepseek' | 'anthropic' } {
    const normalized = (model || '').toLowerCase();

    // 1. Explicit DeepSeek models
    if (normalized.startsWith('deepseek-')) {
      return { url: 'https://api.deepseek.com/anthropic', provider: 'deepseek' };
    }

    // 2. Claude models (sonnet, haiku, opus, etc.)
    // If it looks like Claude, send to Anthropic
    if (normalized.startsWith('claude-') || normalized.includes('sonnet') || normalized.includes('opus')) {
      if (this.verbose) console.log(`[Proxy] Routing to Anthropic for model: ${model}`);
      return { url: 'https://api.anthropic.com', provider: 'anthropic' };
    }

    // 3. Default Fallback (Assume DeepSeek for unknown models to use local key)
    return { url: 'https://api.deepseek.com/anthropic', provider: 'deepseek' };
  }

  /**
   * Handle proxy request
   */
  public async handleProxyRequest(req: Request, res: Response): Promise<any> {
    const subPath = req.path; // usually /v1/messages
    const method = req.method;
    const requestedModel = req.body?.model || 'deepseek-chat';

    // 1. Determine Provider
    const target = this.detectTargetApi(requestedModel);
    const targetUrl = `${target.url}${subPath}`;

    // 2. Prepare Headers & Authentication
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
    };

    if (target.provider === 'deepseek') {
      // CASE A: DeepSeek - Use LOCAL server key
      if (!this.apiKey) {
        return res.status(500).json({ error: 'DeepSeek API key not configured on proxy server' });
      }
      headers['x-api-key'] = this.apiKey;
    } else {
      // CASE B: Anthropic (Claude) - Pass through Client headers
      const clientKey = req.headers['x-api-key'];
      const clientAuth = req.headers['authorization'];

      if (clientKey) {
        headers['x-api-key'] = clientKey as string;
      } else if (clientAuth) {
        headers['authorization'] = clientAuth as string;
      } else {
        return res.status(401).json({ error: 'No authentication provided by client for Anthropic request' });
      }
    }

    // Pass through Beta headers (critical for Claude Prompts Caching)
    if (req.headers['anthropic-beta']) {
      headers['anthropic-beta'] = req.headers['anthropic-beta'] as string;
    }

    // 3. Transform Body
    let transformedBody = req.body;

    // Only parse/modify body if it's a POST request
    if (req.body && method === 'POST') {
      transformedBody = JSON.parse(JSON.stringify(req.body));

      // --- DEEPSEEK SPECIFIC CLEANUP ---
      if (target.provider === 'deepseek') {

        // Fix 1: Remove "Thinking" (Claude 3.7 feature) - DeepSeek crashes on this
        delete transformedBody.thinking;
        delete transformedBody.budget_tokens;

        // Fix 2: Handle Reasoner (R1) vs Chat (V3)
        // If client asks for reasoner, strip temperature (it crashes R1).
        // If client asks for chat, force temperature 0 (coding best practice).
        if (requestedModel === 'deepseek-reasoner') {
          delete transformedBody.temperature;
          delete transformedBody.top_p;
          delete transformedBody.top_k;
        } else {
          // Default to V3 (Chat) if not explicitly R1, to be safe
          transformedBody.model = 'deepseek-chat';
          transformedBody.temperature = 0;
        }

        // Apply DeepSeek optimizations (model routing, token cap, system prompt)
        transformedBody = applyDeepSeekOptimizations(transformedBody, '[Proxy]');
      }
      // --- ANTHROPIC SPECIFIC ---
      else {
        // For Claude, strictly preserve the model name requested by VS Code
        transformedBody.model = requestedModel;
      }
    }

    // 4. Send Request
    const controller = new AbortController();
    // Longer timeout for DeepSeek R1
    const timeoutMs = (target.provider === 'deepseek' && requestedModel === 'deepseek-reasoner') ? 600000 : 120000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      if (this.verbose) {
        console.log(`[Proxy] ${method} ${requestedModel} -> ${target.provider.toUpperCase()}`);
      }

      const upstream = await fetch(targetUrl, {
        method,
        headers,
        body: method === 'POST' ? JSON.stringify(transformedBody) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // 5. Handle Errors
      if (!upstream.ok) {
        const errorText = await upstream.text();
        console.error(`[Proxy] Upstream Error (${upstream.status}):`, errorText);
        return res.status(upstream.status)
           .set('Content-Type', 'application/json')
           .send(errorText);
      }

      // 6. Handle Streaming
      if (req.body?.stream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const reader = (upstream.body as any).getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(decoder.decode(value));
        }
        return res.end();
      }

      // 7. Handle Standard Response
      const data = await upstream.json();
      res.json(data);

    } catch (err: any) {
      clearTimeout(timeoutId);
      console.error('[Proxy] Connection failed:', err.message);
      res.status(502).json({ error: `Proxy connection failed: ${err.message}` });
    }
  }

  /**
   * Start the proxy server
   */
  async start(): Promise<void> {
    if (this.server) {
      console.warn('[DeepSeek Proxy] Server already running');
      return;
    }

    await this.initialize();

    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.port, () => {
        console.log(`[DeepSeek Proxy] Server started on port ${this.port}`);
        console.log(`[DeepSeek Proxy] Health check: http://localhost:${this.port}/health`);
        console.log(`[DeepSeek Proxy] Proxy endpoint: http://localhost:${this.port}/v1/messages`);
        resolve();
      });

      this.server.on('error', (err: any) => {
        console.error(`[DeepSeek Proxy] Failed to start server:`, err);
        reject(err);
      });
    });
  }

  /**
   * Stop the proxy server
   */
  async stop(): Promise<void> {
    if (!this.server) {
      return;
    }

    return new Promise((resolve) => {
      this.server.close(() => {
        console.log('[DeepSeek Proxy] Server stopped');
        this.server = null;
        resolve();
      });
    });
  }

  /**
   * Update API key (useful for runtime configuration)
   */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey.trim();
    if (this.verbose) console.log(`[DeepSeek Proxy] API key updated (${this.apiKey.slice(0, 8)}...)`);
  }

  /**
   * Get current status
   */
  getStatus(): { hasApiKey: boolean; port: number; isRunning: boolean } {
    return {
      hasApiKey: !!this.apiKey,
      port: this.port,
      isRunning: !!this.server
    };
  }
}

/**
 * Create and start a standalone DeepSeek proxy server
 */
export async function startProxy(options: DeepSeekProxyOptions = {}): Promise<DeepSeekProxyService> {
  const proxy = new DeepSeekProxyService(options);
  await proxy.start();
  return proxy;
}