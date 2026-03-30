import type { CodeDiff, ComponentChange, DetectedComponent, CssStrategyInfo } from '@/types';
import { changeToCssKebab, findCssRule, modifyCssRule } from '@/lib/css-property-utils';
import type { SourceInput } from './tailwind-strategy';

/**
 * CSS Module strategy: modify properties in .module.css files.
 * e.g., className={styles.card} → find .card { } in Card.module.css → modify height/width
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

  // Find the stylesheet in sources
  const stylesheet = sources.find(s => s.path === stylesheetPath || s.path.endsWith(stylesheetPath));
  if (!stylesheet) {
    console.log(`[CSSModule] Stylesheet not found: ${stylesheetPath}`);
    return null;
  }

  const rule = findCssRule(stylesheet.content, cssClassName);
  if (!rule) {
    console.log(`[CSSModule] Rule .${cssClassName} not found in ${stylesheetPath}`);
    return null;
  }

  const modifiedRule = modifyCssRule(rule.ruleText, cssProps);
  if (modifiedRule === rule.ruleText) return null;

  const explanation = Object.entries(cssProps)
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ');

  return {
    file: stylesheet.path,
    original: rule.ruleText,
    modified: modifiedRule,
    lineNumber: rule.startLine,
    explanation: `.${cssClassName} { ${explanation} }`,
    strategy: 'css-module',
  };
}
