import type { CodeDiff, ComponentChange, DetectedComponent, CssStrategyInfo } from '@/types';
import { changeToCssKebab, findCssRule, modifyCssRule } from '@/lib/css-property-utils';
import type { SourceInput } from './tailwind-strategy';

/**
 * Plain CSS/SCSS strategy: modify properties in regular .css/.scss files.
 * e.g., className="card" → find .card { } in styles.css → modify height/width
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

  // Find the stylesheet — explicit path or search all CSS files
  const stylesheets = stylesheetPath
    ? sources.filter(s => s.path === stylesheetPath || s.path.endsWith(stylesheetPath))
    : sources.filter(s => s.path.endsWith('.css') || s.path.endsWith('.scss'));

  for (const stylesheet of stylesheets) {
    const rule = findCssRule(stylesheet.content, cssClassName);
    if (!rule) continue;

    const modifiedRule = modifyCssRule(rule.ruleText, cssProps);
    if (modifiedRule === rule.ruleText) continue;

    const explanation = Object.entries(cssProps)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');

    return {
      file: stylesheet.path,
      original: rule.ruleText,
      modified: modifiedRule,
      lineNumber: rule.startLine,
      explanation: `.${cssClassName} { ${explanation} }`,
      strategy: 'plain-css',
    };
  }

  console.log(`[PlainCSS] Rule .${cssClassName} not found in any stylesheet`);
  return null;
}
