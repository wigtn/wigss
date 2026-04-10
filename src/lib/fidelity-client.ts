/**
 * Client-side helpers for the v2.2 fidelity verification loop.
 *
 * The editor owns this loop: after `/api/apply` succeeds and the target page
 * has been re-scanned, we compare the re-measured component bounding boxes to
 * the expectations the refactor pipeline produced. If verification fails the
 * user can roll back via `/api/rollback` with the captured backupId.
 *
 * These helpers are pure / DOM-free so they can be unit-tested directly.
 */

import type {
  BoundingBox,
  ComponentChange,
  DetectedComponent,
  FidelityExpectation,
} from '@/types';

/**
 * Snapshot the current bounding boxes of every component touched by `changes`.
 * Used as the "prior" state that /api/verify needs to validate delta-based
 * properties (marginTop / marginLeft) after re-measurement.
 */
export function capturePriorBoxes(
  changes: ComponentChange[],
  components: DetectedComponent[],
): Record<string, BoundingBox> {
  const result: Record<string, BoundingBox> = {};
  const componentMap = new Map<string, DetectedComponent>();
  for (const component of components) {
    componentMap.set(component.id, component);
  }
  for (const change of changes) {
    if (result[change.componentId]) continue;
    const component = componentMap.get(change.componentId);
    if (!component) continue;
    result[change.componentId] = { ...component.boundingBox };
  }
  return result;
}

/**
 * Build a minimal FidelityExpectation list directly from a batch of
 * ComponentChanges. The refactor pipeline produces richer expectations
 * server-side (via `intentToExpectation`), but the editor only sees diffs,
 * so we reconstruct an equivalent client-side expectation set from the
 * changes themselves.
 *
 * Scope:
 *   - `resize` → width / height from `change.to`
 *   - `move` → marginTop / marginLeft delta
 *   - `targetStyles` passthrough (color/font/border captured by the editor at
 *     drag/resize end, if any) is merged verbatim.
 */
export function buildExpectationsFromChanges(
  changes: ComponentChange[],
  components: DetectedComponent[],
): FidelityExpectation[] {
  const componentMap = new Map<string, DetectedComponent>();
  for (const component of components) {
    componentMap.set(component.id, component);
  }

  // Collapse multiple changes on the same component into a single expectation
  // entry so /api/verify reports once per component.
  const byId = new Map<string, FidelityExpectation>();

  for (const change of changes) {
    const component = componentMap.get(change.componentId);
    if (!component) continue;

    let entry = byId.get(change.componentId);
    if (!entry) {
      entry = {
        componentId: change.componentId,
        expectedStyles: {},
        sourceFile: component.sourceFile ?? '',
      };
      byId.set(change.componentId, entry);
    }

    // Geometry expectations derived from bbox deltas
    if (change.type === 'resize') {
      if (change.to.width != null) {
        entry.expectedStyles.width = `${Math.round(change.to.width)}px`;
      }
      if (change.to.height != null) {
        entry.expectedStyles.height = `${Math.round(change.to.height)}px`;
      }
    } else if (change.type === 'move') {
      const fromX = change.from.x;
      const toX = change.to.x;
      const fromY = change.from.y;
      const toY = change.to.y;
      if (fromX != null && toX != null) {
        const dx = Math.round(toX - fromX);
        if (dx !== 0) entry.expectedStyles.marginLeft = `${dx}px`;
      }
      if (fromY != null && toY != null) {
        const dy = Math.round(toY - fromY);
        if (dy !== 0) entry.expectedStyles.marginTop = `${dy}px`;
      }
    }

    // Editor-captured computed style passthrough (Goal B).
    if (change.targetStyles) {
      for (const [prop, value] of Object.entries(change.targetStyles)) {
        entry.expectedStyles[prop] = value;
      }
    }
  }

  // Drop entries that produced no verifiable styles.
  return Array.from(byId.values()).filter(
    (e) => Object.keys(e.expectedStyles).length > 0,
  );
}

/**
 * Extract bounding boxes keyed by componentId for every component that has
 * a pending expectation. Used as the "actual" argument to /api/verify after
 * the editor has re-scanned the target page.
 */
export function extractActualBoxes(
  componentIds: string[],
  components: DetectedComponent[],
): Record<string, BoundingBox> {
  const wanted = new Set(componentIds);
  const result: Record<string, BoundingBox> = {};
  for (const component of components) {
    if (wanted.has(component.id)) {
      result[component.id] = { ...component.boundingBox };
    }
  }
  return result;
}
