import type {
  BoundingBox,
  FidelityExpectation,
  FidelityMismatch,
  FidelityReport,
  StyleIntent,
} from '@/types';

/**
 * Pixel tolerance for fidelity comparisons. Matches the 2px "no-op" threshold
 * used elsewhere in the pipeline (e.g. changeToCssProperties).
 */
export const FIDELITY_TOLERANCE_PX = 2;

/**
 * Build a FidelityExpectation from the StyleIntent that was just dispatched.
 * The expectation captures "what should be true of this component's bounding
 * box after the apply step completes".
 *
 * Phase 5 scope: translate the handful of bbox-affecting styles (width, height,
 * margin*) into expected px values. Further properties (colour, typography)
 * will be added as the Editor begins capturing them.
 */
export function intentToExpectation(
  intent: StyleIntent,
  sourceFile: string,
): FidelityExpectation {
  const expected: Record<string, string> = {};
  const ts = intent.targetStyles;

  if (ts.width != null) expected.width = ts.width;
  if (ts.height != null) expected.height = ts.height;
  // marginTop/Left are deltas — they're not directly verifiable against
  // bounding box alone without the prior state. The editor passes the prior
  // bbox into `verifyAgainstBoundingBox`, so those entries live there.
  if (ts.marginTop != null) expected.marginTop = ts.marginTop;
  if (ts.marginLeft != null) expected.marginLeft = ts.marginLeft;

  return { componentId: intent.componentId, expectedStyles: expected, sourceFile };
}

/**
 * Parse a "123px" / "-5px" style CSS px value into a number.
 * Returns null for anything non-px (percentages, auto, etc.).
 */
function parsePx(value: string): number | null {
  const match = value.match(/^(-?\d+(?:\.\d+)?)px$/);
  return match ? parseFloat(match[1]) : null;
}

/**
 * Compare an expectation against the re-measured bounding box of a component.
 *
 * `priorBox` represents the bounding box BEFORE the edit (so delta-based
 * properties like marginTop can be validated).
 * `actualBox` is the re-measured bounding box AFTER the edit has been applied.
 */
export function verifyAgainstBoundingBox(
  expectation: FidelityExpectation,
  priorBox: BoundingBox,
  actualBox: BoundingBox,
): FidelityReport {
  const mismatches: FidelityMismatch[] = [];

  for (const [prop, value] of Object.entries(expectation.expectedStyles)) {
    const expectedPx = parsePx(value);
    if (expectedPx == null) continue;

    let actualPx: number;
    let comparePx: number;

    switch (prop) {
      case 'width':
        actualPx = actualBox.width;
        comparePx = expectedPx;
        break;
      case 'height':
        actualPx = actualBox.height;
        comparePx = expectedPx;
        break;
      case 'marginTop':
        actualPx = actualBox.y - priorBox.y;
        comparePx = expectedPx;
        break;
      case 'marginLeft':
        actualPx = actualBox.x - priorBox.x;
        comparePx = expectedPx;
        break;
      default:
        continue;
    }

    const delta = Math.abs(actualPx - comparePx);
    if (delta > FIDELITY_TOLERANCE_PX) {
      mismatches.push({
        componentId: expectation.componentId,
        property: prop,
        expected: value,
        actual: `${Math.round(actualPx)}px`,
        deltaPx: Math.round(delta),
      });
    }
  }

  return {
    passed: mismatches.length === 0,
    componentId: expectation.componentId,
    mismatches,
  };
}

/**
 * Batch report a list of expectations against a map of post-apply bounding boxes.
 * Returns one report per expectation plus an aggregate pass/fail flag.
 */
export function verifyBatch(
  expectations: FidelityExpectation[],
  priorBoxes: Map<string, BoundingBox>,
  actualBoxes: Map<string, BoundingBox>,
): { passed: boolean; reports: FidelityReport[] } {
  const reports: FidelityReport[] = [];
  let allPassed = true;

  for (const expectation of expectations) {
    const prior = priorBoxes.get(expectation.componentId);
    const actual = actualBoxes.get(expectation.componentId);
    if (!prior || !actual) {
      reports.push({
        passed: false,
        componentId: expectation.componentId,
        mismatches: [
          {
            componentId: expectation.componentId,
            property: '__measurement__',
            expected: 'bounding box available',
            actual: 'component not remeasured',
          },
        ],
      });
      allPassed = false;
      continue;
    }

    const report = verifyAgainstBoundingBox(expectation, prior, actual);
    if (!report.passed) allPassed = false;
    reports.push(report);
  }

  return { passed: allPassed, reports };
}
