import type { CodeDiff, ComponentChange, DetectedComponent, CssStrategyInfo } from '@/types';
import { changeToCssKebab } from '@/lib/css-property-utils';
import { modifyCssRuleAst } from '@/lib/postcss-utils';
import type { SourceInput } from './tailwind-strategy';

/**
 * CSS Module strategy: modify properties in .module.css files using postcss AST.
 */
export function refactorCssModule(
  change: ComponentChange,
  component: DetectedComponent,
  sources: SourceInput[],
  cssInfo: CssStrategyInfo,
): CodeDiff | null {
  const cssProps = changeToCssKebab(change);
  if (Object.keys(cssProps).length === 0) return null;

  const { stylesheetPath, cssClassName } = cssInfo;
  if (!stylesheetPath || !cssClassName) return null;

  const stylesheet = sources.find(s => s.path === stylesheetPath || s.path.endsWith(stylesheetPath));
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
}
