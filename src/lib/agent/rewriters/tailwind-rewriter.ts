import type { CodeDiff, SourceInput, SourceRewriter, StyleIntent, TargetLocation } from '@/types';
import { refactorTailwind } from '../strategies/tailwind-strategy';
import { synthFromIntent } from './synth-from-intent';

/**
 * Tailwind rewriter: modifies JSX className utility classes.
 * Phase 2 delegates to the legacy strategy function via a synthetic ComponentChange.
 */
export const tailwindRewriter: SourceRewriter = {
  id: 'tailwind',
  rewrite(
    _target: TargetLocation,
    intent: StyleIntent,
    sources: SourceInput[],
  ): CodeDiff | null {
    const { change, component } = synthFromIntent(intent);
    return refactorTailwind(change, component, sources);
  },
};
