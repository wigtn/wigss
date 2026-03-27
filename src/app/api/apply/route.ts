import { NextRequest, NextResponse } from 'next/server';
import type { CodeDiff } from '@/types';

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
    const { diffs, projectPath } = body;

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

    // Phase 1: Return success stub (actual apply logic comes in Phase 3)
    // Phase 3 will: read files, validate paths, apply diffs, write files
    return NextResponse.json({
      success: true,
      data: {
        applied: diffs.length,
        message: 'Code changes applied (Phase 3 implementation pending)',
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
