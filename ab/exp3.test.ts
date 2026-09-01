/**
 * 실험 3 — 저장 1회의 실제 비용, 그리고 롤백 안전성
 *
 * 3a. /api/refactor 의 파일 수집 단계를 실제 프로젝트(wigss/src)에서 실측한다.
 *     A: listSourceFiles + readSourceFile × 최대 50개
 *     B: 주소가 가리키는 파일 1개
 *
 * 3b. 롤백이 사용자의 동시 수정을 덮어쓰는지 검사한다.
 *     A: /api/rollback 은 파일 전체를 원본으로 되돌린다
 *     B: 우리가 쓴 범위만 역치환하고, 그 사이 파일이 바뀌었으면 거부한다
 */
import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdtempSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { listSourceFiles, readSourceFile, isPathSafe } from '@/lib/file-utils';

const PROJECT = join(__dirname, '..');
const REPS = 15;

// ── 3a. 파일 수집 비용 ────────────────────────────────────────────────────

/** /api/refactor 의 수집 로직을 그대로 재현 */
async function collectLikeRefactorApi(projectPath: string) {
  const discovered = await listSourceFiles(projectPath);
  const fallback = discovered
    .filter(
      (f) =>
        f.startsWith('src/') || f.startsWith('app/') || f.endsWith('.tsx') || f.endsWith('.ts') || f.endsWith('.css'),
    )
    .slice(0, 40);
  const target = Array.from(new Set(fallback)).slice(0, 50);
  const sources: { path: string; content: string }[] = [];
  for (const rel of target) {
    const abs = join(projectPath, rel);
    if (!isPathSafe(abs, projectPath)) continue;
    try {
      sources.push({ path: rel, content: await readSourceFile(abs) });
    } catch {
      /* skip */
    }
  }
  return sources;
}

async function collectOne(projectPath: string, rel: string) {
  return [{ path: rel, content: await readSourceFile(join(projectPath, rel)) }];
}

// ── 3b. 롤백 시뮬레이션 ───────────────────────────────────────────────────

const ORIGINAL = `export function Panel({ items }: { items: string[] }) {
  const total = items.length;
  return (
    <div className="flex flex-col h-48 w-64 rounded-lg bg-gray-800 p-4">
      <span>{total}</span>
    </div>
  );
}
`;

/** A: 현행 apply-backup + /api/rollback — 파일 전체 스냅샷을 되돌린다 */
function rollbackA(backupContent: string): { restored: string; refused: false } {
  return { restored: backupContent, refused: false };
}

/**
 * B: 우리가 쓴 범위만 역치환한다.
 * 현재 파일에 "우리가 넣은 문자열"이 정확히 1회 있어야 하고, 없으면 거부한다.
 */
function rollbackB(
  current: string,
  wrote: { original: string; modified: string },
): { restored: string; refused: boolean; reason?: string } {
  const hits = current.split(wrote.modified).length - 1;
  if (hits === 0) {
    return { restored: current, refused: true, reason: '우리가 쓴 내용이 이미 사라졌다 — 롤백 거부' };
  }
  if (hits > 1) {
    return { restored: current, refused: true, reason: '대상이 모호하다 — 롤백 거부' };
  }
  return { restored: current.replace(wrote.modified, wrote.original), refused: false };
}

