import { describe, it, expect } from 'vitest';
import { generateRefactorDiffs } from '../lib/agent/refactor-client';
import type { ComponentChange, DetectedComponent } from '../types';

function comp(id: string, cls: string, css?: DetectedComponent['cssInfo']): DetectedComponent {
  return { id, name: id, type: 'section', elementIds: [id], boundingBox: { x: 0, y: 0, width: 200, height: 100 }, sourceFile: '', reasoning: '', fullClassName: cls, cssInfo: css } as any;
}
function src(cls: string, path = 'src/Test.tsx') {
  return { path, content: `<div className="${cls}">content</div>` };
}

async function refactor(cls: string, change: ComponentChange, path?: string) {
  return generateRefactorDiffs({ changes: [change], components: [comp('c1', cls)], sources: [src(cls, path)] });
}

const resize = (from: Partial<ComponentChange['from']>, to: Partial<ComponentChange['to']>): ComponentChange => ({
  componentId: 'c1', type: 'resize', from: { width: 200, height: 100, ...from }, to: { width: 200, height: 100, ...to },
});
const move = (from: Partial<ComponentChange['from']>, to: Partial<ComponentChange['to']>): ComponentChange => ({
  componentId: 'c1', type: 'move', from: { x: 0, y: 0, ...from }, to: { x: 0, y: 0, ...to },
});

describe('Tailwind edge cases: resize', () => {
  it('h-0 → h-8 (from zero)', async () => {
    const d = await refactor('flex h-0 bg-white', resize({ height: 0 }, { height: 32 }));
    expect(d).toHaveLength(1);
    expect(d[0].modified).toContain('h-8');
  });

  it('h-96 → h-[500px] (beyond TW_MAP range)', async () => {
    const d = await refactor('flex h-96 bg-white', resize({ height: 384 }, { height: 500 }));
    expect(d).toHaveLength(1);
    expect(d[0].modified).toContain('h-[500px]');
  });

  it('h-[200px] arbitrary → h-[300px] arbitrary', async () => {
    const d = await refactor('flex h-[200px] bg-white', resize({ height: 200 }, { height: 300 }));
    expect(d).toHaveLength(1);
    expect(d[0].modified).toContain('h-[300px]');
  });

  it('w-0.5 (2px) → w-2 (8px)', async () => {
    const d = await refactor('flex w-0.5 bg-white', resize({ width: 2, height: 100 }, { width: 8, height: 100 }));
    expect(d).toHaveLength(1);
    expect(d[0].modified).toContain('w-2');
  });

  it('py-4 padding change on height resize', async () => {
    const d = await refactor('flex py-4 bg-white', resize({ height: 100 }, { height: 132 }));
    expect(d).toHaveLength(1);
    expect(d[0].modified).toContain('py-');
  });

  it('px-4 padding change on width resize', async () => {
    const d = await refactor('flex px-4 bg-white', resize({ width: 200 }, { width: 232 }));
    expect(d).toHaveLength(1);
    expect(d[0].modified).toContain('px-');
  });

  it('both h and w present — height takes priority', async () => {
    const d = await refactor('flex h-48 w-64 bg-white', resize({ height: 192, width: 256 }, { height: 256, width: 320 }));
    expect(d).toHaveLength(1);
    // Height change is processed first
    expect(d[0].modified).toContain('h-64');
  });

  it('very small resize (1px) should be ignored', async () => {
    const d = await refactor('flex h-48 bg-white', resize({ height: 192 }, { height: 193 }));
    expect(d).toHaveLength(0);
  });

  it('exactly 2px change should be ignored', async () => {
    const d = await refactor('flex h-48 bg-white', resize({ height: 192 }, { height: 194 }));
    expect(d).toHaveLength(0);
  });

  it('3px change should be applied', async () => {
    const d = await refactor('flex h-48 bg-white', resize({ height: 192 }, { height: 195 }));
    expect(d).toHaveLength(1);
  });

  it('negative width resize (shrink)', async () => {
    const d = await refactor('flex w-80 bg-white', resize({ width: 320 }, { width: 192 }));
    expect(d).toHaveLength(1);
    expect(d[0].modified).toContain('w-48');
  });
});

