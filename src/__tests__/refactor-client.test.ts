import { describe, it, expect } from 'vitest';
import { generateRefactorDiffs } from '../lib/agent/refactor-client';
import type { ComponentChange, DetectedComponent } from '../types';

// Helper to create a detected component with fullClassName
function makeComponent(
  id: string,
  fullClassName: string,
  overrides: Partial<DetectedComponent> = {},
): DetectedComponent {
  return {
    id,
    name: `Component ${id}`,
    type: 'section',
    elementIds: [id],
    boundingBox: { x: 0, y: 0, width: 200, height: 100 },
    sourceFile: '',
    reasoning: '',
    fullClassName,
    ...overrides,
  } as DetectedComponent & { fullClassName: string };
}

// Simulated source file content
const SOURCE_FILE = {
  path: 'src/components/Card.tsx',
  content: `export function Card() {
  return (
    <div className="flex flex-col p-4 h-48 w-64 mt-4 bg-white rounded-lg shadow">
      <h2 className="text-lg font-bold">Title</h2>
      <p className="text-sm text-gray-600">Description</p>
    </div>
  );
}`,
};

describe('refactor-client: generateRefactorDiffs', () => {
  // ── Resize Tests ──

  it('should replace h-48 when height changes (resize)', async () => {
    const comp = makeComponent('card-1', 'flex flex-col p-4 h-48 w-64 mt-4 bg-white rounded-lg shadow');
    const change: ComponentChange = {
      componentId: 'card-1',
      type: 'resize',
      from: { width: 256, height: 192 },
      to: { width: 256, height: 256 },
    };

    const diffs = await generateRefactorDiffs({
      changes: [change],
      components: [comp],
      sources: [SOURCE_FILE],
    });

    expect(diffs).toHaveLength(1);
    expect(diffs[0].original).toContain('h-48');
    expect(diffs[0].modified).toContain('h-64');
    expect(diffs[0].modified).not.toContain('h-48');
    expect(diffs[0].file).toBe(SOURCE_FILE.path);
    expect(diffs[0].lineNumber).toBeGreaterThan(0);
  });

  it('should replace w-64 when width changes (resize)', async () => {
    const comp = makeComponent('card-1', 'flex flex-col p-4 w-64 bg-white rounded-lg shadow');
    const source = {
      path: 'src/components/Wide.tsx',
      content: `<div className="flex flex-col p-4 w-64 bg-white rounded-lg shadow">content</div>`,
    };
    const change: ComponentChange = {
      componentId: 'card-1',
      type: 'resize',
      from: { width: 256, height: 100 },
      to: { width: 320, height: 100 },
    };

    const diffs = await generateRefactorDiffs({
      changes: [change],
      components: [comp],
      sources: [source],
    });

    expect(diffs).toHaveLength(1);
    expect(diffs[0].original).toContain('w-64');
    expect(diffs[0].modified).toContain('w-80');
  });

  it('should add h-[Npx] when no existing h-XX class', async () => {
    const comp = makeComponent('card-2', 'flex flex-col p-4 bg-white');
    const source = {
      path: 'src/components/NoHeight.tsx',
      content: `<div className="flex flex-col p-4 bg-white">content</div>`,
    };
    const change: ComponentChange = {
      componentId: 'card-2',
      type: 'resize',
      from: { width: 200, height: 100 },
      to: { width: 200, height: 150 },
    };

    const diffs = await generateRefactorDiffs({
      changes: [change],
      components: [comp],
      sources: [source],
    });

    expect(diffs).toHaveLength(1);
    expect(diffs[0].modified).toContain('h-');
    // Original class should be preserved
    expect(diffs[0].modified).toContain('flex flex-col p-4 bg-white');
  });

  // ── Move Tests ──

  it('should replace mt-4 when moved down (move)', async () => {
    const comp = makeComponent('card-1', 'flex flex-col p-4 h-48 w-64 mt-4 bg-white rounded-lg shadow');
    const change: ComponentChange = {
      componentId: 'card-1',
      type: 'move',
      from: { x: 0, y: 16 },
      to: { x: 0, y: 48 },
    };

    const diffs = await generateRefactorDiffs({
      changes: [change],
      components: [comp],
      sources: [SOURCE_FILE],
    });

    expect(diffs).toHaveLength(1);
    expect(diffs[0].original).toContain('mt-4');
    expect(diffs[0].modified).toContain('mt-12');
  });

  it('should add mt-[Npx] when no existing mt class (move down)', async () => {
    const comp = makeComponent('card-3', 'flex p-4 bg-white');
    const source = {
      path: 'src/components/NoMargin.tsx',
      content: `<div className="flex p-4 bg-white">content</div>`,
    };
    const change: ComponentChange = {
      componentId: 'card-3',
      type: 'move',
      from: { x: 0, y: 0 },
      to: { x: 0, y: 30 },
    };

    const diffs = await generateRefactorDiffs({
      changes: [change],
      components: [comp],
      sources: [source],
    });

    expect(diffs).toHaveLength(1);
    expect(diffs[0].modified).toContain('mt-');
    expect(diffs[0].modified).toContain('flex p-4 bg-white');
  });

  it('should add -translate-y when moved up without mt class', async () => {
    const comp = makeComponent('card-4', 'flex p-4 bg-blue');
    const source = {
      path: 'src/components/MoveUp.tsx',
      content: `<div className="flex p-4 bg-blue">content</div>`,
    };
    const change: ComponentChange = {
      componentId: 'card-4',
      type: 'move',
      from: { x: 0, y: 50 },
      to: { x: 0, y: 20 },
    };

    const diffs = await generateRefactorDiffs({
      changes: [change],
      components: [comp],
      sources: [source],
    });

    expect(diffs).toHaveLength(1);
    expect(diffs[0].modified).toContain('-translate-y-');
  });

  // ── Edge Cases ──

  it('should return empty diffs when fullClassName is missing', async () => {
    const comp = makeComponent('no-class', '');
    const change: ComponentChange = {
      componentId: 'no-class',
      type: 'resize',
      from: { width: 100, height: 100 },
      to: { width: 200, height: 200 },
    };

    const diffs = await generateRefactorDiffs({
      changes: [change],
      components: [comp],
      sources: [SOURCE_FILE],
    });

    expect(diffs).toHaveLength(0);
  });

  it('should return empty diffs when className not found in source', async () => {
    const comp = makeComponent('orphan', 'this-class-does-not-exist-anywhere');
    const change: ComponentChange = {
      componentId: 'orphan',
      type: 'resize',
      from: { width: 100, height: 100 },
      to: { width: 200, height: 200 },
    };

    const diffs = await generateRefactorDiffs({
      changes: [change],
      components: [comp],
      sources: [SOURCE_FILE],
    });

    expect(diffs).toHaveLength(0);
  });

  it('should deduplicate changes — keep latest per component', async () => {
    const comp = makeComponent('card-1', 'flex flex-col p-4 h-48 w-64 mt-4 bg-white rounded-lg shadow');
    const change1: ComponentChange = {
      componentId: 'card-1',
      type: 'resize',
      from: { width: 256, height: 192 },
      to: { width: 256, height: 224 },
    };
    const change2: ComponentChange = {
      componentId: 'card-1',
      type: 'resize',
      from: { width: 256, height: 224 },
      to: { width: 256, height: 256 },
    };

    const diffs = await generateRefactorDiffs({
      changes: [change1, change2],
      components: [comp],
      sources: [SOURCE_FILE],
    });

    // Should only produce 1 diff (latest change)
    expect(diffs).toHaveLength(1);
    expect(diffs[0].modified).toContain('h-64');
  });

  it('should skip changes smaller than 2px threshold', async () => {
    const comp = makeComponent('card-1', 'flex flex-col p-4 h-48 w-64 mt-4 bg-white rounded-lg shadow');
    const change: ComponentChange = {
      componentId: 'card-1',
      type: 'resize',
      from: { width: 256, height: 192 },
      to: { width: 256, height: 193 }, // only 1px change
    };

    const diffs = await generateRefactorDiffs({
      changes: [change],
      components: [comp],
      sources: [SOURCE_FILE],
    });

    expect(diffs).toHaveLength(0);
  });
});
