import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from '../stores/editor-store';
import type { DetectedComponent, ComponentChange, ScanResult, CodeDiff } from '../types';

function makeComponent(id: string, overrides: Partial<DetectedComponent> = {}): DetectedComponent {
  return {
    id, name: `Comp ${id}`, type: 'section', elementIds: [id],
    boundingBox: { x: 0, y: 0, width: 200, height: 100 },
    sourceFile: '', reasoning: '', ...overrides,
  };
}

function makeChange(componentId: string, type: 'move' | 'resize' = 'move'): ComponentChange {
  if (type === 'move') {
    return { componentId, type, from: { x: 0, y: 0 }, to: { x: 10, y: 20 } };
  }
  return { componentId, type, from: { width: 200, height: 100 }, to: { width: 300, height: 150 } };
}

describe('editor-store', () => {
  beforeEach(() => {
    useEditorStore.getState().reset();
  });

  describe('initial state', () => {
    it('has correct defaults', () => {
      const state = useEditorStore.getState();
      expect(state.scanResult).toBeNull();
      expect(state.components).toEqual([]);
      expect(state.selectedComponentId).toBeNull();
      expect(state.hoveredComponentId).toBeNull();
      expect(state.changes).toEqual([]);
      expect(state.viewportMode).toBe('desktop');
      expect(state.mobileComponents).toBeNull();
      expect(state.diffs).toEqual([]);
      expect(state.canvasSnapshots).toEqual([]);
      expect(state.canvasSnapshotIndex).toBe(-1);
      expect(state.history).toEqual([]);
      expect(state.historyIndex).toBe(-1);
      expect(state.targetUrl).toBe('http://localhost:3001');
      expect(state.projectPath).toBe('');
    });
  });

  describe('setScanResult / setComponents', () => {
    it('stores scan result', () => {
      const result: ScanResult = { url: 'http://test', timestamp: 123, elements: [], sourceFiles: [] };
      useEditorStore.getState().setScanResult(result);
      expect(useEditorStore.getState().scanResult).toEqual(result);
    });

    it('stores components array', () => {
      const comps = [makeComponent('c1'), makeComponent('c2')];
      useEditorStore.getState().setComponents(comps);
      expect(useEditorStore.getState().components).toHaveLength(2);
      expect(useEditorStore.getState().components[0].id).toBe('c1');
    });
  });

  describe('selectComponent / hoverComponent', () => {
    it('sets selectedComponentId', () => {
      useEditorStore.getState().selectComponent('c1');
      expect(useEditorStore.getState().selectedComponentId).toBe('c1');
    });

    it('clears selection with null', () => {
      useEditorStore.getState().selectComponent('c1');
      useEditorStore.getState().selectComponent(null);
      expect(useEditorStore.getState().selectedComponentId).toBeNull();
    });

    it('sets hoveredComponentId', () => {
      useEditorStore.getState().hoverComponent('c2');
      expect(useEditorStore.getState().hoveredComponentId).toBe('c2');
    });
  });

  describe('addChange', () => {
    it('adds change to changes array', () => {
      const change = makeChange('c1');
      useEditorStore.getState().addChange(change);
      expect(useEditorStore.getState().changes).toHaveLength(1);
      expect(useEditorStore.getState().changes[0]).toEqual(change);
    });

    it('pushes to history and increments historyIndex', () => {
      useEditorStore.getState().addChange(makeChange('c1'));
      expect(useEditorStore.getState().history).toHaveLength(1);
      expect(useEditorStore.getState().historyIndex).toBe(0);
    });

    it('truncates redo history beyond current index', () => {
      useEditorStore.getState().addChange(makeChange('c1'));
      useEditorStore.getState().addChange(makeChange('c1'));
      useEditorStore.getState().undo(); // historyIndex = 0
      // Adding a new change should remove the second entry
      useEditorStore.getState().addChange(makeChange('c2'));
      expect(useEditorStore.getState().history).toHaveLength(2);
      expect(useEditorStore.getState().historyIndex).toBe(1);
    });
  });

  describe('applyChange', () => {
    it('updates component boundingBox with move change', () => {
      const comp = makeComponent('c1');
      useEditorStore.getState().setComponents([comp]);
      useEditorStore.getState().applyChange({
        componentId: 'c1', type: 'move',
        from: { x: 0, y: 0 }, to: { x: 50, y: 30 },
      });
      const updated = useEditorStore.getState().components[0];
      expect(updated.boundingBox.x).toBe(50);
      expect(updated.boundingBox.y).toBe(30);
    });

    it('updates component boundingBox with resize change', () => {
      const comp = makeComponent('c1');
      useEditorStore.getState().setComponents([comp]);
      useEditorStore.getState().applyChange({
        componentId: 'c1', type: 'resize',
        from: { width: 200, height: 100 }, to: { width: 400, height: 250 },
      });
      const updated = useEditorStore.getState().components[0];
      expect(updated.boundingBox.width).toBe(400);
      expect(updated.boundingBox.height).toBe(250);
    });

    it('does not affect other components', () => {
      useEditorStore.getState().setComponents([makeComponent('c1'), makeComponent('c2')]);
      useEditorStore.getState().applyChange({
        componentId: 'c1', type: 'move',
        from: { x: 0 }, to: { x: 100 },
      });
      const c2 = useEditorStore.getState().components[1];
      expect(c2.boundingBox.x).toBe(0);
    });

    it('adds to changes and history', () => {
      useEditorStore.getState().setComponents([makeComponent('c1')]);
      useEditorStore.getState().applyChange(makeChange('c1'));
      expect(useEditorStore.getState().changes).toHaveLength(1);
      expect(useEditorStore.getState().history).toHaveLength(1);
      expect(useEditorStore.getState().historyIndex).toBe(0);
    });
  });

  describe('undo / redo', () => {
    it('undo reverts last change on component', () => {
      useEditorStore.getState().setComponents([makeComponent('c1')]);
      useEditorStore.getState().applyChange({
        componentId: 'c1', type: 'move',
        from: { x: 0, y: 0 }, to: { x: 50, y: 30 },
      });
      useEditorStore.getState().undo();
      const comp = useEditorStore.getState().components[0];
      expect(comp.boundingBox.x).toBe(0);
      expect(comp.boundingBox.y).toBe(0);
    });

    it('undo decrements historyIndex', () => {
      useEditorStore.getState().addChange(makeChange('c1'));
      useEditorStore.getState().addChange(makeChange('c1'));
      expect(useEditorStore.getState().historyIndex).toBe(1);
      useEditorStore.getState().undo();
      expect(useEditorStore.getState().historyIndex).toBe(0);
    });

    it('redo re-applies change', () => {
      useEditorStore.getState().setComponents([makeComponent('c1')]);
      useEditorStore.getState().applyChange({
        componentId: 'c1', type: 'move',
        from: { x: 0, y: 0 }, to: { x: 50, y: 30 },
      });
      useEditorStore.getState().undo();
      useEditorStore.getState().redo();
      const comp = useEditorStore.getState().components[0];
      expect(comp.boundingBox.x).toBe(50);
      expect(comp.boundingBox.y).toBe(30);
    });

    it('redo increments historyIndex', () => {
      useEditorStore.getState().addChange(makeChange('c1'));
      useEditorStore.getState().undo();
      expect(useEditorStore.getState().historyIndex).toBe(-1);
      useEditorStore.getState().redo();
      expect(useEditorStore.getState().historyIndex).toBe(0);
    });

    it('canUndo returns false when historyIndex < 0', () => {
      expect(useEditorStore.getState().canUndo()).toBe(false);
    });

    it('canRedo returns false at end of history', () => {
      useEditorStore.getState().addChange(makeChange('c1'));
      expect(useEditorStore.getState().canRedo()).toBe(false);
    });

    it('multiple undo/redo cycles are consistent', () => {
      useEditorStore.getState().setComponents([makeComponent('c1')]);
      useEditorStore.getState().applyChange({
        componentId: 'c1', type: 'move',
        from: { x: 0, y: 0 }, to: { x: 10, y: 10 },
      });
      useEditorStore.getState().applyChange({
        componentId: 'c1', type: 'move',
        from: { x: 10, y: 10 }, to: { x: 20, y: 20 },
      });
      // Undo both
      useEditorStore.getState().undo();
      useEditorStore.getState().undo();
      expect(useEditorStore.getState().components[0].boundingBox.x).toBe(0);
      // Redo both
      useEditorStore.getState().redo();
      useEditorStore.getState().redo();
      expect(useEditorStore.getState().components[0].boundingBox.x).toBe(20);
    });
  });

  describe('memory limits', () => {
    it('history caps at MAX_HISTORY (50)', () => {
      for (let i = 0; i < 60; i++) {
        useEditorStore.getState().addChange(makeChange(`c${i}`));
      }
      expect(useEditorStore.getState().history.length).toBeLessThanOrEqual(50);
    });

    it('canvasSnapshots caps at MAX_CANVAS_SNAPSHOTS (20)', () => {
      for (let i = 0; i < 25; i++) {
        useEditorStore.getState().pushCanvasSnapshot({ id: i });
      }
      expect(useEditorStore.getState().canvasSnapshots.length).toBeLessThanOrEqual(20);
    });
  });

  describe('pushCanvasSnapshot', () => {
    it('stores snapshot and increments index', () => {
      useEditorStore.getState().pushCanvasSnapshot({ data: 'snap1' });
      expect(useEditorStore.getState().canvasSnapshots).toHaveLength(1);
      expect(useEditorStore.getState().canvasSnapshotIndex).toBe(0);
    });
  });

  describe('setViewportMode / setMobileComponents', () => {
    it('sets viewport mode', () => {
      useEditorStore.getState().setViewportMode('mobile');
      expect(useEditorStore.getState().viewportMode).toBe('mobile');
    });

    it('sets mobile components', () => {
      const comps = [makeComponent('m1')];
      useEditorStore.getState().setMobileComponents(comps);
      expect(useEditorStore.getState().mobileComponents).toHaveLength(1);
    });
  });

  describe('other setters', () => {
    it('setDiffs stores diffs', () => {
      const diffs: CodeDiff[] = [{ file: 'a.tsx', original: 'a', modified: 'b', lineNumber: 1, explanation: 'test' }];
      useEditorStore.getState().setDiffs(diffs);
      expect(useEditorStore.getState().diffs).toHaveLength(1);
    });

    it('setTargetUrl stores url', () => {
      useEditorStore.getState().setTargetUrl('http://example.com');
      expect(useEditorStore.getState().targetUrl).toBe('http://example.com');
    });

    it('setProjectPath stores path', () => {
      useEditorStore.getState().setProjectPath('/tmp/project');
      expect(useEditorStore.getState().projectPath).toBe('/tmp/project');
    });

    it('clearChanges empties changes array', () => {
      useEditorStore.getState().addChange(makeChange('c1'));
      useEditorStore.getState().clearChanges();
      expect(useEditorStore.getState().changes).toEqual([]);
    });
  });

  describe('reset', () => {
    it('returns to initial state', () => {
      useEditorStore.getState().setComponents([makeComponent('c1')]);
      useEditorStore.getState().addChange(makeChange('c1'));
      useEditorStore.getState().selectComponent('c1');
      useEditorStore.getState().reset();

      const state = useEditorStore.getState();
      expect(state.components).toEqual([]);
      expect(state.changes).toEqual([]);
      expect(state.selectedComponentId).toBeNull();
      expect(state.historyIndex).toBe(-1);
    });
  });
});
