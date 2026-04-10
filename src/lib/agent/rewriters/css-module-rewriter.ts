import type { CodeDiff, SourceInput, SourceRewriter, StyleIntent, TargetLocation } from '@/types';
import { modifyCssRuleAst } from '@/lib/postcss-utils';
import { targetStylesToKebab } from '../intent-adapter';

/**
 * CSS Module rewriter: modifies rules inside a `.module.css|scss` file using
 * postcss AST.
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

    const cssProps = targetStylesToKebab(intent.targetStyles);
    if (Object.keys(cssProps).length === 0) return null;

    const { stylesheetPath, cssClassName } = cssInfo;
    if (!stylesheetPath || !cssClassName) return null;

    const stylesheet = sources.find(
      s => s.path === stylesheetPath || s.path.endsWith('/' + stylesheetPath),
    );
    if (!stylesheet) {
      console.log(`[CSSModule] Stylesheet not found: ${stylesheetPath}`);
      return null;
    }

    const result = modifyCssRuleAst(stylesheet.content, cssClassName, cssProps);
    if (!result) {
      console.log(`[CSSModule] Rule .${cssClassName} not found in ${stylesheetPath}`);
      return null;
    }

    const explanation = Object.entries(cssProps)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');

    return {
      file: stylesheet.path,
      original: result.ruleOriginal,
      modified: result.ruleModified,
      lineNumber: 0,
      explanation: `.${cssClassName} { ${explanation} }`,
      strategy: 'css-module',
    };
  },
};
