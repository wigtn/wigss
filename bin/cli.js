#!/usr/bin/env node

import { program } from 'commander';
import { spawn } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

program
  .name('wigss')
  .description('WIGSS (Style Shaper) — visual code refactoring with always-on AI agent')
  .version('0.1.0')
  .option('-p, --port <port>', 'target dev server port', '3000')
  .option('--wigss-port <port>', 'WIGSS editor port', '4000')
  .option('--demo', 'run with built-in demo-target')
  .parse(process.argv);

const opts = program.opts();
const targetPort = opts.port;
const wigssPort = opts.wigssPort;
const sourcePath = process.cwd();

console.log(`
  ╔══════════════════════════════════════╗
  ║     WIGSS — Style Shaper v0.1.0     ║
  ╠══════════════════════════════════════╣
  ║  Target:  http://localhost:${targetPort}      ║
  ║  Editor:  http://localhost:${wigssPort}      ║
  ║  Source:   ${sourcePath.slice(-28).padEnd(28)}║
  ╚══════════════════════════════════════╝
`);

// Set env vars for the Next.js app
process.env.TARGET_PORT = targetPort;
process.env.SOURCE_PATH = sourcePath;
process.env.WIGSS_PORT = wigssPort;

const args = ['next', 'dev', '--port', wigssPort];

if (opts.demo) {
  // Also start demo-target
  const demoProc = spawn('pnpm', ['--filter', 'demo-target', 'dev'], {
    cwd: projectRoot,
    stdio: 'inherit',
  });
  demoProc.on('error', (err) => {
    console.error('Failed to start demo-target:', err.message);
  });
}

const proc = spawn('npx', args, {
  cwd: projectRoot,
  stdio: 'inherit',
  env: { ...process.env },
});

proc.on('close', (code) => {
  process.exit(code ?? 0);
});

// Open browser after short delay
setTimeout(async () => {
  try {
    const openMod = await import('open');
    await openMod.default(`http://localhost:${wigssPort}`);
  } catch {
    console.log(`Open http://localhost:${wigssPort} in your browser`);
  }
}, 3000);
