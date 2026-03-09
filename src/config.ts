import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

export interface ProxyConfig {
  apiKey: string;
  port: number;
  verbose: boolean;
  enableVision: boolean;
}

export function loadConfig(): ProxyConfig {
  // Load from env > .deepseek-proxy.json > defaults
  const configPath = resolve(process.cwd(), '.deepseek-proxy.json');
  let fileConfig: Partial<ProxyConfig> = {};
  if (existsSync(configPath)) {
    fileConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
  }
  return {
    apiKey: process.env.DEEPSEEK_API_KEY || fileConfig.apiKey || '',
    port: Number(process.env.PROXY_PORT || fileConfig.port || 1849),
    verbose: process.env.PROXY_VERBOSE === 'true' || fileConfig.verbose || false,
    enableVision: process.env.ENABLE_VISION === 'true' || fileConfig.enableVision || false,
  };
}