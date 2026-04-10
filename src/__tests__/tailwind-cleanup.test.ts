import { describe, it, expect } from 'vitest';
import { generateRefactorDiffs } from '../lib/agent/refactor-client';
import {
  tailwindCleanupPass,
  projectUsesTailwind,
} from '../lib/agent/cleanup/tailwind-cleanup';
import type { CodeDiff, ComponentChange, DetectedComponent, SourceInput } from '../types';

function mkComponent(partial: Partial<DetectedComponent> = {}): DetectedComponent {
  return {
    id: 'c1',
    name: 'card',
    type: 'card',
    elementIds: ['el-1'],
    boundingBox: { x: 0, y: 0, width: 200, height: 100 },
    sourceFile: 'src/app/page.tsx',
    reasoning: 'cleanup test',
    fullClassName: 'flex items-center',
    ...partial,
  };
}

describe('projectUsesTailwind', () => {
  it('detects tailwind.config.js', () => {
    expect(
      projectUsesTailwind([
        { path: 'tailwind.config.js', content: 'module.exports = {}' },
      ]),
    ).toBe(true);
  });

  it('detects tailwind.config.ts in a subdirectory', () => {
    expect(
      projectUsesTailwind([
        { path: 'packages/web/tailwind.config.ts', content: 'export default {}' },
      ]),
    ).toBe(true);
  });

  it('returns false when no tailwind config exists', () => {
    expect(
      projectUsesTailwind([{ path: 'src/app/page.tsx', content: '' }]),
    ).toBe(false);
  });
});

describe('tailwindCleanupPass — inline → utility class conversion', () => {
  it('converts height/width inline style to Tailwind classes when presets match', () => {
    const source: SourceInput = {
      path: 'src/app/page.tsx',
      content: 'export default function Page() { return <div className="flex items-center">hi</div>; }',
    };
    const inlineDiff: CodeDiff = {
      file: 'src/app/page.tsx',
      original: 'className="flex items-center"',
      modified: `className="flex items-center" style={{ height: '256px', width: '128px' }}`,
      lineNumber: 1,
      explanation: 'inline',
      strategy: 'inline-style',
    };
    const tailwindCfg: SourceInput = {
      path: 'tailwind.config.js',
      content: 'module.exports = { content: [] }',
    };

    const cleaned = tailwindCleanupPass(inlineDiff, [source, tailwindCfg]);
    expect(cleaned.strategy).toBe('tailwind');
    expect(cleaned.modified).toContain('className="flex items-center h-64 w-32"');
    expect(cleaned.modified).not.toContain('style={{');
  });

  it('passes through when a property has no Tailwind preset (arbitrary px value)', () => {
    const source: SourceInput = {
      path: 'src/app/page.tsx',
      content: 'export default function Page() { return <div className="flex">hi</div>; }',
    };
    // 263px is outside the ±2px preset tolerance for any h-* bucket
    const inlineDiff: CodeDiff = {
      file: 'src/app/page.tsx',
      original: 'className="flex"',
      modified: `className="flex" style={{ height: '263px' }}`,
      lineNumber: 1,
      explanation: 'inline',
      strategy: 'inline-style',
    };
    const cleaned = tailwindCleanupPass(inlineDiff, [
      source,
      { path: 'tailwind.config.js', content: 'module.exports = {}' },
    ]);
    expect(cleaned).toBe(inlineDiff);
  });

  it('passes through when the project is not a Tailwind project', () => {
    const source: SourceInput = {
      path: 'src/app/page.tsx',
      content: 'export default function Page() { return <div className="card">hi</div>; }',
    };
    const inlineDiff: CodeDiff = {
      file: 'src/app/page.tsx',
      original: 'className="card"',
      modified: `className="card" style={{ height: '256px' }}`,
      lineNumber: 1,
      explanation: 'inline',
      strategy: 'inline-style',
    };
    const cleaned = tailwindCleanupPass(inlineDiff, [source]);
    expect(cleaned).toBe(inlineDiff);
  });

  it('does not touch non-inline diffs', () => {
    const inlineDiff: CodeDiff = {
      file: 'src/app/page.tsx',
      original: 'className="h-48"',
      modified: 'className="h-64"',
      lineNumber: 1,
      explanation: 'tailwind',
      strategy: 'tailwind',
    };
    const cleaned = tailwindCleanupPass(inlineDiff, [
      { path: 'tailwind.config.js', content: 'module.exports = {}' },
    ]);
    expect(cleaned).toBe(inlineDiff);
  });

  it('strips existing conflicting utility classes before adding new ones', () => {
    const source: SourceInput = {
      path: 'src/app/page.tsx',
      content: 'export default function Page() { return <div className="h-32 flex">hi</div>; }',
    };
    const inlineDiff: CodeDiff = {
      file: 'src/app/page.tsx',
      original: 'className="h-32 flex"',
      modified: `className="h-32 flex" style={{ height: '256px' }}`,
      lineNumber: 1,
      explanation: 'inline',
      strategy: 'inline-style',
    };
    const cleaned = tailwindCleanupPass(inlineDiff, [
      source,
      { path: 'tailwind.config.js', content: 'module.exports = {}' },
    ]);
    expect(cleaned.strategy).toBe('tailwind');
    // Old h-32 must be gone, new h-64 must be in
    expect(cleaned.modified).toContain('h-64');
    expect(cleaned.modified).not.toMatch(/h-32/);
    // Non-height classes preserved
    expect(cleaned.modified).toContain('flex');
  });
});

describe('cleanup integration via dispatchIntent', () => {
  it('Tailwind component gets a clean className diff (no cleanup needed)', async () => {
    const changes: ComponentChange[] = [
      {
        componentId: 'c1',
        type: 'resize',
        from: { width: 200, height: 96 },
        to: { width: 200, height: 256 },
      },
    ];
    const sources: SourceInput[] = [
      {
        path: 'src/app/page.tsx',
        content:
          'export default function Page() { return <div className="flex h-24 w-50">hi</div>; }',
      },
      { path: 'tailwind.config.js', content: 'module.exports = {}' },
    ];
    const diffs = await generateRefactorDiffs({
      changes,
      components: [mkComponent({ fullClassName: 'flex h-24 w-50' })],
      sources,
    });
    expect(diffs).toHaveLength(1);
    expect(diffs[0].strategy).toBe('tailwind');
    expect(diffs[0].modified).toContain('h-64');
  });
});
