import type { CodeDiff, ComponentChange, DetectedComponent, CssStrategyInfo } from '@/types';
import { changeToCssKebab } from '@/lib/css-property-utils';
import { modifyCssRuleAst } from '@/lib/postcss-utils';
import type { SourceInput } from './tailwind-strategy';

/**
 * Plain CSS/SCSS strategy: modify properties in regular .css/.scss files using postcss AST.
 */
export function refactorPlainCss(
  change: ComponentChange,
  component: DetectedComponent,
  sources: SourceInput[],
  cssInfo: CssStrategyInfo,
): CodeDiff | null {
  const cssProps = changeToCssKebab(change);
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
}
