/**
 * In-memory, session-scoped file backup store for the Phase 5 runtime loop.
 *
 * When the apply route writes a set of files, it first captures the prior
 * contents and stores them under a freshly-generated backup id. The id is
 * returned to the caller (editor), who can later POST /api/rollback with it
 * to restore the originals if a fidelity verification fails.
 *
 * Design decisions (Phase 5 runtime scope):
 * - Process-local Map, not persisted. WIGSS is an `npx` dev tool; the
 *   backup only needs to survive long enough for the editor to verify and
 *   decide whether to rollback. Restarting the CLI clears the store.
 * - TTL: 10 minutes. Anything older is considered abandoned and reclaimed
 *   on the next access, keeping memory bounded across long editor sessions.
 * - The store never touches git or the filesystem directly outside of the
 *   restore action. The restore function is injectable so tests can avoid
 *   real I/O.
 */

export interface BackupFile {
  path: string;       // absolute path that was written
  originalContent: string;
}

export interface BackupEntry {
  id: string;
  files: BackupFile[];
  createdAt: number;  // epoch ms
}

export interface BackupStore {
  create(files: BackupFile[]): BackupEntry;
  get(id: string): BackupEntry | null;
  delete(id: string): boolean;
  purgeExpired(nowMs?: number): number;
  /** Test-only: current entry count. */
  size(): number;
}

/**
 * Default TTL (10 minutes). After this, entries are eligible for purge.
 */
export const BACKUP_TTL_MS = 10 * 60 * 1000;

/**
 * Construct a new in-memory backup store. A single default instance is
 * exported for use by the API routes, and tests can create independent
 * instances to avoid cross-test bleed.
 */
export function createBackupStore(ttlMs: number = BACKUP_TTL_MS): BackupStore {
  const entries = new Map<string, BackupEntry>();
  let counter = 0;

  function nextId(): string {
    counter += 1;
    // Mix a monotonically increasing counter with a short random suffix so
    // callers can't accidentally guess another session's id.
    const rand = Math.random().toString(36).slice(2, 10);
    return `bkp_${Date.now().toString(36)}_${counter}_${rand}`;
  }

  function purgeExpired(nowMs: number = Date.now()): number {
    let removed = 0;
    for (const [id, entry] of entries) {
      if (nowMs - entry.createdAt > ttlMs) {
        entries.delete(id);
        removed += 1;
      }
    }
    return removed;
  }

  return {
    create(files: BackupFile[]): BackupEntry {
      purgeExpired();
      const entry: BackupEntry = {
        id: nextId(),
        files: files.map((f) => ({ path: f.path, originalContent: f.originalContent })),
        createdAt: Date.now(),
      };
      entries.set(entry.id, entry);
      return entry;
    },

    get(id: string): BackupEntry | null {
      purgeExpired();
      return entries.get(id) ?? null;
    },

    delete(id: string): boolean {
      return entries.delete(id);
    },

    purgeExpired,

    size(): number {
      return entries.size;
    },
  };
}

/**
 * Default process-wide backup store used by the API routes.
 * Tests should create their own store via `createBackupStore()`.
 */
export const defaultBackupStore: BackupStore = createBackupStore();
