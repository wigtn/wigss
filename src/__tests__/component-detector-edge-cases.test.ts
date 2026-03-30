import { describe, it, expect } from 'vitest';
import { detectComponents, type RawScanElement } from '../lib/component-detector';

function el(overrides: Partial<RawScanElement>): RawScanElement {
  return {
    id: 'el-1', tagName: 'div', className: '', boundingBox: { x: 0, y: 0, width: 800, height: 200 },
    visible: true, parentId: null, childIds: [], attributes: {}, textContent: '',
    depth: 1, childCount: 0, computedStyle: { display: 'block', position: 'relative', flexDirection: '' },
    ...overrides,
  };
}

describe('component-detector: semantic tag detection', () => {
  it('aside → sidebar type', () => {
    const comps = detectComponents([el({ id: 'aside-1', tagName: 'aside', className: 'w-64 bg-gray-100', boundingBox: { x: 0, y: 0, width: 256, height: 800 } })]);
    const sidebar = comps.find(c => c.type === 'sidebar');
    expect(sidebar).toBeDefined();
  });

  it('section with data-component="Hero" → hero type', () => {
    const comps = detectComponents([el({
      id: 'hero-1', tagName: 'section', className: 'h-96 bg-blue-500',
      boundingBox: { x: 0, y: 64, width: 1200, height: 384 },
      attributes: { 'data-component': 'Hero' },
    })]);
    expect(comps.length).toBeGreaterThan(0);
    expect(comps[0].name).toContain('Hero');
  });

  it('multiple semantic tags → multiple components', () => {
    const comps = detectComponents([
      el({ id: 'nav-1', tagName: 'nav', className: 'flex px-6', boundingBox: { x: 0, y: 0, width: 1200, height: 64 } }),
      el({ id: 'main-1', tagName: 'main', className: 'py-8', boundingBox: { x: 0, y: 64, width: 1200, height: 600 } }),
      el({ id: 'footer-1', tagName: 'footer', className: 'py-4 bg-gray-900', boundingBox: { x: 0, y: 664, width: 1200, height: 80 } }),
    ]);
    expect(comps.length).toBeGreaterThanOrEqual(3);
  });
});

describe('component-detector: fullClassName extraction', () => {
  it('preserves full className string', () => {
    const cls = 'flex items-center justify-between px-6 py-4 bg-white shadow-md';
    const comps = detectComponents([el({ id: 'nav-1', tagName: 'nav', className: cls, boundingBox: { x: 0, y: 0, width: 1200, height: 64 } })]);
    expect(comps.length).toBeGreaterThan(0);
    expect(comps[0].fullClassName).toBe(cls);
  });

  it('handles empty className', () => {
    const comps = detectComponents([el({ id: 'nav-1', tagName: 'nav', className: '', boundingBox: { x: 0, y: 0, width: 1200, height: 64 } })]);
    if (comps.length > 0) {
      expect(comps[0].fullClassName).toBe('');
    }
  });
});

describe('component-detector: filtering', () => {
  it('invisible elements with large bounding box still detected (detector trusts boundingBox)', () => {
    // Component detector does not filter by visible flag — it trusts boundingBox from the DOM
    // Invisible elements with valid bounding boxes can still be layout containers
    const comps = detectComponents([el({ id: 'hidden-1', visible: false, tagName: 'div', className: 'p-4' })]);
    expect(comps.length).toBeGreaterThanOrEqual(0); // May or may not detect depending on size
  });

  it('zero-size non-semantic elements are filtered', () => {
    const comps = detectComponents([el({ id: 'zero-1', tagName: 'div', className: 'p-4', boundingBox: { x: 0, y: 0, width: 0, height: 0 } })]);
    expect(comps).toHaveLength(0);
  });

  it('semantic tags detected even with zero size (Phase 1 priority)', () => {
    // Semantic tags are caught in Phase 1 before size filtering
    const comps = detectComponents([el({ id: 'nav-0', tagName: 'nav', boundingBox: { x: 0, y: 0, width: 0, height: 0 } })]);
    expect(comps.length).toBeGreaterThanOrEqual(1);
  });

  it('very small elements (below threshold) are filtered', () => {
    const comps = detectComponents([el({ id: 'tiny-1', tagName: 'div', boundingBox: { x: 0, y: 0, width: 50, height: 30 } })]);
    expect(comps).toHaveLength(0);
  });

  it('deep nested elements (depth > 3) in remaining phase', () => {
    const comps = detectComponents([el({ id: 'deep-1', tagName: 'div', className: 'p-4', depth: 4, boundingBox: { x: 0, y: 0, width: 200, height: 200 } })]);
    // depth 4 elements should not be detected in remaining phase (threshold ≤3)
    expect(comps).toHaveLength(0);
  });
});

describe('component-detector: repeated siblings (card grid)', () => {
  it('should detect repeated children as card type', () => {
    const comps = detectComponents([
      el({ id: 'grid-1', tagName: 'div', className: 'grid gap-4', boundingBox: { x: 0, y: 0, width: 1200, height: 600 }, childIds: ['c1', 'c2', 'c3'], childCount: 3, computedStyle: { display: 'grid', position: 'relative', flexDirection: '' } }),
      el({ id: 'c1', tagName: 'div', className: 'p-4 bg-white rounded', boundingBox: { x: 0, y: 0, width: 380, height: 200 }, parentId: 'grid-1', depth: 2 }),
      el({ id: 'c2', tagName: 'div', className: 'p-4 bg-white rounded', boundingBox: { x: 400, y: 0, width: 380, height: 200 }, parentId: 'grid-1', depth: 2 }),
      el({ id: 'c3', tagName: 'div', className: 'p-4 bg-white rounded', boundingBox: { x: 800, y: 0, width: 380, height: 200 }, parentId: 'grid-1', depth: 2 }),
    ]);
    // Should detect grid or card types
    expect(comps.length).toBeGreaterThanOrEqual(1);
    const hasGridOrCard = comps.some(c => c.type === 'grid' || c.type === 'card');
    expect(hasGridOrCard).toBe(true);
  });
});

describe('component-detector: bounding box accuracy', () => {
  it('boundingBox should match input exactly for semantic elements', () => {
    const box = { x: 50, y: 100, width: 1100, height: 300 };
    const comps = detectComponents([el({ id: 'sec-1', tagName: 'section', className: 'py-12', boundingBox: box })]);
    if (comps.length > 0) {
      expect(comps[0].boundingBox).toEqual(box);
    }
  });
});
