import type { ComponentChange, DetectedComponent, StyleIntent } from '@/types';
import { changeToCssProperties } from '@/lib/css-property-utils';

/**
 * Convert a single ComponentChange into a StyleIntent.
 * Phase 1 scope: derive targetStyles from the bounding-box delta only.
 * Future phases may merge additional computed-style properties captured by the editor.
 */
export function changeToIntent(
  change: ComponentChange,
  component: DetectedComponent | undefined,
): StyleIntent {
  const targetStyles = changeToCssProperties(change);

  const intent: StyleIntent = {
    componentId: change.componentId,
    targetStyles,
  };

  if (component) {
    const hint: StyleIntent['sourceHint'] = {};
    if (component.sourceFile) hint.file = component.sourceFile;
    if (component.fullClassName) hint.className = component.fullClassName;
    if (component.name) hint.componentName = component.name;
    if (component.cssInfo) hint.cssStrategy = component.cssInfo;
    if (Object.keys(hint).length > 0) {
      intent.sourceHint = hint;
    }
  }

  return intent;
}

/**
 * Merge a list of ComponentChanges into intents, one per componentId.
 * Uses the same "first.from + last.to with dimension union" semantics as the
 * existing refactor-client merge pass, then delegates to changeToIntent.
 */
export function changesToIntents(
  changes: ComponentChange[],
  components: Map<string, DetectedComponent>,
): StyleIntent[] {
  const merged = new Map<string, ComponentChange>();
  for (const change of changes) {
    const existing = merged.get(change.componentId);
    if (!existing) {
      merged.set(change.componentId, { ...change, from: { ...change.from }, to: { ...change.to } });
      continue;
    }
    existing.to = { ...existing.to, ...change.to };
    for (const key of ['x', 'y', 'width', 'height'] as const) {
      if (existing.from[key] == null && change.from[key] != null) {
        existing.from[key] = change.from[key];
      }
    }
    if (existing.type !== change.type) {
      const sizeChanged = (existing.to.width ?? 0) !== (existing.from.width ?? 0)
        || (existing.to.height ?? 0) !== (existing.from.height ?? 0);
      const posChanged = (existing.to.x ?? 0) !== (existing.from.x ?? 0)
        || (existing.to.y ?? 0) !== (existing.from.y ?? 0);
      existing.type = sizeChanged && !posChanged ? 'resize' : 'move';
    }
  }

  const intents: StyleIntent[] = [];
  for (const change of merged.values()) {
    const intent = changeToIntent(change, components.get(change.componentId));
    if (Object.keys(intent.targetStyles).length === 0) continue;
    intents.push(intent);
  }
  return intents;
}

/**
 * Convert a camelCase CSS property name to kebab-case.
 * Rewriters targeting .css / .scss files use this to translate StyleIntent keys.
 */
export function toKebabCase(camel: string): string {
  return camel.replace(/([A-Z])/g, '-$1').toLowerCase();
}

/**
 * Produce a kebab-cased copy of `targetStyles` for CSS-file rewriters.
 */
export function targetStylesToKebab(targetStyles: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(targetStyles)) {
    out[toKebabCase(key)] = value;
  }
  return out;
}
