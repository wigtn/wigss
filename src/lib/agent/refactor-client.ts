import type {
  CodeDiff,
  ComponentChange,
  DetectedComponent,
  FidelityExpectation,
  SourceInput,
  StyleIntent,
} from '@/types';
import { detectCssStrategy } from '@/lib/css-strategy-detector';
import { changesToIntents } from './intent-adapter';
import { dispatchIntent } from './dispatcher';
import { intentToExpectation } from './verify/fidelity-check';

export type { SourceInput };

/**
 * Generate code diffs for a batch of ComponentChanges.
 *
 * Pipeline (v2.2):
 *   ComponentChange[] → merge → StyleIntent[] → dispatchIntent → CodeDiff[]
 *
 * CSS strategy detection runs here (not in the adapter) because it needs
 * access to the source files, and the result is passed through
 * `intent.sourceHint.cssStrategy` to downstream rewriters.
 */
export async function generateRefactorDiffs(input: {
  changes: ComponentChange[];
  components: DetectedComponent[];
  sources: SourceInput[];
}): Promise<CodeDiff[]> {
  const { diffs } = await generateRefactorResult(input);
  return diffs;
}

/**
 * Richer variant of `generateRefactorDiffs` that also returns the fidelity
 * expectations for each successful diff. Editor callers that want to run the
 * post-apply verification loop should use this instead.
 */
export async function generateRefactorResult(input: {
  changes: ComponentChange[];
  components: DetectedComponent[];
  sources: SourceInput[];
}): Promise<{ diffs: CodeDiff[]; expectations: FidelityExpectation[] }> {
  const componentMap = new Map<string, DetectedComponent>();
  for (const component of input.components) {
    // Ensure each component has a resolved cssInfo before intent construction.
    // This preserves the existing `component.cssInfo ?? detectCssStrategy(...)` behaviour.
    const enriched: DetectedComponent = {
      ...component,
      cssInfo: component.cssInfo ?? detectCssStrategy(component, input.sources),
    };
    componentMap.set(component.id, enriched);
  }

  const intents: StyleIntent[] = changesToIntents(input.changes, componentMap);

  const diffs: CodeDiff[] = [];
  const expectations: FidelityExpectation[] = [];
  const failed: StyleIntent[] = [];

  for (const intent of intents) {
    const diff = dispatchIntent(intent, input.sources);
    if (diff) {
      diffs.push(diff);
      expectations.push(
        intentToExpectation(intent, intent.sourceHint?.file ?? diff.file),
      );
    } else {
      failed.push(intent);
    }
  }

  console.log(`[Refactor] ${diffs.length} diffs generated. ${failed.length} skipped.`);
  for (const intent of failed) {
    console.log(`[Refactor] Skipped: ${intent.sourceHint?.componentName ?? intent.componentId}`);
  }

  return { diffs, expectations };
}
