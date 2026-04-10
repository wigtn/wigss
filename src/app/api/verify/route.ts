import { NextRequest, NextResponse } from 'next/server';
import type { BoundingBox, FidelityExpectation } from '@/types';
import { verifyBatch } from '@/lib/agent/verify/fidelity-check';

/**
 * POST /api/verify
 *
 * Accepts the fidelity expectations that were produced alongside a set of
 * refactor diffs, plus the before/after bounding boxes re-measured by the
 * editor after it reloaded the target page.
 *
 * Request:
 *   {
 *     expectations: FidelityExpectation[],
 *     priorBoxes:  Record<componentId, BoundingBox>,
 *     actualBoxes: Record<componentId, BoundingBox>,
 *   }
 *
 * Response:
 *   { success: true, data: { passed, reports: FidelityReport[] } }
 *   { success: false, error: { code, message } }
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      expectations?: unknown;
      priorBoxes?: unknown;
      actualBoxes?: unknown;
    };

    if (!Array.isArray(body.expectations)) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INVALID_INPUT', message: 'expectations array required' },
        },
        { status: 400 },
      );
    }

    if (
      !body.priorBoxes ||
      typeof body.priorBoxes !== 'object' ||
      !body.actualBoxes ||
      typeof body.actualBoxes !== 'object'
    ) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'priorBoxes and actualBoxes records required',
          },
        },
        { status: 400 },
      );
    }

    const expectations = body.expectations as FidelityExpectation[];
    const priorRecord = body.priorBoxes as Record<string, BoundingBox>;
    const actualRecord = body.actualBoxes as Record<string, BoundingBox>;

    const priorBoxes = new Map<string, BoundingBox>(Object.entries(priorRecord));
    const actualBoxes = new Map<string, BoundingBox>(Object.entries(actualRecord));

    const result = verifyBatch(expectations, priorBoxes, actualBoxes);

    return NextResponse.json({
      success: true,
      data: result,
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
