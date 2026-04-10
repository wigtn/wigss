import { describe, it, expect } from 'vitest';
import {
  buildExpectationsFromChanges,
  capturePriorBoxes,
  extractActualBoxes,
} from '../lib/fidelity-client';
import type { ComponentChange, DetectedComponent } from '../types';

function makeComponent(id: string, box: { x: number; y: number; width: number; height: number }): DetectedComponent {
  return {
    id,
    name: id,
    type: 'section',
    elementIds: [id],
    boundingBox: box,
    sourceFile: `src/${id}.tsx`,
    reasoning: '',
  };
}

describe('fidelity-client', () => {
  describe('capturePriorBoxes', () => {
    it('snapshots only components referenced by changes', () => {
      const components = [
        makeComponent('a', { x: 10, y: 20, width: 100, height: 40 }),
        makeComponent('b', { x: 0, y: 0, width: 50, height: 30 }),
      ];
      const changes: ComponentChange[] = [
        { componentId: 'a', type: 'move', from: { x: 10, y: 20 }, to: { x: 15, y: 25 } },
      ];
      const result = capturePriorBoxes(changes, components);
      expect(result).toEqual({ a: { x: 10, y: 20, width: 100, height: 40 } });
      expect(result.b).toBeUndefined();
    });

    it('deduplicates multiple changes on the same component', () => {
      const components = [makeComponent('a', { x: 1, y: 2, width: 3, height: 4 })];
      const changes: ComponentChange[] = [
        { componentId: 'a', type: 'move', from: { x: 1, y: 2 }, to: { x: 2, y: 3 } },
        { componentId: 'a', type: 'resize', from: { width: 3, height: 4 }, to: { width: 10, height: 20 } },
      ];
      const result = capturePriorBoxes(changes, components);
      expect(result.a).toEqual({ x: 1, y: 2, width: 3, height: 4 });
    });

    it('ignores changes that reference unknown components', () => {
      const components = [makeComponent('a', { x: 0, y: 0, width: 10, height: 10 })];
      const changes: ComponentChange[] = [
        { componentId: 'missing', type: 'move', from: { x: 0, y: 0 }, to: { x: 5, y: 5 } },
      ];
      expect(capturePriorBoxes(changes, components)).toEqual({});
    });
  });

  describe('buildExpectationsFromChanges', () => {
    it('builds width/height expectations for resize', () => {
      const components = [makeComponent('a', { x: 0, y: 0, width: 100, height: 50 })];
      const changes: ComponentChange[] = [
        { componentId: 'a', type: 'resize', from: { width: 100, height: 50 }, to: { width: 200, height: 80 } },
      ];
      const exp = buildExpectationsFromChanges(changes, components);
      expect(exp).toHaveLength(1);
      expect(exp[0].componentId).toBe('a');
      expect(exp[0].expectedStyles).toEqual({ width: '200px', height: '80px' });
      expect(exp[0].sourceFile).toBe('src/a.tsx');
    });

    it('builds marginTop/marginLeft deltas for move', () => {
      const components = [makeComponent('a', { x: 10, y: 20, width: 100, height: 50 })];
      const changes: ComponentChange[] = [
        { componentId: 'a', type: 'move', from: { x: 10, y: 20 }, to: { x: 30, y: 45 } },
      ];
      const exp = buildExpectationsFromChanges(changes, components);
      expect(exp[0].expectedStyles).toEqual({
        marginLeft: '20px',
        marginTop: '25px',
      });
    });

    it('merges targetStyles passthrough into expectations', () => {
      const components = [makeComponent('a', { x: 0, y: 0, width: 10, height: 10 })];
      const changes: ComponentChange[] = [
        {
          componentId: 'a',
          type: 'resize',
          from: { width: 10, height: 10 },
          to: { width: 20, height: 20 },
          targetStyles: { color: '#ff0000', fontSize: '16px' },
        },
      ];
      const exp = buildExpectationsFromChanges(changes, components);
      expect(exp[0].expectedStyles).toMatchObject({
        width: '20px',
        height: '20px',
        color: '#ff0000',
        fontSize: '16px',
      });
    });

    it('collapses multiple changes for the same component', () => {
      const components = [makeComponent('a', { x: 0, y: 0, width: 10, height: 10 })];
      const changes: ComponentChange[] = [
        { componentId: 'a', type: 'move', from: { x: 0, y: 0 }, to: { x: 5, y: 0 } },
        { componentId: 'a', type: 'resize', from: { width: 10, height: 10 }, to: { width: 30, height: 30 } },
      ];
      const exp = buildExpectationsFromChanges(changes, components);
      expect(exp).toHaveLength(1);
      expect(exp[0].expectedStyles).toMatchObject({
        marginLeft: '5px',
        width: '30px',
        height: '30px',
      });
    });

    it('filters out components with no verifiable styles', () => {
      const components = [makeComponent('a', { x: 0, y: 0, width: 10, height: 10 })];
      // Zero-delta move → nothing to verify
      const changes: ComponentChange[] = [
        { componentId: 'a', type: 'move', from: { x: 0, y: 0 }, to: { x: 0, y: 0 } },
      ];
      expect(buildExpectationsFromChanges(changes, components)).toEqual([]);
    });

    it('skips changes whose component is not in the list', () => {
      const components: DetectedComponent[] = [];
      const changes: ComponentChange[] = [
        { componentId: 'missing', type: 'resize', from: { width: 1, height: 1 }, to: { width: 2, height: 2 } },
      ];
      expect(buildExpectationsFromChanges(changes, components)).toEqual([]);
    });
  });

  describe('extractActualBoxes', () => {
    it('returns bounding boxes for matching ids', () => {
      const components = [
        makeComponent('a', { x: 1, y: 2, width: 3, height: 4 }),
        makeComponent('b', { x: 5, y: 6, width: 7, height: 8 }),
        makeComponent('c', { x: 9, y: 10, width: 11, height: 12 }),
      ];
      const result = extractActualBoxes(['a', 'c'], components);
      expect(Object.keys(result).sort()).toEqual(['a', 'c']);
      expect(result.a).toEqual({ x: 1, y: 2, width: 3, height: 4 });
      expect(result.c).toEqual({ x: 9, y: 10, width: 11, height: 12 });
    });

    it('returns an empty object when nothing matches', () => {
      const components = [makeComponent('a', { x: 0, y: 0, width: 1, height: 1 })];
      expect(extractActualBoxes(['b'], components)).toEqual({});
    });
  });
});
