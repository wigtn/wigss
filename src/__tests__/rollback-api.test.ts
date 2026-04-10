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

describe('POST /api/rollback', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wigss-rollback-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('restores original file contents when given a valid backupId', async () => {
    const filePath = path.join(tmpDir, 'page.tsx');
    await fs.writeFile(filePath, 'MUTATED', 'utf-8');

    const entry = defaultBackupStore.create([
      { path: filePath, originalContent: 'ORIGINAL' },
    ]);

    const res = await POST(mkRequest({ backupId: entry.id }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.restored).toEqual([filePath]);

    const restored = await fs.readFile(filePath, 'utf-8');
    expect(restored).toBe('ORIGINAL');

    // Backup should be consumed
    expect(defaultBackupStore.get(entry.id)).toBeNull();
  });

  it('restores multiple files in a single entry', async () => {
    const fileA = path.join(tmpDir, 'a.tsx');
    const fileB = path.join(tmpDir, 'b.css');
    await fs.writeFile(fileA, 'A_MUTATED', 'utf-8');
    await fs.writeFile(fileB, 'B_MUTATED', 'utf-8');

    const entry = defaultBackupStore.create([
      { path: fileA, originalContent: 'A_ORIG' },
      { path: fileB, originalContent: 'B_ORIG' },
    ]);

    const res = await POST(mkRequest({ backupId: entry.id }));
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.restored).toHaveLength(2);

    expect(await fs.readFile(fileA, 'utf-8')).toBe('A_ORIG');
    expect(await fs.readFile(fileB, 'utf-8')).toBe('B_ORIG');
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
    await fs.writeFile(filePath, 'MUTATED', 'utf-8');
    const entry = defaultBackupStore.create([
      { path: filePath, originalContent: 'ORIGINAL' },
    ]);

    const first = await POST(mkRequest({ backupId: entry.id }));
    expect(first.status).toBe(200);

    const second = await POST(mkRequest({ backupId: entry.id }));
    expect(second.status).toBe(404);
  });
});
