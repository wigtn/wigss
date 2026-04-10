import type { CodeDiff, SourceInput, SourceRewriter, StyleIntent, TargetLocation } from '@/types';
import { tailwindRewriter } from './rewriters/tailwind-rewriter';
import { inlineRewriter } from './rewriters/inline-rewriter';
import { cssModuleRewriter } from './rewriters/css-module-rewriter';
import { plainCssRewriter } from './rewriters/plain-css-rewriter';
import { htmlCssRewriter } from './rewriters/html-css-rewriter';
import { tailwindCleanupPass } from './cleanup/tailwind-cleanup';

/**
 * Registry of rewriters keyed by CSS strategy. Each language/strategy can
 * have a preferred rewriter; inline is the universal JSX fallback.
 */
const REWRITERS: Record<string, SourceRewriter> = {
  tailwind: tailwindRewriter,
  'inline-style': inlineRewriter,
  'css-module': cssModuleRewriter,
  'plain-css': plainCssRewriter,
  'html-css': htmlCssRewriter,
};

/**
 * Placeholder target. Phase 2 rewriters delegate to legacy strategies that
 * perform their own source discovery, so the target here is decorative.
 * Phase 3+ locators will produce real ranges.
 */
function placeholderTarget(intent: StyleIntent, sources: SourceInput[]): TargetLocation {
  const file = intent.sourceHint?.file ?? sources[0]?.path ?? '';
  return {
    file,
    range: { start: 0, end: 0 },
    writeMode: 'replace-attribute',
  };
}

/**
 * Dispatch a StyleIntent to the appropriate rewriter.
 * Fallback cascade:
 *   1. preferred rewriter (from sourceHint.cssStrategy.strategy)
 *   2. inline rewriter (universal JSX fallback)
 */
export function dispatchIntent(
  intent: StyleIntent,
  sources: SourceInput[],
): CodeDiff | null {
  if (Object.keys(intent.targetStyles).length === 0) return null;

  const strategy = intent.sourceHint?.cssStrategy?.strategy;
  const target = placeholderTarget(intent, sources);

  const preferred = strategy ? REWRITERS[strategy] : undefined;
  if (preferred) {
    const diff = preferred.rewrite(target, intent, sources);
    if (diff) return tailwindCleanupPass(diff, sources);
  }

  // Universal JSX fallback: inline style. Skip for HTML sources — the
  // html-css rewriter already owns its own inline fallback path, and the
  // JSX inline rewriter would emit `style={{}}` syntax into an .html file.
  if (preferred !== inlineRewriter && strategy !== 'html-css') {
    const diff = inlineRewriter.rewrite(target, intent, sources);
    if (diff) return tailwindCleanupPass(diff, sources);
  }

  return null;
}
