import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import type { CodeDiff } from '@/types';
import { isPathSafe, readSourceFile, writeSourceFile } from '@/lib/file-utils';
import { defaultBackupStore, type BackupFile } from '@/lib/apply-backup';
import { recordEditAttempt } from '@/lib/telemetry';

function applyDiff(content: string, diff: CodeDiff): { ok: true; content: string } | { ok: false; reason: string } {
  const original = diff.original ?? '';
  const modified = diff.modified ?? '';

  if (!original || !modified) {
    return { ok: false, reason: 'Rejected: empty original or modified' };
  }

  // P2(PROD-632): 주소 경로가 실어 보낸 문자 범위. indexOf 재조회 없이 이 오프셋으로
  // 치환하되, 그 자리의 현재 내용이 original 과 다르면 드리프트로 보고 거부한다 —
  // 저장 사이에 파일이 바뀌었다는 뜻이므로 재스캔이 정답이다.
  if (diff.range) {
    const { start, end } = diff.range;
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end > content.length || start >= end) {
      return { ok: false, reason: 'Rejected: range out of bounds' };
    }
    if (content.slice(start, end) !== original) {
      return { ok: false, reason: 'Rejected: drift — range content no longer matches (rescan needed)' };
    }
  }

  // Safety: must contain className or style (CSS-only changes)
  // For .css/.scss files, skip this check (CSS properties don't have className/style)
  const isCssFile = diff.file.endsWith('.css') || diff.file.endsWith('.scss');
  if (!isCssFile) {
    const hasClassName = original.includes('className');
    const hasStyle = original.includes('style');
    if (!hasClassName && !hasStyle) {
      return { ok: false, reason: 'Rejected: diff must modify className or style' };
    }
  }

  // Safety: no JS logic changes (skip for CSS files which don't have JS)
  if (isCssFile) {
    if (diff.range) {
      const { start, end } = diff.range;
      return { ok: true, content: `${content.slice(0, start)}${modified}${content.slice(end)}` };
    }
    // CSS files: just verify the original exists
    if (original.length > 0) {
      const foundIndex = content.indexOf(original);
      if (foundIndex !== -1) {
        const nextContent = `${content.slice(0, foundIndex)}${modified}${content.slice(foundIndex + original.length)}`;
        return { ok: true, content: nextContent };
      }
    }
    return { ok: false, reason: `Cannot find original snippet in CSS file "${diff.file}"` };
  }

  const dangerousPatterns = ['function ', 'const ', 'let ', 'var ', 'return ', 'import ', 'export ', '=>'];
  for (const pattern of dangerousPatterns) {
    const origCount = (original.match(new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    const modCount = (modified.match(new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    if (origCount !== modCount) {
      return { ok: false, reason: `Rejected: JS structure changed (${pattern.trim()})` };
    }
  }

  // Apply: range 가 있으면 오프셋 치환 (P2), 없으면 기존 indexOf (하위 호환 D6)
  if (diff.range) {
    const { start, end } = diff.range;
    return { ok: true, content: `${content.slice(0, start)}${modified}${content.slice(end)}` };
  }
  if (original.length > 0) {
    const foundIndex = content.indexOf(original);
    if (foundIndex !== -1) {
      const nextContent = `${content.slice(0, foundIndex)}${modified}${content.slice(foundIndex + original.length)}`;
      return { ok: true, content: nextContent };
    }
  }

  return { ok: false, reason: `Cannot find original snippet in file "${diff.file}"` };
}

/**
 * 한 파일의 diff 들을 적용 가능한 순서로 정렬한다.
 *
 * range 를 실은 diff 의 오프셋은 전부 **같은 원본**을 기준으로 계산됐다 —
 * generateRefactorResult 는 intent 마다 input.sources 를 다시 읽지 않는다.
 * 앞의 치환으로 길이가 바뀌면 뒤의 오프셋이 어긋나므로, 오프셋 내림차순으로
 * 적용해 각 치환이 자기보다 앞쪽(낮은 오프셋)을 건드리지 않게 한다. 그러면
 * applyDiff 의 드리프트 검사도 원본 기준 그대로 유효하다.
 * range 없는 diff(D6 하위 호환)는 indexOf 재조회라 range 치환이 끝난 뒤 적용한다.
 *
 * 겹치는 range 는 같은 속성을 두 번 고치려는 것이라 어느 쪽이 이겨도 틀리므로
 * 파일째 거부한다.
 */
function orderFileDiffs(
  fileDiffs: CodeDiff[],
): { ok: true; ordered: CodeDiff[] } | { ok: false; reason: string } {
  const ranged = fileDiffs.filter((d) => d.range);
  const unranged = fileDiffs.filter((d) => !d.range);
  ranged.sort((a, b) => b.range!.start - a.range!.start);
  let floor = Number.POSITIVE_INFINITY;
  for (const d of ranged) {
    if (d.range!.end > floor) {
      return { ok: false, reason: 'Rejected: overlapping ranges in the same file' };
    }
    floor = d.range!.start;
  }
  return { ok: true, ordered: [...ranged, ...unranged] };
}

const ATOMIC_SKIP_REASON =
  'Skipped: another diff in the same file was rejected (file-level atomicity)';

/**
 * REST endpoint for applying code changes.
 * Uses POST (not WebSocket) for safety — file modifications require explicit intent.
 *
 * Request body:
 *   { diffs: CodeDiff[], projectPath: string }
 *
 * Response:
 *   { success: true, data: { applied: number, message: string } }
 *   { success: false, error: { code: string, message: string } }
 *
 * 한 파일의 diff 는 원자적으로 적용된다: 하나라도 거부되면 그 파일은 쓰지 않고,
 * 거부 사유와 함께 나머지는 "Skipped" 로 보고한다. 파일 사이는 독립이다.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { diffs: CodeDiff[]; projectPath: string };
    const { diffs } = body;
    let projectPath = typeof body.projectPath === 'string' ? body.projectPath : '';

    // Resolve 'auto' to server's SOURCE_PATH
    if (!projectPath || projectPath === 'auto') {
      projectPath = process.env.SOURCE_PATH || process.cwd();
    }
    if (projectPath && !projectPath.includes('demo-target')) {
      const demoPath = path.join(projectPath, 'demo-target');
      try {
        const fs = await import('fs/promises');
        await fs.access(demoPath);
        projectPath = demoPath;
      } catch { /* use projectPath as-is */ }
    }

    // Validate input
    if (!diffs || !Array.isArray(diffs)) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INVALID_INPUT', message: 'diffs array required' },
        },
        { status: 400 },
      );
    }

    if (!projectPath || typeof projectPath !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INVALID_INPUT', message: 'projectPath string required' },
        },
        { status: 400 },
      );
    }

    const diffsByFile = new Map<string, CodeDiff[]>();
    for (const diff of diffs) {
      const file = typeof diff.file === 'string' ? diff.file.trim() : '';
      if (!file) continue;
      if (!diffsByFile.has(file)) {
        diffsByFile.set(file, []);
      }
      diffsByFile.get(file)!.push(diff);
    }

    const filesChanged: string[] = [];
    const failed: { file: string; reason: string }[] = [];
    const backupFiles: BackupFile[] = [];
    let applied = 0;

    for (const [file, fileDiffs] of diffsByFile.entries()) {
      const absolutePath = path.resolve(projectPath, file);
      if (!isPathSafe(absolutePath, projectPath)) {
        failed.push({ file, reason: 'Unsafe path (path traversal blocked)' });
        continue;
      }

      let originalContent = '';
      try {
        originalContent = await readSourceFile(absolutePath);
      } catch {
        originalContent = '';
      }

      // 파일 단위 원자성: 이 파일의 diff 가 하나라도 거부되면 아무것도 쓰지 않는다.
      // 일부만 적용된 파일은 검증 기대치와 소스가 어긋난 채 남고 롤백 항목도
      // 반쪽이 된다. 거부 사유는 전부 모아 돌려주고, 같은 파일의 나머지 diff 는
      // 적용 가능했더라도 건너뛴 것으로 표시한다.
      const fileFailures: { file: string; reason: string }[] = [];
      const appliedEdits: { original: string; modified: string }[] = [];
      let content = originalContent;

      const plan = orderFileDiffs(fileDiffs);
      if (!plan.ok) {
        fileFailures.push({ file, reason: plan.reason });
      } else {
        for (const diff of plan.ordered) {
          const result = applyDiff(content, diff);
          if (!result.ok) {
            // 거부된 diff 는 content 를 바꾸지 않으므로 뒤의 range 검사는 그대로 유효하다.
            fileFailures.push({ file, reason: result.reason });
            continue;
          }
          if (result.content !== content) {
            content = result.content;
            appliedEdits.push({ original: diff.original, modified: diff.modified });
          }
        }
      }

      if (fileFailures.length > 0) {
        const skipped = fileDiffs.length - fileFailures.length;
        for (let i = 0; i < skipped; i++) {
          fileFailures.push({ file, reason: ATOMIC_SKIP_REASON });
        }
        for (const f of fileFailures) {
          recordEditAttempt({ tier: 'T0', intent: 'style', result: 'fail', failReason: f.reason });
        }
        failed.push(...fileFailures);
        continue;
      }

      if (appliedEdits.length > 0) {
        applied += appliedEdits.length;
        recordEditAttempt({ tier: 'T0', intent: 'style', result: 'pass' });
        // P4(PROD-634): 파일 스냅샷 대신 적용한 편집만 기억한다. 롤백은 역치환이라
        // 사용자의 동시 수정을 덮어쓰지 않는다.
        backupFiles.push({ path: absolutePath, edits: appliedEdits });
        await writeSourceFile(absolutePath, content);
        filesChanged.push(file);
        console.log(`[Apply] Written ${file}: ${appliedEdits.length} diff(s) applied`);
      }
    }

    if (applied === 0 && failed.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'APPLY_FAILED',
            message: 'No diffs were applied',
            details: failed,
          },
        },
        { status: 400 },
      );
    }

    // Register a rollback point for the files that were actually modified.
    // The editor receives the backupId and can POST it to /api/rollback after
    // re-measuring components if fidelity verification detects a mismatch.
    let backupId: string | null = null;
    if (backupFiles.length > 0) {
      const entry = defaultBackupStore.create(backupFiles);
      backupId = entry.id;
    }

    return NextResponse.json({
      success: true,
      data: {
        applied,
        filesChanged,
        failed,
        backupId,
        message: `Applied ${applied} diffs across ${filesChanged.length} file(s)`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : String(error),
        },
      },
      { status: 500 },
    );
  }
}
