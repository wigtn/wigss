import { describe, it, expect } from 'vitest';
import { createBackupStore, BACKUP_TTL_MS } from '../lib/apply-backup';

describe('apply-backup store', () => {
  it('creates and retrieves an entry with generated id', () => {
    const store = createBackupStore();
    const entry = store.create([
      { path: '/tmp/a.ts', originalContent: 'const a = 1;' },
      { path: '/tmp/b.ts', originalContent: 'const b = 2;' },
    ]);
    expect(entry.id).toMatch(/^bkp_/);
    expect(entry.files).toHaveLength(2);

    const fetched = store.get(entry.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.files[0].path).toBe('/tmp/a.ts');
    expect(fetched!.files[1].originalContent).toBe('const b = 2;');
  });

  it('returns null for an unknown id', () => {
    const store = createBackupStore();
    expect(store.get('bkp_does_not_exist')).toBeNull();
  });

  it('clones file data so later mutations do not leak', () => {
    const store = createBackupStore();
    const files = [{ path: '/tmp/a.ts', originalContent: 'orig' }];
    const entry = store.create(files);
    files[0].originalContent = 'mutated';

    const fetched = store.get(entry.id);
    expect(fetched!.files[0].originalContent).toBe('orig');
  });

  it('deletes an entry on demand', () => {
    const store = createBackupStore();
    const entry = store.create([{ path: '/tmp/a.ts', originalContent: 'a' }]);
    expect(store.delete(entry.id)).toBe(true);
    expect(store.get(entry.id)).toBeNull();
    expect(store.delete(entry.id)).toBe(false);
  });

  it('purges entries older than the TTL', () => {
    const ttl = 100;
    const store = createBackupStore(ttl);
    const entry = store.create([{ path: '/tmp/a.ts', originalContent: 'a' }]);
    expect(store.size()).toBe(1);

    // Simulate "later" by passing a future nowMs
    const purged = store.purgeExpired(Date.now() + ttl + 50);
    expect(purged).toBe(1);
    expect(store.size()).toBe(0);
    expect(store.get(entry.id)).toBeNull();
  });

  it('does not purge entries still within TTL', () => {
    const store = createBackupStore(1000);
    store.create([{ path: '/tmp/a.ts', originalContent: 'a' }]);
    const purged = store.purgeExpired();
    expect(purged).toBe(0);
    expect(store.size()).toBe(1);
  });

  it('exposes a sane default TTL', () => {
    expect(BACKUP_TTL_MS).toBeGreaterThan(60_000);
  });

  it('creates unique ids for rapid successive writes', () => {
    const store = createBackupStore();
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const entry = store.create([{ path: `/tmp/${i}.ts`, originalContent: String(i) }]);
      ids.add(entry.id);
    }
    expect(ids.size).toBe(100);
  });
});