describe('Tailwind edge cases: move', () => {
  it('mt-0 + 16px move down → mt-4', async () => {
    const d = await refactor('flex mt-0 bg-white', move({ y: 0 }, { y: 16 }));
    expect(d).toHaveLength(1);
    expect(d[0].modified).toContain('mt-4');
  });

  it('mt-12 move up (negative delta) → mt-4', async () => {
    const d = await refactor('flex mt-12 bg-white', move({ y: 48 }, { y: 16 }));
    expect(d).toHaveLength(1);
    expect(d[0].modified).toContain('mt-4');
  });

  it('mt-4 move up past zero → mt-0 (clamped)', async () => {
    const d = await refactor('flex mt-4 bg-white', move({ y: 16 }, { y: -20 }));
    expect(d).toHaveLength(1);
    expect(d[0].modified).toContain('mt-0');
  });

  it('mb-8 move down → mb decreases', async () => {
    const d = await refactor('flex mb-8 bg-white', move({ y: 0 }, { y: 16 }));
    expect(d).toHaveLength(1);
    expect(d[0].modified).toContain('mb-');
  });

  it('ml-4 move right → ml increases', async () => {
    const d = await refactor('flex ml-4 bg-white', move({ x: 16 }, { x: 48 }));
    expect(d).toHaveLength(1);
    expect(d[0].modified).toContain('ml-12');
  });

  it('no margin class + move down → add mt-[Npx]', async () => {
    const d = await refactor('flex bg-white', move({ y: 0 }, { y: 25 }));
    expect(d).toHaveLength(1);
    expect(d[0].modified).toContain('mt-');
  });

  it('no margin class + move up → add -translate-y', async () => {
    const d = await refactor('flex bg-white', move({ y: 50 }, { y: 20 }));
    expect(d).toHaveLength(1);
    expect(d[0].modified).toContain('-translate-y-');
  });

  it('no margin + move right → add ml-[Npx]', async () => {
    const d = await refactor('flex bg-white', move({ x: 0 }, { x: 30 }));
    expect(d).toHaveLength(1);
    expect(d[0].modified).toContain('ml-');
  });

  it('no margin + move left → add -translate-x', async () => {
    const d = await refactor('flex bg-white', move({ x: 50 }, { x: 20 }));
    expect(d).toHaveLength(1);
    expect(d[0].modified).toContain('-translate-x-');
  });

  it('diagonal move (both dx and dy) → both added', async () => {
    const d = await refactor('flex bg-white', move({ x: 0, y: 0 }, { x: 20, y: 30 }));
    expect(d).toHaveLength(1);
    expect(d[0].modified).toContain('mt-');
    expect(d[0].modified).toContain('ml-');
  });

  it('small move (1px each) should be ignored', async () => {
    const d = await refactor('flex mt-4 bg-white', move({ x: 0, y: 16 }, { x: 1, y: 17 }));
    expect(d).toHaveLength(0);
  });
});

describe('Tailwind edge cases: className patterns', () => {
  it('className with many classes (10+)', async () => {
    const cls = 'flex flex-col items-center justify-center gap-4 p-8 h-64 w-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl shadow-2xl';
    const d = await refactor(cls, resize({ height: 256 }, { height: 384 }));
    expect(d).toHaveLength(1);
    expect(d[0].modified).toContain('h-96');
    // All other classes preserved
    expect(d[0].modified).toContain('flex-col');
    expect(d[0].modified).toContain('shadow-2xl');
  });

  it('className with responsive prefixes (sm:h-48)', async () => {
    // Responsive prefixed classes should NOT be matched by findTwClass('h')
    const cls = 'flex sm:h-48 bg-white';
    const d = await refactor(cls, resize({ height: 100 }, { height: 200 }));
    expect(d).toHaveLength(1);
    // Should ADD h-[200px] since sm:h-48 is not the same as h-48
    expect(d[0].modified).toContain('h-');
  });

  it('empty className → no match', async () => {
    const d = await refactor('', resize({ height: 100 }, { height: 200 }));
    expect(d).toHaveLength(0);
  });

  it('source file not found → no match', async () => {
    const diffs = await generateRefactorDiffs({
      changes: [resize({ height: 100 }, { height: 200 })],
      components: [comp('c1', 'flex h-48')],
      sources: [{ path: 'other.tsx', content: '<div>no match</div>' }],
    });
    expect(diffs).toHaveLength(0);
  });

  it('component not in changes → skipped', async () => {
    const diffs = await generateRefactorDiffs({
      changes: [{ componentId: 'nonexistent', type: 'resize', from: { height: 100 }, to: { height: 200 } }],
      components: [comp('c1', 'flex h-48')],
      sources: [src('flex h-48')],
    });
    expect(diffs).toHaveLength(0);
  });
});
