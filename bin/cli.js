#!/usr/bin/env node

import { program } from 'commander';
import { spawn } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

program
  .name('wigss')
  .description('WIGSS (Style Shaper) — visual code refactoring with always-on AI agent')
  .version('0.1.0')
  .option('-p, --port <port>', 'target dev server port', '3000')
  .option('--wigss-port <port>', 'WIGSS editor port', '4000')
  .option('--key <key>', 'OpenAI API key')
  .option('--demo', 'run with built-in demo-target')
  .parse(process.argv);

const opts = program.opts();
const targetPort = opts.port;
const wigssPort = opts.wigssPort;
const sourcePath = process.cwd();

async function promptForKey() {
  // Check if key is already provided via flag or env
  if (opts.key) return opts.key;
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;

  // Interactive prompt
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    console.log('');
    console.log('  WIGSS requires an OpenAI API key (GPT-4o for analysis and suggestions).');
    console.log('  Get one at: https://platform.openai.com/api-keys');
    console.log('');
    rl.question('  Enter your OpenAI API key: ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  const apiKey = await promptForKey();

  if (!apiKey) {
    console.error('\n  Error: OpenAI API key is required. Use --key <key> or set OPENAI_API_KEY env var.\n');
    process.exit(1);
  }

  console.log(`
  ╔══════════════════════════════════════╗
  ║     WIGSS — Style Shaper v0.1.0     ║
  ╠══════════════════════════════════════╣
  ║  Target:  http://localhost:${targetPort.toString().padEnd(10)}║
  ║  Editor:  http://localhost:${wigssPort.toString().padEnd(10)}║
  ║  Source:  ${sourcePath.slice(-29).padEnd(29)}║
  ║  AI Key:  ✓ Configured               ║
  ╚══════════════════════════════════════╝
  `);

  // Set env vars
  process.env.TARGET_PORT = targetPort;
  process.env.SOURCE_PATH = sourcePath;
  process.env.WIGSS_PORT = wigssPort;
  process.env.OPENAI_API_KEY = apiKey;

  if (opts.demo) {
    const demoProc = spawn('pnpm', ['--filter', 'demo-target', 'dev'], {
      cwd: projectRoot,
      stdio: 'inherit',
    });
    demoProc.on('error', (err) => {
      console.error('Failed to start demo-target:', err.message);
    });
  }

  const proc = spawn('npx', ['next', 'dev', '--port', wigssPort], {
    cwd: projectRoot,
    stdio: 'inherit',
    env: { ...process.env },
  });

  proc.on('close', (code) => {
    process.exit(code ?? 0);
  });

  // Open browser
  setTimeout(async () => {
    try {
      const openMod = await import('open');
      await openMod.default(`http://localhost:${wigssPort}`);
    } catch {
      console.log(`  Open http://localhost:${wigssPort} in your browser`);
    }
  }, 3000);
}

main();
