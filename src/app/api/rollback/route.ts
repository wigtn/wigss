import { NextRequest, NextResponse } from 'next/server';
import { writeSourceFile } from '@/lib/file-utils';
import { defaultBackupStore } from '@/lib/apply-backup';

/**
 * POST /api/rollback
 *
 * Restores the file contents captured by the apply route under `backupId`.
 * Intended to be called by the editor when a post-apply fidelity check
 * reports unacceptable drift from the user's intended design.
 *
 * Request:
 *   { backupId: string }
 *
 * Response:
 *   { success: true, data: { restored: string[], message: string } }
 *   { success: false, error: { code, message } }
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

    const restored: string[] = [];
    const failures: { path: string; reason: string }[] = [];
    for (const file of entry.files) {
      try {
        await writeSourceFile(file.path, file.originalContent);
        restored.push(file.path);
      } catch (err) {
        failures.push({
          path: file.path,
          reason: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Consume the backup so the same id cannot roll back twice.
    defaultBackupStore.delete(entry.id);

    if (failures.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'PARTIAL_ROLLBACK',
            message: `Restored ${restored.length}/${entry.files.length} file(s); ${failures.length} failed`,
            details: { restored, failures },
          },
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        restored,
        message: `Rolled back ${restored.length} file(s)`,
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
