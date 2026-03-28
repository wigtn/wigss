import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import type { CodeDiff } from '@/types';
import { isPathSafe, readSourceFile, writeSourceFile } from '@/lib/file-utils';

function applyDiff(content: string, diff: CodeDiff): { ok: true; content: string } | { ok: false; reason: string } {
  const original = diff.original ?? '';
  const modified = diff.modified ?? '';

  // Safety: reject diffs that look like they're modifying unrelated code
  if (modified.includes('marginRight=') || modified.includes('marginLeft=') ||
      modified.includes('marginTop=') || modified.includes('marginBottom=')) {
    if (!original.includes('margin')) {
      return { ok: false, reason: `Rejected: diff adds inline margin prop to unrelated code in "${diff.file}"` };
    }
  }

  if (original.length > 0) {
    const foundIndex = content.indexOf(original);
    if (foundIndex !== -1) {
      const nextContent = `${content.slice(0, foundIndex)}${modified}${content.slice(foundIndex + original.length)}`;
      return { ok: true, content: nextContent };
    }
  }

  if (Number.isInteger(diff.lineNumber) && diff.lineNumber > 0) {
    const lines = content.split('\n');
    const start = Math.min(Math.max(diff.lineNumber - 1, 0), lines.length);
    const removeCount = original.length > 0
      ? Math.max(original.split('\n').length, 1)
      : 1;
    const insertLines = modified.split('\n');
    lines.splice(start, removeCount, ...insertLines);
    return { ok: true, content: lines.join('\n') };
  }

  if (original.length === 0 && modified.length > 0 && content.length === 0) {
    return { ok: true, content: modified };
  }

  return { ok: false, reason: `Cannot apply diff for file "${diff.file}"` };
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
