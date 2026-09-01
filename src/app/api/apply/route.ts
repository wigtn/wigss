import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import type { CodeDiff } from '@/types';
import { isPathSafe, readSourceFile, writeSourceFile } from '@/lib/file-utils';
import { defaultBackupStore, type BackupFile } from '@/lib/apply-backup';

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
 * REST endpoint for applying code changes.
 * Uses POST (not WebSocket) for safety — file modifications require explicit intent.
 *
 * Request body:
 *   { diffs: CodeDiff[], projectPath: string }
 *
 * Response:
 *   { success: true, data: { applied: number, message: string } }
 *   { success: false, error: { code: string, message: string } }
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
      let content = originalContent;

      let fileAppliedCount = 0;
      const appliedEdits: { original: string; modified: string }[] = [];
      for (const diff of fileDiffs) {
        const result = applyDiff(content, diff);
        if (!result.ok) {
          failed.push({ file, reason: result.reason });
          continue;
        }
        if (result.content !== content) {
          content = result.content;
          fileAppliedCount++;
          applied++;
          appliedEdits.push({ original: diff.original, modified: diff.modified });
        }
      }

      if (fileAppliedCount > 0) {
        // P4(PROD-634): 파일 스냅샷 대신 적용한 편집만 기억한다. 롤백은 역치환이라
        // 사용자의 동시 수정을 덮어쓰지 않는다.
        backupFiles.push({ path: absolutePath, edits: appliedEdits });
        await writeSourceFile(absolutePath, content);
        filesChanged.push(file);
        console.log(`[Apply] Written ${file}: ${fileAppliedCount} diff(s) applied`);
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