describe('실험 3 — 저장 비용과 롤백 안전성', () => {
  it('measures collection cost and rollback data loss', async () => {
    const L: string[] = [];
    L.push('# 실험 3 — 저장 1회 비용 · 롤백 안전성\n');
    L.push(`생성: ${new Date().toISOString()}\n`);

    // ── 3a ──
    const probe = await collectLikeRefactorApi(PROJECT);
    const oneRel = probe.find((s) => s.path.endsWith('.tsx'))?.path ?? probe[0].path;

    for (let i = 0; i < 3; i++) {
      await collectLikeRefactorApi(PROJECT);
      await collectOne(PROJECT, oneRel);
    }
    let aMs = 0;
    let bMs = 0;
    let aBytes = 0;
    let bBytes = 0;
    for (let i = 0; i < REPS; i++) {
      const t0 = performance.now();
      const a = await collectLikeRefactorApi(PROJECT);
      aMs += performance.now() - t0;
      aBytes = a.reduce((n, s) => n + s.content.length, 0);

      const t1 = performance.now();
      const b = await collectOne(PROJECT, oneRel);
      bMs += performance.now() - t1;
      bBytes = b.reduce((n, s) => n + s.content.length, 0);
    }
    aMs /= REPS;
    bMs /= REPS;

    L.push('## 3a. 저장 1회의 소스 수집 비용 — 실제 wigss 프로젝트 기준\n');
    L.push(`측정 대상: \`${PROJECT}\` · 반복 ${REPS}회\n`);
    L.push('| 지표 | A (현행 /api/refactor) | B (주소 기반) | 배수 |');
    L.push('|---|---:|---:|---:|');
    L.push(`| 읽은 파일 | ${probe.length}개 | 1개 | ${probe.length}× |`);
    L.push(`| 읽은 바이트 | ${aBytes.toLocaleString()} | ${bBytes.toLocaleString()} | ${(aBytes / bBytes).toFixed(0)}× |`);
    L.push(`| 수집 지연 | ${aMs.toFixed(2)} ms | ${bMs.toFixed(3)} ms | ${(aMs / bMs).toFixed(0)}× |`);
    L.push('');
    L.push(
      `HMR 예산(50~300ms) 대비 A의 수집 단계만으로 ${((aMs / 150) * 100).toFixed(1)}% 를 소비한다 (기준 150ms).`,
    );

    // ── 3b ──
    const dir = mkdtempSync(join(tmpdir(), 'wigss-rollback-'));
    const file = join(dir, 'Panel.tsx');
    writeFileSync(file, ORIGINAL);

    // 1) WIGSS 가 편집한다
    const backup = readFileSync(file, 'utf8'); // A 의 apply-backup: 파일 전체 스냅샷
    const wrote = {
      original: 'className="flex flex-col h-48 w-64 rounded-lg bg-gray-800 p-4"',
      modified: 'className="flex flex-col h-64 w-64 rounded-lg bg-gray-800 p-4"',
    };
    let content = readFileSync(file, 'utf8').replace(wrote.original, wrote.modified);
    writeFileSync(file, content);

    // 2) 사용자가 같은 파일의 다른 줄을 수정한다 (에디터에서)
    const userEdit = { from: 'const total = items.length;', to: 'const total = items.filter(Boolean).length;' };
    content = readFileSync(file, 'utf8').replace(userEdit.from, userEdit.to);
    writeFileSync(file, content);
    const beforeRollback = readFileSync(file, 'utf8');
    expect(beforeRollback).toContain(userEdit.to);

    // 3) 검증 실패 → 롤백
    const ra = rollbackA(backup);
    const rb = rollbackB(beforeRollback, wrote);

    const aKeptUserEdit = ra.restored.includes(userEdit.to);
    const aRevertedStyle = ra.restored.includes(wrote.original);
    const bKeptUserEdit = rb.restored.includes(userEdit.to);
    const bRevertedStyle = rb.restored.includes(wrote.original);

    L.push('\n## 3b. 롤백이 사용자의 동시 수정을 지키는가\n');
    L.push('시나리오: ① WIGSS 가 className 을 수정 → ② 사용자가 같은 파일의 다른 줄을 수정 → ③ 검증 실패로 롤백\n');
    L.push('| 결과 | A (파일 전체 복원) | B (범위 역치환) |');
    L.push('|---|---|---|');
    L.push(`| 스타일 되돌림 | ${aRevertedStyle ? '✅' : '❌'} | ${bRevertedStyle ? '✅' : '❌'} |`);
    L.push(`| **사용자 수정 보존** | ${aKeptUserEdit ? '✅ 보존' : '❌ 소실'} | ${bKeptUserEdit ? '✅ 보존' : '❌ 소실'} |`);
    L.push(`| 거부 여부 | ${ra.refused ? '거부' : '수행'} | ${rb.refused ? `거부 (${rb.reason})` : '수행'} |`);
    L.push('');
    L.push(
      aKeptUserEdit
        ? 'A 도 사용자 수정을 보존했다.'
        : `A 는 사용자 수정을 잃는다. 사라진 줄: \`${userEdit.to}\` — 되돌아간 줄: \`${userEdit.from}\``,
    );

    // 4) 추가 케이스: 사용자가 우리가 쓴 그 줄을 직접 고친 경우
    writeFileSync(file, ORIGINAL);
    const backup2 = readFileSync(file, 'utf8');
    let c2 = ORIGINAL.replace(wrote.original, wrote.modified);
    // 사용자가 그 className 을 또 손댐
    c2 = c2.replace(wrote.modified, 'className="flex flex-col h-72 w-64 rounded-lg bg-gray-800 p-4"');
    writeFileSync(file, c2);
    const ra2 = rollbackA(backup2);
    const rb2 = rollbackB(c2, wrote);
    L.push('\n### 추가 케이스 — 사용자가 우리가 쓴 바로 그 줄을 다시 고쳤을 때\n');
    L.push('| 결과 | A | B |');
    L.push('|---|---|---|');
    L.push(
      `| 사용자의 h-72 보존 | ${ra2.restored.includes('h-72') ? '✅' : '❌ 소실'} | ${rb2.restored.includes('h-72') ? '✅' : '❌ 소실'} |`,
    );
    L.push(`| 동작 | 조용히 덮어씀 | ${rb2.refused ? `거부: ${rb2.reason}` : '수행'} |`);

    rmSync(dir, { recursive: true, force: true });

    writeFileSync(join(__dirname, 'exp3.md'), L.join('\n'));
    writeFileSync(
      join(__dirname, 'exp3.json'),
      JSON.stringify(
        {
          collect: { files: probe.length, aBytes, bBytes, aMs, bMs },
          rollback: { aKeptUserEdit, bKeptUserEdit, aRevertedStyle, bRevertedStyle, bRefused: rb.refused },
        },
        null,
        2,
      ),
    );
    expect(bKeptUserEdit).toBe(true);
  }, 300000);
});
