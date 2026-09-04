/**
 * In-memory, session-scoped rollback store.
 *
 * v3(P4 · PROD-634): 파일 전체 스냅샷 → **적용된 편집의 목록**으로 계약 변경.
 *
 * 이전 계약은 파일의 사전 내용을 통째로 보관하고 롤백 때 그대로 덮어썼다.
 * 그 사이 사용자가 같은 파일의 다른 줄을 고쳤다면 그 수정이 사라진다 —
 * 하네스 실험 3b 에서 재현된 데이터 손실 경로다 (스타일 도구가 로직을 되돌림).
 *
 * 새 계약: 우리가 쓴 (original → modified) 쌍만 기억하고, 롤백은 modified 를
 * 찾아 original 로 되돌리는 역치환이다. modified 가 더는 없거나(사용자가 그
 * 줄을 또 고침) 여러 곳이면(모호) 수행하지 않고 사유와 함께 거부한다.
 *
 * 설계 유지 사항:
 * - Process-local Map, not persisted. `npx` dev 도구에는 충분하다.
 * - TTL 10분. 오래된 항목은 다음 접근 때 회수된다.
 * - 성공한 롤백만 항목을 소비한다. 거부된 롤백은 항목을 남겨 재시도를 허용한다.
 */

export interface AppliedEdit {
  /** 치환 전 원문 조각 (속성 전체 등 가드가 통과한 그 텍스트) */
  original: string;
  /** 우리가 써 넣은 조각 — 롤백은 이것을 찾아 original 로 되돌린다 */
  modified: string;
}

export interface BackupFile {
  /** 절대 경로 */
  path: string;
  /** 이 파일에 적용된 편집들 (적용 순서대로) */
  edits: AppliedEdit[];
}

export interface BackupEntry {
  id: string;
  files: BackupFile[];
  createdAt: number; // epoch ms
}

export interface BackupStore {
  create(files: BackupFile[]): BackupEntry;
  get(id: string): BackupEntry | null;
  delete(id: string): boolean;
  purgeExpired(nowMs?: number): number;
  /** Test-only: current entry count. */
  size(): number;
}

/** Default TTL (10 minutes). After this, entries are eligible for purge. */
export const BACKUP_TTL_MS = 10 * 60 * 1000;

export function createBackupStore(ttlMs: number = BACKUP_TTL_MS): BackupStore {
  const entries = new Map<string, BackupEntry>();
  let counter = 0;

  function nextId(): string {
    counter += 1;
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
        files: files.map((f) => ({
          path: f.path,
          edits: f.edits.map((e) => ({ original: e.original, modified: e.modified })),
        })),
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

export type RollbackFailure = {
  path: string;
  reason: string;
};

/**
 * 한 파일의 현재 내용에 역치환을 적용한다 (순수 함수 — 라우트와 테스트가 공유).
 * 모든 편집을 되돌릴 수 있을 때만 새 내용을 돌려주고, 아니면 사유를 돌려준다.
 */
export function revertEdits(
  content: string,
  edits: AppliedEdit[],
): { ok: true; content: string } | { ok: false; reason: string } {
  let next = content;
  // 적용의 역순으로 되돌린다
  for (let i = edits.length - 1; i >= 0; i--) {
    const { original, modified } = edits[i];
    const occurrences = next.split(modified).length - 1;
    if (occurrences === 0) {
      return {
        ok: false,
        reason: '우리가 쓴 내용이 이미 수정되어 되돌릴 수 없음 — 파일을 직접 확인하세요',
      };
    }
    if (occurrences > 1) {
      return { ok: false, reason: '되돌릴 대상이 여러 곳에 있어 모호함' };
    }
    next = next.replace(modified, original);
  }
  return { ok: true, content: next };
}

/** Default process-wide backup store used by the API routes. */
/**
 * 프로세스 전역 싱글턴 — 반드시 globalThis 에 고정한다.
 * Next dev 는 라우트 핸들러를 별도 번들로 컴파일하므로 모듈 스코프 싱글턴은
 * /api/apply 와 /api/rollback 이 서로 다른 인스턴스를 보게 된다 (실측:
 * apply 가 만든 backupId 를 rollback 이 404 로 모름 — 캔버스 E2E 가 적발).
 */
const g = globalThis as typeof globalThis & { __wigssBackupStore?: BackupStore };
export const defaultBackupStore: BackupStore = (g.__wigssBackupStore ??= createBackupStore());
