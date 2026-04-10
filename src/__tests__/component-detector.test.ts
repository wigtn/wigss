import { describe, it, expect } from 'vitest';
import { detectComponents, type RawScanElement } from '../lib/component-detector';

function makeElement(overrides: Partial<RawScanElement> = {}): RawScanElement {
  return {
    id: 'el-1',
    tagName: 'div',
    className: 'flex p-4',
    boundingBox: { x: 0, y: 0, width: 800, height: 200 },
    visible: true,
    attributes: {},
    textContent: '',
    depth: 1,
    childCount: 0,
    computedStyle: {
      display: 'flex',
      position: 'relative',
      flexDirection: 'row',
    },
    ...overrides,
  };
}

describe('component-detector: detectComponents', () => {
  it('should detect a nav element as navbar type', () => {
    const elements: RawScanElement[] = [
      makeElement({
        id: 'nav-1',
        tagName: 'nav',
        className: 'flex items-center px-6 py-4 bg-white shadow',
        boundingBox: { x: 0, y: 0, width: 1200, height: 64 },
        attributes: { role: 'navigation' },
      }),
    ];

    const comps = detectComponents(elements);

    expect(comps.length).toBeGreaterThanOrEqual(1);
    const nav = comps.find(c => c.type === 'navbar');
    expect(nav).toBeDefined();
    expect(nav!.fullClassName).toBe('flex items-center px-6 py-4 bg-white shadow');
  });

  it('should detect a header element', () => {
    const elements: RawScanElement[] = [
      makeElement({
        id: 'header-1',
        tagName: 'header',
        className: 'w-full bg-blue-500 text-white',
        boundingBox: { x: 0, y: 0, width: 1200, height: 80 },
      }),
    ];

    const comps = detectComponents(elements);
    const header = comps.find(c => c.type === 'header');
    expect(header).toBeDefined();
  });

  it('should detect a footer element', () => {
    const elements: RawScanElement[] = [
      makeElement({
        id: 'footer-1',
        tagName: 'footer',
        className: 'mt-auto py-8 bg-gray-900 text-white',
        boundingBox: { x: 0, y: 800, width: 1200, height: 100 },
      }),
    ];

    const comps = detectComponents(elements);
    const footer = comps.find(c => c.type === 'footer');
    expect(footer).toBeDefined();
  });

  it('should detect a form element', () => {
    const elements: RawScanElement[] = [
      makeElement({
        id: 'form-1',
        tagName: 'form',
        className: 'flex flex-col gap-4 p-6',
        boundingBox: { x: 100, y: 200, width: 400, height: 300 },
      }),
    ];

    const comps = detectComponents(elements);
    const form = comps.find(c => c.type === 'form');
    expect(form).toBeDefined();
  });

  it('should detect element with data-component attribute', () => {
    const elements: RawScanElement[] = [
      makeElement({
        id: 'hero-1',
        tagName: 'section',
        className: 'h-96 flex items-center justify-center',
        boundingBox: { x: 0, y: 64, width: 1200, height: 384 },
        attributes: { 'data-component': 'Hero' },
      }),
    ];

    const comps = detectComponents(elements);

    expect(comps.length).toBeGreaterThanOrEqual(1);
    const hero = comps.find(c => c.name.includes('Hero') || c.type === 'hero');
    expect(hero).toBeDefined();
  });

  it('should populate fullClassName for all detected components', () => {
    const elements: RawScanElement[] = [
      makeElement({
        id: 'nav-1',
        tagName: 'nav',
        className: 'flex px-6 py-4 bg-white',
        boundingBox: { x: 0, y: 0, width: 1200, height: 64 },
      }),
      makeElement({
        id: 'section-1',
        tagName: 'section',
        className: 'py-12 px-8 bg-gray-50',
        boundingBox: { x: 0, y: 64, width: 1200, height: 400 },
      }),
    ];

    const comps = detectComponents(elements);

    for (const comp of comps) {
      expect(comp.fullClassName).toBeDefined();
      expect(typeof comp.fullClassName).toBe('string');
      expect(comp.fullClassName!.length).toBeGreaterThan(0);
    }
  });

  it('should detect flex/grid layout containers', () => {
    const elements: RawScanElement[] = [
      makeElement({
        id: 'grid-container',
        tagName: 'div',
        className: 'grid grid-cols-3 gap-4 p-6',
        boundingBox: { x: 50, y: 200, width: 1100, height: 600 },
        childCount: 3,
        depth: 1,
        computedStyle: { display: 'grid', position: 'relative', flexDirection: '' },
      }),
      makeElement({
        id: 'card-1',
        tagName: 'div',
        className: 'p-4 bg-white rounded shadow',
        boundingBox: { x: 50, y: 200, width: 350, height: 200 },
        parentId: 'grid-container',
        depth: 2,
      }),
      makeElement({
        id: 'card-2',
        tagName: 'div',
        className: 'p-4 bg-white rounded shadow',
        boundingBox: { x: 410, y: 200, width: 350, height: 200 },
        parentId: 'grid-container',
        depth: 2,
      }),
      makeElement({
        id: 'card-3',
        tagName: 'div',
        className: 'p-4 bg-white rounded shadow',
        boundingBox: { x: 770, y: 200, width: 350, height: 200 },
        parentId: 'grid-container',
        depth: 2,
      }),
    ];

    const comps = detectComponents(elements);
    expect(comps.length).toBeGreaterThanOrEqual(1);
    // Should detect either as grid or card type
    const gridOrCards = comps.filter(c => c.type === 'grid' || c.type === 'card');
    expect(gridOrCards.length).toBeGreaterThanOrEqual(1);
  });

  it('should return empty array for no visible elements', () => {
    const elements: RawScanElement[] = [
      makeElement({
        id: 'hidden',
        visible: false,
        boundingBox: { x: 0, y: 0, width: 0, height: 0 },
      }),
    ];

    const comps = detectComponents(elements);
    expect(comps).toHaveLength(0);
  });

  it('should filter out elements below minimum size threshold', () => {
    const elements: RawScanElement[] = [
      makeElement({
        id: 'tiny',
        tagName: 'span',
        className: 'text-xs',
        boundingBox: { x: 0, y: 0, width: 50, height: 20 }, // below 150x60 threshold
      }),
    ];

    const comps = detectComponents(elements);
    expect(comps).toHaveLength(0);
  });
});
