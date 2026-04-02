import { describe, it, expect } from 'vitest';
import { findTwClass, pxToTw } from '../lib/agent/strategies/tailwind-strategy';
import { refactorTailwind } from '../lib/agent/strategies/tailwind-strategy';
import type { ComponentChange, DetectedComponent } from '../types';

describe('findTwClass with breakpoint support', () => {
  // Scenario 1: Find base class (no breakpoint)
  it('should find base h-48 without breakpoint', () => {
    const result = findTwClass('flex h-48 w-full bg-white', 'h');
    expect(result).toBe('h-48');
  });

  it('should return null for w-full (non-numeric value)', () => {
    const result = findTwClass('flex h-48 w-full bg-white', 'w');
    // w-full doesn't match \d+ pattern — expected behavior
    expect(result).toBeNull();
  });

  it('should find base w-64', () => {
    const result = findTwClass('flex h-48 w-64 bg-white', 'w');
    expect(result).toBe('w-64');
  });

  // Scenario 2: Find breakpoint-prefixed class
  it('should find md:h-48 with breakpoint=md', () => {
    const result = findTwClass('h-24 md:h-48 lg:h-64', 'h', 'md');
    expect(result).toBe('md:h-48');
  });

  it('should find sm:w-[200px] with breakpoint=sm', () => {
    const result = findTwClass('w-full sm:w-[200px] md:w-64', 'w', 'sm');
    expect(result).toBe('sm:w-[200px]');
  });

  it('should find 2xl:h-96 with breakpoint=2xl', () => {
    const result = findTwClass('h-48 md:h-64 2xl:h-96', 'h', '2xl');
    expect(result).toBe('2xl:h-96');
  });

  // Scenario 3: Base class should NOT match breakpoint-prefixed ones
  it('should NOT find md:h-48 when looking for base class', () => {
    const result = findTwClass('md:h-48 lg:h-64', 'h');
    expect(result).toBeNull(); // No base h- class exists
  });

  it('should find base h-24 even when breakpoint classes exist', () => {
    const result = findTwClass('h-24 md:h-48 lg:h-64', 'h');
    expect(result).toBe('h-24');
  });

  // Scenario 4: Return null when breakpoint class doesn't exist
  it('should return null when xl:h-* does not exist', () => {
    const result = findTwClass('h-24 md:h-48', 'h', 'xl');
    expect(result).toBeNull();
  });

  // Scenario 5: Bracket values
  it('should find md:h-[300px]', () => {
    const result = findTwClass('h-48 md:h-[300px]', 'h', 'md');
    expect(result).toBe('md:h-[300px]');
  });

  // Scenario 6: Negative values
  it('should find base -mt-4', () => {
    const result = findTwClass('flex -mt-4 p-2', 'mt');
    expect(result).toBe('-mt-4');
  });

  // Scenario 7: Multiple utility prefixes
  it('should find md:mt-8 margin-top in breakpoint', () => {
    const result = findTwClass('mt-4 md:mt-8 lg:mt-12', 'mt', 'md');
    expect(result).toBe('md:mt-8');
  });
});

describe('refactorTailwind with breakpoint', () => {
  const makeComponent = (fullClassName: string): DetectedComponent => ({
    id: 'comp-1',
    name: 'TestCard',
    type: 'card',
    elementIds: ['el-1'],
    boundingBox: { x: 0, y: 0, width: 200, height: 200 },
    sourceFile: 'src/components/Card.tsx',
    reasoning: 'test',
    fullClassName,
  });

  const makeSources = (fullClassName: string) => [{
    path: 'src/components/Card.tsx',
    content: `<div className="${fullClassName}">Card</div>`,
  }];

  // Scenario: Resize with breakpoint → replace breakpoint class
  it('should replace md:h-48 with md:h-[200px] on breakpoint resize', () => {
    const className = 'h-24 md:h-48 bg-white';
    const change: ComponentChange = {
      componentId: 'comp-1',
      type: 'resize',
      from: { width: 200, height: 192 },  // h-48 = 192px
      to: { width: 200, height: 200 },
      breakpoint: 'md',
    };

    const result = refactorTailwind(change, makeComponent(className), makeSources(className));
    expect(result).not.toBeNull();
    expect(result!.modified).toContain('md:h-[200px]');
    // Base h-24 should be preserved
    expect(result!.modified).toContain('h-24');
  });

  // Scenario: Add breakpoint class when none exists
  it('should add md:h-[200px] when no md:h-* exists', () => {
    const className = 'h-24 bg-white';
    const change: ComponentChange = {
      componentId: 'comp-1',
      type: 'resize',
      from: { width: 200, height: 96 },  // h-24 = 96px
      to: { width: 200, height: 200 },
      breakpoint: 'md',
    };

    const result = refactorTailwind(change, makeComponent(className), makeSources(className));
    expect(result).not.toBeNull();
    expect(result!.modified).toContain('md:h-[200px]');
    // Base h-24 should still be there
    expect(result!.modified).toContain('h-24');
  });

  // Scenario: Base resize (no breakpoint) should only modify base class
  it('should modify base h-24 when no breakpoint set', () => {
    const className = 'h-24 md:h-48 bg-white';
    const change: ComponentChange = {
      componentId: 'comp-1',
      type: 'resize',
      from: { width: 200, height: 96 },
      to: { width: 200, height: 200 },
      breakpoint: null,
    };

    const result = refactorTailwind(change, makeComponent(className), makeSources(className));
    expect(result).not.toBeNull();
    // Base class should be changed
    expect(result!.modified).not.toContain(' h-24 ');
    // Breakpoint class should be preserved
    expect(result!.modified).toContain('md:h-48');
  });

  // Scenario: Width + breakpoint
  it('should handle width resize with lg breakpoint', () => {
    const className = 'w-32 lg:w-64 bg-blue-500';
    const change: ComponentChange = {
      componentId: 'comp-1',
      type: 'resize',
      from: { width: 256, height: 100 },  // lg:w-64 = 256px
      to: { width: 320, height: 100 },     // should become lg:w-80
      breakpoint: 'lg',
    };

    const result = refactorTailwind(change, makeComponent(className), makeSources(className));
    expect(result).not.toBeNull();
    expect(result!.modified).toContain('lg:w-80');
    // Base w-32 preserved
    expect(result!.modified).toContain('w-32');
  });
});

describe('pxToTw', () => {
  it('should map exact Tailwind sizes', () => {
    expect(pxToTw(16, 'h')).toBe('h-4');
    expect(pxToTw(48, 'w')).toBe('w-12');
    expect(pxToTw(96, 'h')).toBe('h-24');
    expect(pxToTw(320, 'w')).toBe('w-80');
  });

  it('should use bracket notation for non-standard sizes', () => {
    expect(pxToTw(100, 'h')).toBe('h-[100px]');
    expect(pxToTw(250, 'w')).toBe('w-[250px]');
  });

  it('should snap to closest when within 2px tolerance', () => {
    expect(pxToTw(47, 'h')).toBe('h-12');  // 48 is closest, diff=1
    expect(pxToTw(49, 'h')).toBe('h-12');  // 48 is closest, diff=1
  });
});
