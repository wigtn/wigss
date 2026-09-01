import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { isPathSafe, readSourceFile, writeSourceFile } from '@/lib/file-utils';
import { defaultBackupStore } from '@/lib/apply-backup';
import { parseAddress } from '@/lib/agent/address-resolver';
import { reorderSibling } from '@/lib/agent/structure-editor';
import { recordEditAttempt } from '@/lib/telemetry';

/**
 * POST /api/restructure  (P8 · PROD-637)
 *
 * 주소가 지목한 JSX 요소를 같은 부모의 toIndex 위치로 옮긴다.
 * 스타일 편집과 같은 계약을 쓴다: range 를 실은 diff, 드리프트 검사,
 * 역치환 백업(backupId). 실패는 사유와 함께 거절한다.
 *
 * Request:  { address: "file:line:col", toIndex: number, projectPath: string }
 * Response: { success, data: { applied, backupId, explanation } } | { success:false, error }
 */
export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  try {
    const body = (await req.json()) as {
      address?: unknown;
      toIndex?: unknown;
      projectPath?: unknown;
    };
    if (typeof body.address !== 'string' || typeof body.toIndex !== 'number') {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: 'address string and toIndex number required' } },
        { status: 400 },
      );
    }

    let projectPath = typeof body.projectPath === 'string' ? body.projectPath : '';
    if (!projectPath || projectPath === 'auto') {
      projectPath = process.env.SOURCE_PATH || process.cwd();
    }
    if (projectPath && !projectPath.includes('demo-target')) {
      const demoPath = path.join(projectPath, 'demo-target');
      try {
        await fs.access(demoPath);
        projectPath = demoPath;
      } catch { /* as-is */ }
    }

    const parsed = parseAddress(body.address);
    if (!parsed) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ADDRESS', message: `주소 형식 오류: ${body.address}` } },
        { status: 400 },
      );
    }
    const rel = path.isAbsolute(parsed.file) ? path.relative(projectPath, parsed.file) : parsed.file;
    const abs = path.resolve(projectPath, rel);
    if (!isPathSafe(abs, projectPath) || rel.startsWith('..')) {
      return NextResponse.json(
        { success: false, error: { code: 'UNSAFE_PATH', message: '주소가 프로젝트 밖을 가리킴' } },
        { status: 400 },
      );
    }

    const content = await readSourceFile(abs);
    const result = reorderSibling(content, rel, parsed.line, parsed.column, body.toIndex);
    if (!result.ok) {
      recordEditAttempt({
        tier: 'T0',
        intent: 'structure',
        result: 'abandon',
        failReason: result.reason,
        latencyMs: Date.now() - startedAt,
      });
      return NextResponse.json(
        { success: false, error: { code: 'RESTRUCTURE_REFUSED', message: result.reason } },
        { status: 409 },
      );
    }

    const { diff } = result;
    // 드리프트 검사 후 오프셋 치환 — /api/apply 와 동일 계약
    if (content.slice(diff.range!.start, diff.range!.end) !== diff.original) {
      return NextResponse.json(
        { success: false, error: { code: 'DRIFT', message: '파일이 변경됨 — 재스캔 필요' } },
        { status: 409 },
      );
    }
    const next =
      content.slice(0, diff.range!.start) + diff.modified + content.slice(diff.range!.end);
    await writeSourceFile(abs, next);

    const entry = defaultBackupStore.create([
      { path: abs, edits: [{ original: diff.original, modified: diff.modified }] },
    ]);

    recordEditAttempt({
      tier: 'T0',
      intent: 'structure',
      result: 'pass',
      latencyMs: Date.now() - startedAt,
    });

    return NextResponse.json({
      success: true,
      data: { applied: 1, backupId: entry.id, explanation: diff.explanation },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : String(error) },
      },
      { status: 500 },
    );
  }
}
