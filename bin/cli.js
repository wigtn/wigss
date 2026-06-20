#!/usr/bin/env node

import { program } from 'commander';
import { spawn } from 'child_process';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { homedir } from 'os';

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

/**
 * Claude provider 인증 확인 — Claude Code 구독제 OAuth(~/.claude/.credentials.json)를 우선,
 * 없으면 ANTHROPIC_API_KEY. 둘 다 없으면 경고만 하고 서버는 띄운다(차단하지 않음).
 */
function checkClaudeAuth() {
  const oauth = existsSync(join(homedir(), '.claude', '.credentials.json'));
  const apiKey = !!process.env.ANTHROPIC_API_KEY;
  return { ok: oauth || apiKey, oauth, apiKey };
}

async function main() {
  const auth = checkClaudeAuth();
  const aiLine = auth.oauth
    ? '✓ Claude Code 플랜 (OAuth)'
    : auth.apiKey
      ? '✓ ANTHROPIC_API_KEY'
      : '✗ 인증 없음';

  console.log(`
  ╔══════════════════════════════════════╗
  ║     WIGSS — Style Shaper v0.2.0     ║
  ╠══════════════════════════════════════╣
  ║  Target:  http://localhost:${targetPort.toString().padEnd(10)}║
  ║  Editor:  http://localhost:${wigssPort.toString().padEnd(10)}║
  ║  Source:  ${sourcePath.slice(-29).padEnd(29)}║
  ║  AI:      ${aiLine.padEnd(29)}║
  ╚══════════════════════════════════════╝
  `);

  if (!auth.ok) {
    console.warn('  ⚠ Claude 인증을 찾지 못했습니다.');
    console.warn('    `claude` CLI로 로그인(~/.claude/.credentials.json)하거나 ANTHROPIC_API_KEY를 설정하세요.');
    console.warn('    (서버는 시작하지만 AI 기능 호출 시 오류가 납니다.)\n');
  }

  // Set env vars
  process.env.TARGET_PORT = targetPort;
  process.env.SOURCE_PATH = sourcePath;
  process.env.WIGSS_PORT = wigssPort;

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
