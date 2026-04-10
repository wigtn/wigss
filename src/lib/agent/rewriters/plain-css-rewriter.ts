import type { CodeDiff, SourceInput, SourceRewriter, StyleIntent, TargetLocation } from '@/types';
import { refactorPlainCss } from '../strategies/plain-css-strategy';
import { synthFromIntent } from './synth-from-intent';

/**
 * Plain CSS rewriter: modifies rules inside regular `.css|.scss` files.
 */
export const plainCssRewriter: SourceRewriter = {
  id: 'plain-css',
  rewrite(
    _target: TargetLocation,
    intent: StyleIntent,
    sources: SourceInput[],
  ): CodeDiff | null {
    const cssInfo = intent.sourceHint?.cssStrategy;
    if (!cssInfo) return null;
    const { change, component } = synthFromIntent(intent);
    return refactorPlainCss(change, component, sources, cssInfo);
  },
};
