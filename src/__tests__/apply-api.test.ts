import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { POST } from '../app/api/apply/route';
import { POST as ROLLBACK } from '../app/api/rollback/route';
import { NextRequest } from 'next/server';
import { defaultBackupStore } from '../lib/apply-backup';
import type { CodeDiff } from '../types';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

function mkRequest(body: unknown): NextRequest {
  return new NextRequest(new URL('http://localhost/api/apply'), {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

/**
 * 같은 파일에 range diff 가 둘 이상일 때의 계약.
 *
 * generateRefactorResult 는 모든 intent 의 range 를 **같은 원본** 기준으로 계산한다.
 * 라우트가 이를 요청 순서대로 적용하면 첫 치환이 길이를 바꾼 뒤 두 번째 range 가
 * 어긋나 드리프트로 거부되거나(길이가 다를 때) 엉뚱한 곳을 바꾼다(우연히 같을 때).
 * 그리고 첫 치환만 적용된 파일이 디스크에 남는다.
 *
 * 계약: range 는 오프셋 내림차순으로 적용하고, 겹치면 거부하며, 한 파일의 diff 는
 * 전부 성공할 때만 쓴다. 파일 사이는 독립이다.
 */
describe('POST /api/apply — multiple ranges in one file', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wigss-apply-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  const FILE = `export function Grid() {
  return (
    <section className="grid grid-cols-3 gap-4">
      <div className="h-48 w-64">a</div>
      <div className="h-48 w-64">b</div>
    </section>
  );
}
`;

  /** nth 번째 original 의 원본 오프셋을 실은 range diff. */
  function rangeDiff(file: string, original: string, modified: string, nth = 0): CodeDiff {
    let start = -1;
    for (let i = 0; i <= nth; i++) {
      start = FILE.indexOf(original, start + 1);
      if (start < 0) throw new Error(`fixture lacks occurrence ${nth} of ${original}`);
    }
    return {
      file,
      original,
      modified,
      lineNumber: 0,
      explanation: 'test',
      strategy: 'tailwind',
      range: { start, end: start + original.length },
    };
  }

  const SECTION = 'className="grid grid-cols-3 gap-4"';
  const SECTION_WIDER = 'className="grid grid-cols-3 gap-[18px]"'; // 앞쪽, 길이가 늘어남
  const CELL = 'className="h-48 w-64"';
  const CELL_TALLER = 'className="h-[442px] w-64"';

  async function writeFixture(name = 'grid.tsx'): Promise<string> {
    const filePath = path.join(tmpDir, name);
    await fs.writeFile(filePath, FILE, 'utf-8');
    return filePath;
  }

  it('applies two ranges when the first change shifts the offsets of the second', async () => {
    const filePath = await writeFixture();
    const before = defaultBackupStore.size();

    const res = await POST(
      mkRequest({
        projectPath: tmpDir,
        diffs: [
          rangeDiff('grid.tsx', SECTION, SECTION_WIDER), // 낮은 오프셋, 6자 길어짐
          rangeDiff('grid.tsx', CELL, CELL_TALLER, 1), // 높은 오프셋: 두 번째 div
        ],
      }),
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.applied).toBe(2);
    expect(json.data.failed).toEqual([]);

    const written = await fs.readFile(filePath, 'utf-8');
    expect(written).toContain(SECTION_WIDER);
    expect(written.split(CELL_TALLER).length - 1).toBe(1);
    expect(written).toContain('<div className="h-48 w-64">a</div>'); // 첫 div 는 그대로
    expect(written).toContain('<div className="h-[442px] w-64">b</div>');

    expect(defaultBackupStore.size()).toBe(before + 1);
    const entry = defaultBackupStore.get(json.data.backupId);
    expect(entry?.files[0].edits).toHaveLength(2);
    defaultBackupStore.delete(json.data.backupId);
  });

  it('is independent of the order the diffs arrive in', async () => {
    const filePath = await writeFixture();

    const res = await POST(
      mkRequest({
        projectPath: tmpDir,
        diffs: [
          rangeDiff('grid.tsx', CELL, CELL_TALLER, 1),
          rangeDiff('grid.tsx', SECTION, SECTION_WIDER),
        ],
      }),
    );
    const json = await res.json();
    expect(json.data.applied).toBe(2);

    const written = await fs.readFile(filePath, 'utf-8');
    expect(written).toBe(
      FILE.replace(SECTION, SECTION_WIDER).replace(
        '<div className="h-48 w-64">b</div>',
        '<div className="h-[442px] w-64">b</div>',
      ),
    );
    defaultBackupStore.delete(json.data.backupId);
  });

  it('file-level atomicity: one rejected diff leaves the file untouched and reports the rest as skipped', async () => {
    const filePath = await writeFixture();
    const before = defaultBackupStore.size();

    const drifted = rangeDiff('grid.tsx', CELL, CELL_TALLER, 1);
    drifted.original = 'className="h-40 w-64"'; // 파일에는 h-48 — 저장 사이에 바뀐 것처럼

    const res = await POST(
      mkRequest({
        projectPath: tmpDir,
        diffs: [rangeDiff('grid.tsx', SECTION, SECTION_WIDER), drifted],
      }),
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.code).toBe('APPLY_FAILED');
    expect(json.error.details).toHaveLength(2);
    const reasons = json.error.details.map((d: { reason: string }) => d.reason);
    expect(reasons.some((r: string) => r.includes('drift'))).toBe(true);
    expect(reasons.some((r: string) => r.startsWith('Skipped'))).toBe(true);

    expect(await fs.readFile(filePath, 'utf-8')).toBe(FILE); // 적용 가능했던 쪽도 안 씀
    expect(defaultBackupStore.size()).toBe(before); // 롤백 항목도 없음
  });

  it('rejects overlapping ranges instead of letting one silently win', async () => {
    const filePath = await writeFixture();

    const res = await POST(
      mkRequest({
        projectPath: tmpDir,
        diffs: [
          rangeDiff('grid.tsx', CELL, CELL_TALLER, 0),
          rangeDiff('grid.tsx', CELL, 'className="h-56 w-64"', 0), // 같은 속성을 두 번
        ],
      }),
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    const reasons = json.error.details.map((d: { reason: string }) => d.reason);
    expect(reasons.some((r: string) => r.includes('overlapping'))).toBe(true);
    expect(await fs.readFile(filePath, 'utf-8')).toBe(FILE);
  });

  it('applies range-less legacy diffs after the ranged ones on the same file', async () => {
    const filePath = await writeFixture();

    const legacy: CodeDiff = {
      file: 'grid.tsx',
      original: CELL,
      modified: 'className="h-56 w-64"',
      lineNumber: 0,
      explanation: 'test',
      strategy: 'tailwind',
    }; // range 없음 → indexOf 는 첫 번째 div 를 잡는다

    const res = await POST(
      mkRequest({
        projectPath: tmpDir,
        diffs: [legacy, rangeDiff('grid.tsx', SECTION, SECTION_WIDER)],
      }),
    );
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.applied).toBe(2);

    const written = await fs.readFile(filePath, 'utf-8');
    expect(written).toContain(SECTION_WIDER);
    expect(written).toContain('<div className="h-56 w-64">a</div>');
    expect(written).toContain('<div className="h-48 w-64">b</div>');
    defaultBackupStore.delete(json.data.backupId);
  });

  it('atomicity is per file: a rejected file does not block another file', async () => {
    const okPath = await writeFixture('ok.tsx');
    const badPath = await writeFixture('bad.tsx');

    const drifted = rangeDiff('bad.tsx', CELL, CELL_TALLER, 1);
    drifted.original = 'className="h-40 w-64"';

    const res = await POST(
      mkRequest({
        projectPath: tmpDir,
        diffs: [rangeDiff('ok.tsx', SECTION, SECTION_WIDER), drifted],
      }),
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.applied).toBe(1);
    expect(json.data.filesChanged).toEqual(['ok.tsx']);
    expect(json.data.failed).toHaveLength(1);
    expect(json.data.failed[0].file).toBe('bad.tsx');

    expect(await fs.readFile(okPath, 'utf-8')).toContain(SECTION_WIDER);
    expect(await fs.readFile(badPath, 'utf-8')).toBe(FILE);
    defaultBackupStore.delete(json.data.backupId);
  });

  it('rollback reverses every edit of a multi-range apply', async () => {
    const filePath = await writeFixture();

    const applied = await POST(
      mkRequest({
        projectPath: tmpDir,
        diffs: [
          rangeDiff('grid.tsx', SECTION, SECTION_WIDER),
          rangeDiff('grid.tsx', CELL, CELL_TALLER, 1),
        ],
      }),
    );
    const { backupId } = (await applied.json()).data;
    expect(await fs.readFile(filePath, 'utf-8')).not.toBe(FILE);

    const rolled = await ROLLBACK(
      new NextRequest(new URL('http://localhost/api/rollback'), {
        method: 'POST',
        body: JSON.stringify({ backupId }),
        headers: { 'content-type': 'application/json' },
      }),
    );
    expect(rolled.status).toBe(200);
    expect(await fs.readFile(filePath, 'utf-8')).toBe(FILE);
  });
});
