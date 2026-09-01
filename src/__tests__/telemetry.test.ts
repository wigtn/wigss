import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { recordEditAttempt, telemetryEnabled, telemetryPath } from '../lib/telemetry';

describe('telemetry (PROD-640)', () => {
  let dir: string;
  const saved = { t: process.env.WIGSS_TELEMETRY, p: process.env.WIGSS_TELEMETRY_PATH };

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wigss-telemetry-'));
    process.env.WIGSS_TELEMETRY_PATH = path.join(dir, 'telemetry.jsonl');
    delete process.env.WIGSS_TELEMETRY;
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    if (saved.t === undefined) delete process.env.WIGSS_TELEMETRY;
    else process.env.WIGSS_TELEMETRY = saved.t;
    if (saved.p === undefined) delete process.env.WIGSS_TELEMETRY_PATH;
    else process.env.WIGSS_TELEMETRY_PATH = saved.p;
  });

  it('appends one JSON line per event with the fields the report needs', () => {
    recordEditAttempt({ tier: 'T0', intent: 'style', result: 'pass', breakpoint: 'lg', latencyMs: 12 });
    recordEditAttempt({ tier: 'T1', intent: 'style', result: 'repaired' });
    const lines = fs.readFileSync(telemetryPath(), 'utf8').trim().split('\n');
    expect(lines).toHaveLength(2);
    const first = JSON.parse(lines[0]);
    expect(first.type).toBe('edit_attempt');
    expect(first.tier).toBe('T0');
    expect(first.breakpoint).toBe('lg');
    expect(JSON.parse(lines[1]).result).toBe('repaired');
  });

  it('WIGSS_TELEMETRY=0 turns recording off', () => {
    process.env.WIGSS_TELEMETRY = '0';
    expect(telemetryEnabled()).toBe(false);
    recordEditAttempt({ tier: 'T0', intent: 'style', result: 'pass' });
    expect(fs.existsSync(telemetryPath())).toBe(false);
  });

  it('never records source code content', () => {
    recordEditAttempt({
      tier: 'T0', intent: 'style', result: 'abandon',
      failReason: '주소 해석 실패',
    });
    const line = fs.readFileSync(telemetryPath(), 'utf8');
    expect(line).not.toContain('className=');
  });
});
