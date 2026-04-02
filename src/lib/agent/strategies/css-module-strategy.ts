import type { CodeDiff, ComponentChange, DetectedComponent, CssStrategyInfo } from '@/types';
import { changeToCssKebab } from '@/lib/css-property-utils';
import { modifyCssRuleAst, findOrCreateMediaRule } from '@/lib/postcss-utils';
import { isBreakpointName } from '@/lib/breakpoint-utils';
import type { SourceInput } from './tailwind-strategy';

/**
 * CSS Module strategy: modify properties in .module.css files using postcss AST.
 * Supports breakpoint-aware editing via @media queries.
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

  // Breakpoint mode: use @media query
  if (change.breakpoint && isBreakpointName(change.breakpoint)) {
    const result = findOrCreateMediaRule(stylesheet.content, cssClassName, change.breakpoint, cssProps);
    if (!result) {
      console.log(`[CSSModule] Failed to create @media rule for .${cssClassName} at ${change.breakpoint}`);
      return null;
    }

    const explanation = Object.entries(cssProps)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');

    return {
      file: stylesheet.path,
      original: result.original,
      modified: result.modified,
      lineNumber: 0,
      explanation: `@media ${change.breakpoint}: .${cssClassName} { ${explanation} }`,
      strategy: 'css-module',
    };
  }

  // Base mode: modify rule directly
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
