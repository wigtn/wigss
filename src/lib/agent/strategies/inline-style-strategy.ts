import type { CodeDiff, ComponentChange, DetectedComponent } from '@/types';
import { changeToCssProperties } from '@/lib/css-property-utils';
import type { SourceInput } from './tailwind-strategy';

/**
 * Inline style strategy: modify or add style={{...}} attributes.
 * Works for any React component, serves as universal fallback.
 */
export function refactorInlineStyle(
  change: ComponentChange,
  component: DetectedComponent,
  sources: SourceInput[],
): CodeDiff | null {
  const fullClassName = (component as any).fullClassName || '';
  const cssProps = changeToCssProperties(change);

  if (Object.keys(cssProps).length === 0) return null;

  // Find the component in source files
  for (const src of sources) {
    if (!src.path.endsWith('.tsx') && !src.path.endsWith('.jsx')) continue;
    const lines = src.content.split('\n');

    // Try matching by className first
    let targetLineIdx = -1;
    if (fullClassName) {
      targetLineIdx = lines.findIndex(line => line.includes(`className="${fullClassName}"`));
    }

    // Fallback: match by data-component attribute
    if (targetLineIdx === -1 && component.name) {
      targetLineIdx = lines.findIndex(line =>
        line.includes(`data-component="${component.name}"`) ||
        line.includes(`data-component='${component.name}'`)
      );
    }

    if (targetLineIdx === -1) continue;

    const targetLine = lines[targetLineIdx];

    // Check if style={{...}} already exists on this line or nearby
    const styleMatch = targetLine.match(/style=\{\{([^}]*)\}\}/);

    let original: string;
    let modified: string;

    if (styleMatch) {
      // Modify existing style attribute
      original = styleMatch[0];
      const existingStyles = styleMatch[1].trim();
      const newStyles = Object.entries(cssProps)
        .map(([k, v]) => `${k}: '${v}'`)
        .join(', ');

      // Replace existing properties or append
      let updatedStyles = existingStyles;
      for (const [prop, value] of Object.entries(cssProps)) {
        const propRegex = new RegExp(`${prop}\\s*:\\s*['"][^'"]*['"]`);
        if (propRegex.test(updatedStyles)) {
          updatedStyles = updatedStyles.replace(propRegex, `${prop}: '${value}'`);
        } else {
          updatedStyles = updatedStyles ? `${updatedStyles}, ${prop}: '${value}'` : `${prop}: '${value}'`;
        }
      }

      modified = `style={{ ${updatedStyles} }}`;
    } else {
      // Add new style attribute
      const styleStr = Object.entries(cssProps)
        .map(([k, v]) => `${k}: '${v}'`)
        .join(', ');

      // Insert style before the closing > of the tag
      if (fullClassName && targetLine.includes(`className="${fullClassName}"`)) {
        original = `className="${fullClassName}"`;
        modified = `className="${fullClassName}" style={{ ${styleStr} }}`;
      } else {
        // Find the closing > or /> on the line
        const closingMatch = targetLine.match(/(\/?>)/);
        if (!closingMatch) continue;
        original = closingMatch[0];
        modified = `style={{ ${styleStr} }} ${closingMatch[0]}`;
      }
    }

    if (!src.content.includes(original)) continue;

    const explanation = Object.entries(cssProps)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');

    return {
      file: src.path,
      original,
      modified,
      lineNumber: targetLineIdx + 1,
      explanation: `inline style: ${explanation}`,
      strategy: 'inline-style',
    };
  }

  return null;
}
