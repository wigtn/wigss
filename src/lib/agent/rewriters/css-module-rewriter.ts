import type { CodeDiff, SourceInput, SourceRewriter, StyleIntent, TargetLocation } from '@/types';
import { refactorCssModule } from '../strategies/css-module-strategy';
import { synthFromIntent } from './synth-from-intent';

/**
 * CSS Module rewriter: modifies rules inside a `.module.css|scss` file.
 */
export const cssModuleRewriter: SourceRewriter = {
  id: 'css-module',
  rewrite(
    _target: TargetLocation,
    intent: StyleIntent,
    sources: SourceInput[],
  ): CodeDiff | null {
    const cssInfo = intent.sourceHint?.cssStrategy;
    if (!cssInfo) return null;
    const { change, component } = synthFromIntent(intent);
    return refactorCssModule(change, component, sources, cssInfo);
  },
};
