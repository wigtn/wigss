import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import type { CodeDiff } from '@/types';
import { isPathSafe, readSourceFile, writeSourceFile } from '@/lib/file-utils';

function applyDiff(content: string, diff: CodeDiff): { ok: true; content: string } | { ok: false; reason: string } {
  const original = diff.original ?? '';
  const modified = diff.modified ?? '';

  if (!original || !modified) {
    return { ok: false, reason: 'Rejected: empty original or modified' };
  }

  // CSS files are exempt from line count check (@media block creation adds lines)
  const isCssFile = diff.file.endsWith('.css') || diff.file.endsWith('.scss');

  // Safety: line count must match for non-CSS files (no structural changes)
  if (!isCssFile) {
    const origLines = original.split('\n').length;
    const modLines = modified.split('\n').length;
    if (origLines !== modLines) {
      return { ok: false, reason: `Rejected: line count changed (${origLines}→${modLines})` };
    }
  }
  if (!isCssFile) {
    const hasClassName = original.includes('className');
    const hasStyle = original.includes('style');
    if (!hasClassName && !hasStyle) {
      return { ok: false, reason: 'Rejected: diff must modify className or style' };
    }
  }

  // Safety: no JS logic changes (skip for CSS files which don't have JS)
  if (isCssFile) {
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

  // Apply: find and replace
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
    let applied = 0;

    for (const [file, fileDiffs] of diffsByFile.entries()) {
      const absolutePath = path.resolve(projectPath, file);
      if (!isPathSafe(absolutePath, projectPath)) {
        failed.push({ file, reason: 'Unsafe path (path traversal blocked)' });
        continue;
      }

      let content = '';
      try {
        content = await readSourceFile(absolutePath);
      } catch {
        content = '';
      }

      let fileAppliedCount = 0;
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
        }
      }

      if (fileAppliedCount > 0) {
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

    return NextResponse.json({
      success: true,
      data: {
        applied,
        filesChanged,
        failed,
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
