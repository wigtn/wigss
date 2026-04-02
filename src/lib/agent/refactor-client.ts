import type { CodeDiff, ComponentChange, DetectedComponent } from '@/types';
import { detectCssStrategy } from '@/lib/css-strategy-detector';
import { refactorTailwind, type SourceInput } from './strategies/tailwind-strategy';
import { refactorInlineStyle } from './strategies/inline-style-strategy';
import { refactorCssModule } from './strategies/css-module-strategy';
import { refactorPlainCss } from './strategies/plain-css-strategy';

export type { SourceInput };

function dispatchRefactor(
  change: ComponentChange,
  component: DetectedComponent,
  sources: SourceInput[],
): CodeDiff | null {
  const cssInfo = component.cssInfo ?? detectCssStrategy(component, sources);

  // Inline style + breakpoint mode: responsive editing not possible
  if (change.breakpoint && (cssInfo.strategy === 'inline-style')) {
    console.log(`[Refactor] Inline style does not support breakpoint editing (${change.breakpoint})`);
    return null;
  }

  switch (cssInfo.strategy) {
    case 'tailwind':
      return refactorTailwind(change, component, sources);
    case 'inline-style':
      return refactorInlineStyle(change, component, sources);
    case 'css-module':
      return refactorCssModule(change, component, sources, cssInfo);
    case 'plain-css':
      return refactorPlainCss(change, component, sources, cssInfo);
    default:
      // Universal fallback: inline style (skip if breakpoint mode)
      if (change.breakpoint) return null;
      return refactorInlineStyle(change, component, sources);
  }
}

export async function generateRefactorDiffs(input: {
  changes: ComponentChange[];
  components: DetectedComponent[];
  sources: SourceInput[];
}): Promise<CodeDiff[]> {
  const componentMap = new Map(input.components.map((c) => [c.id, c]));

  const latestChanges = new Map<string, ComponentChange>();
  for (const change of input.changes) {
    latestChanges.set(change.componentId, change);
  }

  const diffs: CodeDiff[] = [];
  const failedChanges: ComponentChange[] = [];

  for (const change of latestChanges.values()) {
    const component = componentMap.get(change.componentId);
    if (!component) continue;

    const diff = dispatchRefactor(change, component, input.sources);
    if (diff) {
      diffs.push(diff);
    } else {
      failedChanges.push(change);
    }
  }

  console.log(`[Refactor] ${diffs.length} diffs generated. ${failedChanges.length} skipped.`);

  for (const change of failedChanges) {
    const comp = componentMap.get(change.componentId);
    console.log(`[Refactor] Skipped: ${comp?.name || change.componentId}`);
  }

  return diffs;
}
