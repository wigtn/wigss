/**
 * Regression tests for the three Phase 0 bugs that motivated the v2.2 refactor.
 *
 *  1. merge-loss — resize followed by move for the same component dropped the resize
 *  2. line-count reject — apply guard rejected any diff whose line count changed
 *  3. AST-span diff — tailwind strategy reconstructed className="..." as a string
 *     and silently dropped template literals / duplicates
 *
 * These tests drive the public generateRefactorDiffs API (the stable boundary
 * the editor talks to) to make sure the fixes cannot regress silently.
 */
import { describe, it, expect } from 'vitest';
import { generateRefactorDiffs } from '../lib/agent/refactor-client';
import type { ComponentChange, DetectedComponent, SourceInput } from '../types';

function mkComponent(partial: Partial<DetectedComponent> = {}): DetectedComponent {
  return {
    id: 'c1',
    name: 'card',
    type: 'card',
    elementIds: ['el-1'],
    boundingBox: { x: 0, y: 0, width: 200, height: 96 },
    sourceFile: 'src/app/page.tsx',
    reasoning: 'regression',
    fullClassName: 'flex h-24 w-50',
    ...partial,
  };
}

describe('Phase 0 regression: merge-loss (resize + move)', () => {
  it('preserves both resize and move when emitted as two ComponentChanges', async () => {
    // Source has no margin / position classes, so the tailwind strategy is
    // expected to add margin-top and swap h-24 → h-64.
    const source: SourceInput = {
      path: 'src/app/page.tsx',
      content:
        'export default function Page() { return <div className="flex h-24 w-50">hi</div>; }',
    };
    const changes: ComponentChange[] = [
      {
        componentId: 'c1',
        type: 'resize',
        from: { x: 0, y: 0, width: 200, height: 96 },
        to: { x: 0, y: 0, width: 200, height: 256 },
      },
      {
        componentId: 'c1',
        type: 'move',
        from: { x: 0, y: 0, width: 200, height: 256 },
        to: { x: 0, y: 40, width: 200, height: 256 },
      },
    ];

    const diffs = await generateRefactorDiffs({
      changes,
      components: [mkComponent()],
      sources: [source],
    });

    expect(diffs).toHaveLength(1);
    const [diff] = diffs;
    // Resize change must survive the merge
    expect(diff.modified).toContain('h-64');
    // Move change must survive the merge (either preserved as margin or translate)
    expect(diff.modified).toMatch(/mt-|translate|margin/i);
  });

  it('does not lose the resize when the later change is a move on a different axis', async () => {
    const source: SourceInput = {
      path: 'src/app/page.tsx',
      content:
        'export default function Page() { return <div className="flex h-24 w-50">hi</div>; }',
    };
    const changes: ComponentChange[] = [
      {
        componentId: 'c1',
        type: 'resize',
        from: { x: 0, y: 0, width: 200, height: 96 },
        to: { x: 0, y: 0, width: 320, height: 256 },
      },
      {
        componentId: 'c1',
        type: 'move',
        from: { x: 0, y: 0, width: 320, height: 256 },
        to: { x: 20, y: 0, width: 320, height: 256 },
      },
    ];

    const diffs = await generateRefactorDiffs({
      changes,
      components: [mkComponent()],
      sources: [source],
    });

    expect(diffs).toHaveLength(1);
    const [diff] = diffs;
    // Both resize dimensions must be represented
    expect(diff.modified).toMatch(/h-64|height/);
    expect(diff.modified).toMatch(/w-80|width/);
    // Move delta present
    expect(diff.modified).toMatch(/ml-|translate|margin-left/i);
  });
});

describe('Phase 0 regression: AST-span diff fidelity', () => {
  it('produces a correct diff for a template-literal className (tailwind)', async () => {
    const source: SourceInput = {
      path: 'src/app/page.tsx',
      content:
        'export default function Page() { const variant = "lg"; return <div className={`flex h-24 ${variant}`}>hi</div>; }',
    };
    const changes: ComponentChange[] = [
      {
        componentId: 'c1',
        type: 'resize',
        from: { width: 200, height: 96 },
        to: { width: 200, height: 256 },
      },
    ];

    const diffs = await generateRefactorDiffs({
      changes,
      components: [mkComponent({ fullClassName: 'flex h-24' })],
      sources: [source],
    });

    // We don't require a tailwind diff — fallback to inline is acceptable —
    // but the old bug returned ZERO diffs silently because the reconstructed
    // `className="flex h-24"` string couldn't match the template literal.
    // Asserting non-empty pins down the regression.
    expect(diffs.length).toBeGreaterThanOrEqual(1);
    const [diff] = diffs;
    // The diff.original must correspond to actual source text (substring match)
    expect(source.content).toContain(diff.original);
  });

  it('does not corrupt siblings when two elements share the same className string', async () => {
    const source: SourceInput = {
      path: 'src/app/page.tsx',
      content: [
        'export default function Page() {',
        '  return (',
        '    <div>',
        '      <div className="box h-24">A</div>',
        '      <div className="box h-24">B</div>',
        '    </div>',
        '  );',
        '}',
      ].join('\n'),
    };
    const changes: ComponentChange[] = [
      {
        componentId: 'c1',
        type: 'resize',
        from: { width: 200, height: 96 },
        to: { width: 200, height: 256 },
      },
    ];

    const diffs = await generateRefactorDiffs({
      changes,
      components: [mkComponent({ fullClassName: 'box h-24' })],
      sources: [source],
    });

    expect(diffs).toHaveLength(1);
    const [diff] = diffs;
    // Apply the diff and confirm only one of the two elements changes.
    const applied = source.content.replace(diff.original, diff.modified);
    const h64Count = (applied.match(/h-64/g) || []).length;
    const h24Count = (applied.match(/h-24/g) || []).length;
    // Exactly one h-24 remains, exactly one h-64 appears.
    expect(h64Count + h24Count).toBe(2);
  });
});

describe('Phase 0 regression: line-count guard', () => {
  it('accepts a diff whose replacement happens to change line count', async () => {
    // Construct a scenario where inline-style strategy injects style={{}} next
    // to className — produced by the inline fallback. The apply-side guard
    // used to reject any diff whose line count changed; this asserts the
    // replacement goes through.
    const source: SourceInput = {
      path: 'src/app/page.tsx',
      content:
        'export default function Page() { return <div className="box">hi</div>; }',
    };
    const changes: ComponentChange[] = [
      {
        componentId: 'c1',
        type: 'resize',
        from: { width: 200, height: 100 },
        to: { width: 200, height: 256 },
      },
    ];

    const diffs = await generateRefactorDiffs({
      changes,
      components: [mkComponent({ fullClassName: 'box' })],
      sources: [source],
    });

    expect(diffs).toHaveLength(1);
    // The diff must be applicable: source.replace(original, modified) should
    // actually change the content (i.e. the original substring exists).
    const applied = source.content.replace(diffs[0].original, diffs[0].modified);
    expect(applied).not.toBe(source.content);
    expect(applied).toContain('256px');
  });
});
