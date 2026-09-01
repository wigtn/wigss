import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { POST } from '../app/api/rollback/route';
import { NextRequest } from 'next/server';
import { defaultBackupStore } from '../lib/apply-backup';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

function mkRequest(body: unknown): NextRequest {
  return new NextRequest(new URL('http://localhost/api/rollback'), {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

/**
 * v3(P4 · PROD-634): 롤백은 파일 전체 복원이 아니라 적용된 편집의 역치환이다.
 * 실험 3b 가 재현한 데이터 손실(동시 수정 소실)이 이 계약 변경의 이유다.
 */
describe('POST /api/rollback', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wigss-rollback-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  const FILE = `export function Panel({ items }: { items: string[] }) {
  const total = items.length;
  return (
    <div className="flex h-64 w-64 p-4">
      <span>{total}</span>
    </div>
  );
}
`;
  const EDIT = {
    original: 'className="flex h-48 w-64 p-4"',
    modified: 'className="flex h-64 w-64 p-4"',
  };

  it('reverses the applied edit when given a valid backupId', async () => {
    const filePath = path.join(tmpDir, 'page.tsx');
    await fs.writeFile(filePath, FILE, 'utf-8');

    const entry = defaultBackupStore.create([{ path: filePath, edits: [EDIT] }]);

    const res = await POST(mkRequest({ backupId: entry.id }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.restored).toEqual([filePath]);

    const restored = await fs.readFile(filePath, 'utf-8');
    expect(restored).toContain('h-48');

    // Backup should be consumed
    expect(defaultBackupStore.get(entry.id)).toBeNull();
  });

  it('동시 수정 보존: 같은 파일의 다른 줄에 있는 사용자 수정이 살아남는다 (실험 3b)', async () => {
    const filePath = path.join(tmpDir, 'page.tsx');
    const withUserEdit = FILE.replace(
      'const total = items.length;',
      'const total = items.filter(Boolean).length;',
    );
    await fs.writeFile(filePath, withUserEdit, 'utf-8');

    const entry = defaultBackupStore.create([{ path: filePath, edits: [EDIT] }]);
    const res = await POST(mkRequest({ backupId: entry.id }));
    expect(res.status).toBe(200);

    const restored = await fs.readFile(filePath, 'utf-8');
    expect(restored).toContain('items.filter(Boolean)'); // 스냅샷 복원이었다면 소실
    expect(restored).toContain('h-48');
  });

  it('이중 수정 거부: 우리가 쓴 줄이 또 바뀌었으면 409 + 사유, 파일은 그대로 (실험 3b)', async () => {
    const filePath = path.join(tmpDir, 'page.tsx');
    const doubleEdited = FILE.replace('h-64', 'h-72'); // 사용자가 그 줄을 다시 고침
    await fs.writeFile(filePath, doubleEdited, 'utf-8');

    const entry = defaultBackupStore.create([{ path: filePath, edits: [EDIT] }]);
    const res = await POST(mkRequest({ backupId: entry.id }));
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error.code).toBe('ROLLBACK_REFUSED');
    expect(await fs.readFile(filePath, 'utf-8')).toBe(doubleEdited); // 아무것도 안 씀
    // 거부된 롤백은 항목을 소비하지 않는다 — 사용자가 확인 후 재시도 가능
    expect(defaultBackupStore.get(entry.id)).not.toBeNull();
    defaultBackupStore.delete(entry.id);
  });

  it('원자성: 두 파일 중 하나가 거부되면 성공 가능한 쪽도 쓰지 않는다', async () => {
    const okPath = path.join(tmpDir, 'ok.tsx');
    const badPath = path.join(tmpDir, 'bad.tsx');
    await fs.writeFile(okPath, FILE, 'utf-8');
    await fs.writeFile(badPath, FILE.replace('h-64', 'h-72'), 'utf-8');

    const entry = defaultBackupStore.create([
      { path: okPath, edits: [EDIT] },
      { path: badPath, edits: [EDIT] },
    ]);
    const res = await POST(mkRequest({ backupId: entry.id }));
    expect(res.status).toBe(409);

    // ok 파일도 건드리지 않았다
    expect(await fs.readFile(okPath, 'utf-8')).toBe(FILE);
    defaultBackupStore.delete(entry.id);
  });

  it('restores multiple files in a single entry', async () => {
    const fileA = path.join(tmpDir, 'a.tsx');
    const fileB = path.join(tmpDir, 'b.tsx');
    await fs.writeFile(fileA, 'const x = <div className="h-64" />;', 'utf-8');
    await fs.writeFile(fileB, 'const y = <div className="w-80" />;', 'utf-8');

    const entry = defaultBackupStore.create([
      { path: fileA, edits: [{ original: 'className="h-48"', modified: 'className="h-64"' }] },
      { path: fileB, edits: [{ original: 'className="w-64"', modified: 'className="w-80"' }] },
    ]);

    const res = await POST(mkRequest({ backupId: entry.id }));
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.restored).toHaveLength(2);

    expect(await fs.readFile(fileA, 'utf-8')).toContain('h-48');
    expect(await fs.readFile(fileB, 'utf-8')).toContain('w-64');
  });

  it('returns 404 for an unknown backupId', async () => {
    const res = await POST(mkRequest({ backupId: 'bkp_does_not_exist' }));
    const json = await res.json();
    expect(res.status).toBe(404);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('BACKUP_NOT_FOUND');
  });

  it('rejects missing backupId', async () => {
    const res = await POST(mkRequest({}));
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error.code).toBe('INVALID_INPUT');
  });

  it('rejects non-string backupId', async () => {
    const res = await POST(mkRequest({ backupId: 42 }));
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error.code).toBe('INVALID_INPUT');
  });

  it('consumes the backup so a second rollback returns 404', async () => {
    const filePath = path.join(tmpDir, 'page.tsx');
    await fs.writeFile(filePath, FILE, 'utf-8');
    const entry = defaultBackupStore.create([{ path: filePath, edits: [EDIT] }]);

    const first = await POST(mkRequest({ backupId: entry.id }));
    expect(first.status).toBe(200);

    const second = await POST(mkRequest({ backupId: entry.id }));
    expect(second.status).toBe(404);
  });
});
