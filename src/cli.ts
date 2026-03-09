#!/usr/bin/env node

import { Command } from 'commander';
import { startProxy } from './proxy.js';
import { loadConfig } from './config.js';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { homedir } from 'os';

const program = new Command();

program
  .name('deepseek-claude-proxy')
  .description('Run Claude Code with DeepSeek\'s API — same experience, ~50x lower cost')
  .version('0.1.0');

program
  .command('start')
  .description('Start the DeepSeek proxy server')
  .option('-p, --port <port>', 'Port to listen on (default: 1849)', '1849')
  .option('-k, --key <key>', 'DeepSeek API key (or set DEEPSEEK_API_KEY env var)')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('--enable-vision', 'Enable vision/image analysis (experimental)')
  .action(async (options) => {
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║               DeepSeek Claude Proxy Server                    ║
║          Claude Code at DeepSeek prices (~50x cheaper)        ║
╚═══════════════════════════════════════════════════════════════╝
    `);

    const config = loadConfig();

    // Override with CLI options
    const proxyOptions = {
      port: options.port ? parseInt(options.port) : config.port,
      apiKey: options.key || config.apiKey,
      verbose: options.verbose || config.verbose,
      enableVision: options.enableVision || config.enableVision,
    };

    if (!proxyOptions.apiKey) {
      console.error('❌ Error: No API key provided.');
      console.error('   Set DEEPSEEK_API_KEY environment variable or use --key option');
      console.error('   Or run: deepseek-claude-proxy init');
      process.exit(1);
    }

    try {
      const proxy = await startProxy(proxyOptions);

      // Handle graceful shutdown
      const shutdown = async (signal: string) => {
        console.log(`\n[${signal}] Shutting down DeepSeek proxy...`);
        await proxy.stop();
        console.log('DeepSeek proxy stopped gracefully.');
        process.exit(0);
      };

      process.on('SIGTERM', () => shutdown('SIGTERM'));
      process.on('SIGINT', () => shutdown('SIGINT'));

      // Keep the process alive
      process.stdin.resume();

      console.log('✅ DeepSeek proxy server is running and ready');
      console.log(`🔗 Health check: http://localhost:${proxyOptions.port}/health`);
      console.log(`🔗 Proxy endpoint: http://localhost:${proxyOptions.port}/v1/messages`);
      console.log('\nPress Ctrl+C to stop the server\n');

    } catch (error) {
      console.error('❌ Failed to start DeepSeek proxy server:', error);
      process.exit(1);
    }
  });

program
  .command('init')
  .description('Interactive setup wizard')
  .action(async () => {
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║               DeepSeek Claude Proxy Setup                     ║
╚═══════════════════════════════════════════════════════════════╝
    `);

    console.log('This wizard will help you set up the DeepSeek proxy for Claude Code.');
    console.log('You\'ll need a DeepSeek API key from https://platform.deepseek.com/api_keys');
    console.log('');

    // In a real implementation, you would use readline or prompts library
    // For now, we'll just create a config file template
    console.log('To set up manually:');
    console.log('1. Create a file called .deepseek-proxy.json in your project directory:');
    console.log(`
{
  "apiKey": "your-deepseek-api-key-here",
  "port": 1849,
  "verbose": false,
  "enableVision": false
}
    `);
    console.log('2. Or set environment variables:');
    console.log('   DEEPSEEK_API_KEY=your-key-here');
    console.log('   PROXY_PORT=1849');
    console.log('   PROXY_VERBOSE=false');
    console.log('');
    console.log('3. Start the proxy: deepseek-claude-proxy start');
    console.log('');
    console.log('4. Configure VSCode:');
    console.log('   Add to your VSCode settings.json:');
    console.log(`
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
    `);
  });

program
  .command('status')
  .description('Check if proxy is running')
  .action(async () => {
    const config = loadConfig();
    try {
      const response = await fetch(`http://localhost:${config.port}/health`);
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Proxy is running');
        console.log(`   Port: ${data.port}`);
        console.log(`   Has API key: ${data.hasApiKey}`);
        console.log(`   Status: ${data.status}`);
      } else {
        console.log('❌ Proxy is not responding');
      }
    } catch (error) {
      console.log('❌ Proxy is not running');
    }
  });

program
  .command('config')
  .description('Configuration management')
  .addCommand(new Command('set-key')
    .description('Set API key in config file')
    .argument('<key>', 'DeepSeek API key')
    .action((key) => {
      const configPath = resolve(process.cwd(), '.deepseek-proxy.json');
      const config = {
        apiKey: key,
        port: 1849,
        verbose: false,
        enableVision: false
      };
      writeFileSync(configPath, JSON.stringify(config, null, 2));
      console.log(`✅ API key saved to ${configPath}`);
      console.log(`   Key: ${key.slice(0, 8)}...`);
    }))
  .addCommand(new Command('show')
    .description('Show current configuration')
    .action(() => {
      const config = loadConfig();
      console.log('Current configuration:');
      console.log(`  API Key: ${config.apiKey ? config.apiKey.slice(0, 8) + '...' : '(not set)'}`);
      console.log(`  Port: ${config.port}`);
      console.log(`  Verbose: ${config.verbose}`);
      console.log(`  Enable Vision: ${config.enableVision}`);
    }));

program.parse(process.argv);