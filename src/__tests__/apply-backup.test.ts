import { describe, it, expect } from 'vitest';
import { createBackupStore, revertEdits, BACKUP_TTL_MS } from '../lib/apply-backup';

/**
 * v3(P4 · PROD-634): 스토어 계약이 파일 스냅샷 → 적용된 편집 목록으로 바뀌었다.
 * 스냅샷 복원은 사용자의 동시 수정을 덮어썼다 (하네스 실험 3b — 데이터 손실 재현).
 */
describe('apply-backup store', () => {
  const EDIT = { original: 'className="h-48"', modified: 'className="h-64"' };

  it('creates and retrieves an entry with generated id', () => {
    const store = createBackupStore();
    const entry = store.create([
      { path: '/tmp/a.ts', edits: [EDIT] },
      { path: '/tmp/b.ts', edits: [{ original: 'w-64', modified: 'w-80' }] },
    ]);
    expect(entry.id).toMatch(/^bkp_/);
    expect(entry.files).toHaveLength(2);

    const fetched = store.get(entry.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.files[0].path).toBe('/tmp/a.ts');
    expect(fetched!.files[1].edits[0].modified).toBe('w-80');
  });

  it('returns null for an unknown id', () => {
    const store = createBackupStore();
    expect(store.get('bkp_does_not_exist')).toBeNull();
  });

  it('clones edit data so later mutations do not leak', () => {
    const store = createBackupStore();
    const files = [{ path: '/tmp/a.ts', edits: [{ ...EDIT }] }];
    const entry = store.create(files);
    files[0].edits[0].modified = 'mutated';

    const fetched = store.get(entry.id);
    expect(fetched!.files[0].edits[0].modified).toBe('className="h-64"');
  });

  it('deletes an entry on demand', () => {
    const store = createBackupStore();
    const entry = store.create([{ path: '/tmp/a.ts', edits: [EDIT] }]);
    expect(store.delete(entry.id)).toBe(true);
    expect(store.get(entry.id)).toBeNull();
    expect(store.delete(entry.id)).toBe(false);
  });

  it('purges entries older than the TTL', () => {
    const ttl = 100;
    const store = createBackupStore(ttl);
    const entry = store.create([{ path: '/tmp/a.ts', edits: [EDIT] }]);
    expect(store.size()).toBe(1);

    const purged = store.purgeExpired(Date.now() + ttl + 50);
    expect(purged).toBe(1);
    expect(store.size()).toBe(0);
    expect(store.get(entry.id)).toBeNull();
  });

  it('does not purge entries still within TTL', () => {
    const store = createBackupStore(1000);
    store.create([{ path: '/tmp/a.ts', edits: [EDIT] }]);
    expect(store.purgeExpired()).toBe(0);
    expect(store.size()).toBe(1);
  });

  it('exports a sane default TTL', () => {
    expect(BACKUP_TTL_MS).toBe(10 * 60 * 1000);
  });
});

describe('revertEdits — 역치환 (실험 3b 를 유닛으로)', () => {
  const FILE = `export function Panel({ items }: { items: string[] }) {
  const total = items.length;
  return (
    <div className="flex flex-col h-64 w-64 rounded-lg p-4">
      <span>{total}</span>
    </div>
  );
}
`;
  const EDIT = {
    original: 'className="flex flex-col h-48 w-64 rounded-lg p-4"',
    modified: 'className="flex flex-col h-64 w-64 rounded-lg p-4"',
  };

  it('reverts the applied edit and nothing else', () => {
    const r = revertEdits(FILE, [EDIT]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.content).toContain('h-48');
      expect(r.content).toContain('const total = items.length;');
    }
  });

  it('동시 수정 보존: 사용자가 다른 줄을 고쳤어도 그 수정은 남는다', () => {
    const withUserEdit = FILE.replace(
      'const total = items.length;',
      'const total = items.filter(Boolean).length;',
    );
    const r = revertEdits(withUserEdit, [EDIT]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.content).toContain('items.filter(Boolean)'); // 스냅샷 복원이었다면 소실됐다
      expect(r.content).toContain('h-48'); // 스타일은 되돌아감
    }
  });

  it('이중 수정 거부: 우리가 쓴 줄을 사용자가 또 고쳤으면 수행하지 않는다', () => {
    const doubleEdited = FILE.replace('h-64', 'h-72');
    const r = revertEdits(doubleEdited, [EDIT]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('되돌릴 수 없음');
  });

  it('모호 거부: modified 가 여러 곳이면 수행하지 않는다', () => {
    const dup = FILE + '\n' + `<div className="flex flex-col h-64 w-64 rounded-lg p-4" />;`;
    const r = revertEdits(dup, [EDIT]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('모호');
  });

  it('여러 편집은 적용의 역순으로 되돌린다', () => {
    const content = 'a B c D e';
    const r = revertEdits(content, [
      { original: 'b', modified: 'B' },
      { original: 'd', modified: 'D' },
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.content).toBe('a b c d e');
  });
});
