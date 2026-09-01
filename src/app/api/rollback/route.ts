import { NextRequest, NextResponse } from 'next/server';
import { readSourceFile, writeSourceFile } from '@/lib/file-utils';
import { defaultBackupStore, revertEdits } from '@/lib/apply-backup';

/**
 * POST /api/rollback  (v3 · P4 · PROD-634)
 *
 * 파일 전체 복원이 아니라 **적용된 편집의 역치환**이다. 저장 이후 사용자가
 * 같은 파일의 다른 줄을 고쳤어도 그 수정은 남는다. 우리가 쓴 텍스트가 이미
 * 바뀌었거나 여러 곳에 있으면 아무것도 쓰지 않고 409 로 사유를 돌려준다 —
 * 조용히 덮어쓰는 것보다 거절이 낫다.
 *
 * 원자성: 모든 파일의 역치환을 메모리에서 먼저 계산하고, 전부 성공할 때만
 * 디스크에 쓴다. 성공한 롤백만 backupId 를 소비한다.
 *
 * Request:  { backupId: string }
 * Response: { success: true, data: { restored, message } }
 *           { success: false, error: { code, message } }  (409 = 역치환 불가)
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { backupId?: unknown };

    if (typeof body.backupId !== 'string' || !body.backupId) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INVALID_INPUT', message: 'backupId string required' },
        },
        { status: 400 },
      );
    }

    const entry = defaultBackupStore.get(body.backupId);
    if (!entry) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'BACKUP_NOT_FOUND',
            message: `No backup entry for id "${body.backupId}" (expired or unknown)`,
          },
        },
        { status: 404 },
      );
    }

    // 1) 전 파일 역치환을 메모리에서 계산 — 하나라도 실패하면 아무것도 쓰지 않는다
    const planned: { path: string; content: string }[] = [];
    for (const file of entry.files) {
      let current: string;
      try {
        current = await readSourceFile(file.path);
      } catch (err) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'ROLLBACK_REFUSED',
              message: `${file.path}: 파일을 읽을 수 없음 (${err instanceof Error ? err.message : String(err)})`,
            },
          },
          { status: 409 },
        );
      }

      const reverted = revertEdits(current, file.edits);
      if (!reverted.ok) {
        return NextResponse.json(
          {
            success: false,
            error: { code: 'ROLLBACK_REFUSED', message: `${file.path}: ${reverted.reason}` },
          },
          { status: 409 },
        );
      }
      planned.push({ path: file.path, content: reverted.content });
    }

    // 2) 전부 성공 — 이제 쓴다
    const restored: string[] = [];
    for (const p of planned) {
      await writeSourceFile(p.path, p.content);
      restored.push(p.path);
    }

    // 성공한 롤백만 소비한다 (거부는 항목을 남겨 재시도 허용)
    defaultBackupStore.delete(entry.id);

    return NextResponse.json({
      success: true,
      data: {
        restored,
        message: `Rolled back ${restored.length} file(s) by reversing applied edits`,
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
