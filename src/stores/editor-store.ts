import { create } from 'zustand';
import type { DetectedComponent, ComponentChange, CodeDiff, ScanResult } from '@/types';

interface EditorState {
  // Data
  scanResult: ScanResult | null;
  components: DetectedComponent[];
  selectedComponentId: string | null;
  changes: ComponentChange[];
  viewportMode: 'desktop' | 'mobile';
  mobileComponents: DetectedComponent[] | null;
  diffs: CodeDiff[];

  // Canvas history (fabric.js toJSON snapshots)
  canvasSnapshots: object[];
  canvasSnapshotIndex: number;

  // Change history for undo/redo
  history: ComponentChange[][];
  historyIndex: number;

  // Target info
  targetUrl: string;
  projectPath: string;

  // Actions
  setScanResult: (result: ScanResult) => void;
  setComponents: (components: DetectedComponent[]) => void;
  selectComponent: (id: string | null) => void;
  addChange: (change: ComponentChange) => void;
  clearChanges: () => void;
  setViewportMode: (mode: 'desktop' | 'mobile') => void;
  setMobileComponents: (components: DetectedComponent[] | null) => void;
  setDiffs: (diffs: CodeDiff[]) => void;
  setTargetUrl: (url: string) => void;
  setProjectPath: (path: string) => void;

  // Apply a suggested change (update component bounding box)
  applyChange: (change: ComponentChange) => void;

  // Canvas snapshot management
  pushCanvasSnapshot: (snapshot: object) => void;

  // Undo/Redo
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Reset
  reset: () => void;
}

const initialState = {
  scanResult: null,
  components: [],
  selectedComponentId: null,
  changes: [],
  viewportMode: 'desktop' as const,
  mobileComponents: null,
  diffs: [],
  canvasSnapshots: [],
  canvasSnapshotIndex: -1,
  history: [],
  historyIndex: -1,
  targetUrl: 'http://localhost:3001',
  projectPath: '',
};

/**
 * Apply a ComponentChange to a component's boundingBox, returning an updated component.
 */
function applyChangeToComponent(
  component: DetectedComponent,
  change: ComponentChange,
): DetectedComponent {
  const box = { ...component.boundingBox };

  if (change.to.x !== undefined) box.x = change.to.x;
  if (change.to.y !== undefined) box.y = change.to.y;
  if (change.to.width !== undefined) box.width = change.to.width;
  if (change.to.height !== undefined) box.height = change.to.height;

  return { ...component, boundingBox: box };
}

/**
 * Reverse a ComponentChange (restore `from` values) on a component's boundingBox.
 */
function revertChangeOnComponent(
  component: DetectedComponent,
  change: ComponentChange,
): DetectedComponent {
  const box = { ...component.boundingBox };

  if (change.from.x !== undefined) box.x = change.from.x;
  if (change.from.y !== undefined) box.y = change.from.y;
  if (change.from.width !== undefined) box.width = change.from.width;
  if (change.from.height !== undefined) box.height = change.from.height;

  return { ...component, boundingBox: box };
}

export const useEditorStore = create<EditorState>((set, get) => ({
  ...initialState,

  setScanResult: (result) => set({ scanResult: result }),

  setComponents: (components) => set({ components }),

  selectComponent: (id) => set({ selectedComponentId: id }),

  addChange: (change) =>
    set((state) => {
      const newChanges = [...state.changes, change];

      // Truncate any redo history beyond current index, then push new entry
      const truncatedHistory = state.history.slice(0, state.historyIndex + 1);
      const newHistory = [...truncatedHistory, [change]];
      const newHistoryIndex = newHistory.length - 1;

      return {
        changes: newChanges,
        history: newHistory,
        historyIndex: newHistoryIndex,
      };
    }),

  clearChanges: () => set({ changes: [] }),

  setViewportMode: (mode) => set({ viewportMode: mode }),

  setMobileComponents: (components) => set({ mobileComponents: components }),

  setDiffs: (diffs) => set({ diffs }),

  setTargetUrl: (url) => set({ targetUrl: url }),

  setProjectPath: (path) => set({ projectPath: path }),

  applyChange: (change) =>
    set((state) => {
      const components = state.components.map((comp) =>
        comp.id === change.componentId
          ? applyChangeToComponent(comp, change)
          : comp,
      );

      const newChanges = [...state.changes, change];

      // Truncate redo history and push new entry
      const truncatedHistory = state.history.slice(0, state.historyIndex + 1);
      const newHistory = [...truncatedHistory, [change]];
      const newHistoryIndex = newHistory.length - 1;

      return {
        components,
        changes: newChanges,
        history: newHistory,
        historyIndex: newHistoryIndex,
      };
    }),

  pushCanvasSnapshot: (snapshot) =>
    set((state) => {
      // Truncate any snapshots after current index
      const truncated = state.canvasSnapshots.slice(
        0,
        state.canvasSnapshotIndex + 1,
      );
      const newSnapshots = [...truncated, snapshot];

      return {
        canvasSnapshots: newSnapshots,
        canvasSnapshotIndex: newSnapshots.length - 1,
      };
    }),

  undo: () =>
    set((state) => {
      if (state.historyIndex < 0) return state;

      const changesToRevert = state.history[state.historyIndex];
      let components = [...state.components];

      // Revert changes in reverse order
      for (let i = changesToRevert.length - 1; i >= 0; i--) {
        const change = changesToRevert[i];
        components = components.map((comp) =>
          comp.id === change.componentId
            ? revertChangeOnComponent(comp, change)
            : comp,
        );
      }

      // Also step back canvas snapshot if possible
      const canvasSnapshotIndex =
        state.canvasSnapshotIndex > 0
          ? state.canvasSnapshotIndex - 1
          : state.canvasSnapshotIndex;

      return {
        components,
        historyIndex: state.historyIndex - 1,
        canvasSnapshotIndex,
      };
    }),

  redo: () =>
    set((state) => {
      if (state.historyIndex >= state.history.length - 1) return state;

      const nextIndex = state.historyIndex + 1;
      const changesToApply = state.history[nextIndex];
      let components = [...state.components];

      // Re-apply changes in order
      for (const change of changesToApply) {
        components = components.map((comp) =>
          comp.id === change.componentId
            ? applyChangeToComponent(comp, change)
            : comp,
        );
      }

      // Also step forward canvas snapshot if possible
      const canvasSnapshotIndex =
        state.canvasSnapshotIndex < state.canvasSnapshots.length - 1
          ? state.canvasSnapshotIndex + 1
          : state.canvasSnapshotIndex;

      return {
        components,
        historyIndex: nextIndex,
        canvasSnapshotIndex,
      };
    }),

  canUndo: () => get().historyIndex >= 0,

  canRedo: () => get().historyIndex < get().history.length - 1,

  reset: () => set(initialState),
}));
