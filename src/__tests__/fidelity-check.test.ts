import { describe, it, expect } from 'vitest';
import {
  FIDELITY_TOLERANCE_PX,
  intentToExpectation,
  verifyAgainstBoundingBox,
  verifyBatch,
} from '../lib/agent/verify/fidelity-check';
import { generateRefactorResult } from '../lib/agent/refactor-client';
import type { BoundingBox, ComponentChange, DetectedComponent, StyleIntent } from '../types';

function bbox(partial: Partial<BoundingBox>): BoundingBox {
  return { x: 0, y: 0, width: 0, height: 0, ...partial };
}

describe('intentToExpectation', () => {
  it('extracts width/height/margin from a StyleIntent', () => {
    const intent: StyleIntent = {
      componentId: 'c1',
      targetStyles: {
        width: '320px',
        height: '256px',
        marginTop: '40px',
      },
    };
    const exp = intentToExpectation(intent, 'src/app/page.tsx');
    expect(exp.componentId).toBe('c1');
    expect(exp.expectedStyles).toEqual({
      width: '320px',
      height: '256px',
      marginTop: '40px',
    });
    expect(exp.sourceFile).toBe('src/app/page.tsx');
  });

  it('omits unspecified properties', () => {
    const intent: StyleIntent = {
      componentId: 'c1',
      targetStyles: { height: '256px' },
    };
    const exp = intentToExpectation(intent, 'f.tsx');
    expect(Object.keys(exp.expectedStyles)).toEqual(['height']);
  });
});

describe('verifyAgainstBoundingBox', () => {
  it('passes when actual dimensions match expected within tolerance', () => {
    const report = verifyAgainstBoundingBox(
      {
        componentId: 'c1',
        expectedStyles: { width: '320px', height: '256px' },
        sourceFile: 'x.tsx',
      },
      bbox({ x: 0, y: 0, width: 100, height: 100 }),
      bbox({ x: 0, y: 0, width: 321, height: 255 }), // 1px and 1px off → within tolerance
    );
    expect(report.passed).toBe(true);
    expect(report.mismatches).toHaveLength(0);
  });

  it('reports width mismatch outside tolerance', () => {
    const report = verifyAgainstBoundingBox(
      {
        componentId: 'c1',
        expectedStyles: { width: '320px' },
        sourceFile: 'x.tsx',
      },
      bbox({ width: 100 }),
      bbox({ width: 310 }),
    );
    expect(report.passed).toBe(false);
    expect(report.mismatches).toHaveLength(1);
    expect(report.mismatches[0].property).toBe('width');
    expect(report.mismatches[0].expected).toBe('320px');
    expect(report.mismatches[0].actual).toBe('310px');
    expect(report.mismatches[0].deltaPx).toBe(10);
  });

  it('validates marginTop against y-delta from prior to actual', () => {
    const report = verifyAgainstBoundingBox(
      {
        componentId: 'c1',
        expectedStyles: { marginTop: '40px' },
        sourceFile: 'x.tsx',
      },
      bbox({ y: 50 }),
      bbox({ y: 90 }), // dy = 40, matches expected
    );
    expect(report.passed).toBe(true);
  });

  it('reports marginLeft mismatch when delta is wrong', () => {
    const report = verifyAgainstBoundingBox(
      {
        componentId: 'c1',
        expectedStyles: { marginLeft: '20px' },
        sourceFile: 'x.tsx',
      },
      bbox({ x: 0 }),
      bbox({ x: 5 }), // dx = 5, expected 20 → mismatch
    );
    expect(report.passed).toBe(false);
    expect(report.mismatches[0].property).toBe('marginLeft');
  });

  it('ignores non-px values (e.g., %)', () => {
    const report = verifyAgainstBoundingBox(
      {
        componentId: 'c1',
        expectedStyles: { width: '50%' },
        sourceFile: 'x.tsx',
      },
      bbox({}),
      bbox({ width: 500 }),
    );
    expect(report.passed).toBe(true);
    expect(report.mismatches).toHaveLength(0);
  });

  it('FIDELITY_TOLERANCE_PX is 2', () => {
    expect(FIDELITY_TOLERANCE_PX).toBe(2);
  });
});

describe('verifyBatch', () => {
  it('aggregates per-component reports', () => {
    const result = verifyBatch(
      [
        { componentId: 'c1', expectedStyles: { width: '200px' }, sourceFile: 'a.tsx' },
        { componentId: 'c2', expectedStyles: { height: '100px' }, sourceFile: 'b.tsx' },
      ],
      new Map([
        ['c1', bbox({ width: 100 })],
        ['c2', bbox({ height: 50 })],
      ]),
      new Map([
        ['c1', bbox({ width: 200 })],
        ['c2', bbox({ height: 80 })],
      ]),
    );
    expect(result.passed).toBe(false);
    expect(result.reports).toHaveLength(2);
    expect(result.reports[0].passed).toBe(true);
    expect(result.reports[1].passed).toBe(false);
  });

  it('flags missing re-measurement as a fidelity failure', () => {
    const result = verifyBatch(
      [{ componentId: 'c1', expectedStyles: { width: '200px' }, sourceFile: 'a.tsx' }],
      new Map([['c1', bbox({ width: 100 })]]),
      new Map(), // actualBoxes empty
    );
    expect(result.passed).toBe(false);
    expect(result.reports[0].mismatches[0].property).toBe('__measurement__');
  });
});

describe('generateRefactorResult integration', () => {
  function mkComponent(partial: Partial<DetectedComponent> = {}): DetectedComponent {
    return {
      id: 'c1',
      name: 'card',
      type: 'card',
      elementIds: ['el-1'],
      boundingBox: { x: 0, y: 0, width: 200, height: 96 },
      sourceFile: 'src/app/page.tsx',
      reasoning: 't',
      fullClassName: 'flex h-24 w-50',
      ...partial,
    };
  }

  it('returns expectations alongside diffs', async () => {
    const changes: ComponentChange[] = [
      {
        componentId: 'c1',
        type: 'resize',
        from: { width: 200, height: 96 },
        to: { width: 200, height: 256 },
      },
    ];
    const result = await generateRefactorResult({
      changes,
      components: [mkComponent()],
      sources: [
        {
          path: 'src/app/page.tsx',
          content:
            'export default function Page() { return <div className="flex h-24 w-50">hi</div>; }',
        },
      ],
    });
    expect(result.diffs).toHaveLength(1);
    expect(result.expectations).toHaveLength(1);
    expect(result.expectations[0].componentId).toBe('c1');
    expect(result.expectations[0].expectedStyles.height).toBe('256px');
  });
});
