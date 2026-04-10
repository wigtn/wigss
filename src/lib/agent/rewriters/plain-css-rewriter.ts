import type { CodeDiff, SourceInput, SourceRewriter, StyleIntent, TargetLocation } from '@/types';
import { modifyCssRuleAst } from '@/lib/postcss-utils';
import { targetStylesToKebab } from '../intent-adapter';

/**
 * Plain CSS/SCSS rewriter: modifies rules inside regular `.css|.scss` files
 * using postcss AST.
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

    const cssProps = targetStylesToKebab(intent.targetStyles);
    if (Object.keys(cssProps).length === 0) return null;

    const { stylesheetPath, cssClassName } = cssInfo;
    if (!cssClassName) return null;

    const stylesheets = stylesheetPath
      ? sources.filter(s => s.path === stylesheetPath || s.path.endsWith(stylesheetPath))
      : sources.filter(s => s.path.endsWith('.css') || s.path.endsWith('.scss'));

    for (const stylesheet of stylesheets) {
      const result = modifyCssRuleAst(stylesheet.content, cssClassName, cssProps);
      if (!result) continue;

      const explanation = Object.entries(cssProps)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');

      return {
        file: stylesheet.path,
        original: result.ruleOriginal,
        modified: result.ruleModified,
        lineNumber: 0,
        explanation: `.${cssClassName} { ${explanation} }`,
        strategy: 'plain-css',
      };
    }

    console.log(`[PlainCSS] Rule .${cssClassName} not found in any stylesheet`);
    return null;
  },
};
