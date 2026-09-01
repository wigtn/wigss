import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { isPathSafe, readSourceFile, writeSourceFile } from '@/lib/file-utils';
import { defaultBackupStore } from '@/lib/apply-backup';
import { parseAddress } from '@/lib/agent/address-resolver';
import { repairWithModel, type RepairMismatch } from '@/lib/agent/t1-repair';
import { bpFromWidth } from '@/lib/agent/rewriters/breakpoint-tailwind';
import { recordEditAttempt } from '@/lib/telemetry';

/**
 * POST /api/repair  (P9 · PROD-638, P7 · PROD-636 의 다음 후보)
 *
 * T0 가 포기했거나 화면 검증이 어긋난 편집을 T1(모델)로 수선해 즉시 적용한다.
 * 출력은 결정론 경로와 같은 관문을 지난다: 범위 강제, 출력 검증, 드리프트
 * 검사, 역치환 백업. 최종 판정은 에디터의 화면 재측정이 한다.
 *
 * Request:  { address, targetStyles, viewportWidth?, projectPath, reason?, mismatches? }
 * Response: { success, data: { backupId, explanation, fragment } }
 *           503 NO_AUTH — Claude 인증 없음 (정중한 스킵)
 */
export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  let breakpoint: string | undefined;
  try {
    const body = (await req.json()) as {
      address?: unknown;
      targetStyles?: unknown;
      viewportWidth?: unknown;
      projectPath?: unknown;
      reason?: unknown;
      mismatches?: unknown;
    };
    if (typeof body.address !== 'string' || typeof body.targetStyles !== 'object' || !body.targetStyles) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: 'address and targetStyles required' } },
        { status: 400 },
      );
    }
    const viewportWidth = typeof body.viewportWidth === 'number' ? body.viewportWidth : undefined;
    breakpoint = bpFromWidth(viewportWidth);

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
    const result = await repairWithModel({
      file: rel,
      content,
      line: parsed.line,
      column: parsed.column,
      targetStyles: body.targetStyles as Record<string, string>,
      viewportWidth,
      reason: typeof body.reason === 'string' ? body.reason : undefined,
      mismatches: Array.isArray(body.mismatches) ? (body.mismatches as RepairMismatch[]) : undefined,
    });

    if (!result.ok) {
      const noAuth = result.reason.startsWith('NO_AUTH');
      recordEditAttempt({
        tier: 'T1',
        intent: 'style',
        result: 'abandon',
        breakpoint,
        failReason: result.reason,
        latencyMs: Date.now() - startedAt,
      });
      return NextResponse.json(
        {
          success: false,
          error: { code: noAuth ? 'NO_AUTH' : 'REPAIR_REFUSED', message: result.reason },
        },
        { status: noAuth ? 503 : 409 },
      );
    }

    const { diff } = result;
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
      tier: 'T1',
      intent: 'style',
      result: 'repaired',
      breakpoint,
      latencyMs: Date.now() - startedAt,
    });

    return NextResponse.json({
      success: true,
      data: { backupId: entry.id, explanation: diff.explanation, fragment: result.fragment },
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
