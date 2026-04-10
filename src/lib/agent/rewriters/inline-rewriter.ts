import type { CodeDiff, SourceInput, SourceRewriter, StyleIntent, TargetLocation } from '@/types';
import { refactorInlineStyle } from '../strategies/inline-style-strategy';
import { synthFromIntent } from './synth-from-intent';

/**
 * Inline style rewriter: modifies/adds `style={{...}}` on a JSX element.
 * Serves as the universal fallback for any language/strategy whose preferred
 * rewriter cannot resolve an intent.
 */
export const inlineRewriter: SourceRewriter = {
  id: 'inline-style',
  rewrite(
    _target: TargetLocation,
    intent: StyleIntent,
    sources: SourceInput[],
  ): CodeDiff | null {
    const { change, component } = synthFromIntent(intent);
    return refactorInlineStyle(change, component, sources);
  },
};
