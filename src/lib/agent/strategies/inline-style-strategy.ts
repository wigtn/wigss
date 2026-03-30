import type { CodeDiff, ComponentChange, DetectedComponent } from '@/types';
import { changeToCssProperties } from '@/lib/css-property-utils';
import { findJsxAttributes, findClassNameAttribute } from '@/lib/ast-utils';
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

  // Find the component in source files (AST-based for multi-line support)
  for (const src of sources) {
    if (!src.path.endsWith('.tsx') && !src.path.endsWith('.jsx')) continue;

    // AST: find className attribute
    let classNameFound = false;
    if (fullClassName) {
      const attr = findClassNameAttribute(src.content, fullClassName);
      if (attr) classNameFound = true;
    }

    // Fallback: string-based search
    if (!classNameFound && fullClassName) {
      if (!src.content.includes(`className="${fullClassName}"`)) {
        // Try data-component
        if (component.name && !src.content.includes(`data-component="${component.name}"`)) {
          continue;
        }
      }
    }

    const lines = src.content.split('\n');
    let targetLineIdx = -1;
    if (fullClassName) {
      targetLineIdx = lines.findIndex(line => line.includes(`className="${fullClassName}"`));
    }
    if (targetLineIdx === -1 && component.name) {
      targetLineIdx = lines.findIndex(line =>
        line.includes(`data-component="${component.name}"`) ||
        line.includes(`data-component='${component.name}'`)
      );
    }
    if (targetLineIdx === -1) continue;

    const targetLine = lines[targetLineIdx];

    // AST: find style attributes (handles multi-line style objects)
    const styleAttrs = findJsxAttributes(src.content, 'style');
    // Find style on the same element (near the className location)
    const nearbyStyle = styleAttrs.find(s => {
      const styleLine = src.content.slice(0, s.fullStart).split('\n').length - 1;
      return Math.abs(styleLine - targetLineIdx) <= 3;
    });

    // Fallback to regex for single-line style
    // Normalize to { full, inner } format
    let styleInfo: { full: string; inner: string } | null = null;
    if (nearbyStyle) {
      const full = nearbyStyle.valueText;
      // Extract inner content between {{ and }}
      const innerMatch = full.match(/\{\{\s*([\s\S]*?)\s*\}\}/);
      if (innerMatch) {
        styleInfo = { full: `style=${full}`, inner: innerMatch[1].trim() };
      }
    } else {
      const regexMatch = targetLine.match(/style=\{\{([^}]*)\}\}/);
      if (regexMatch) {
        styleInfo = { full: regexMatch[0], inner: regexMatch[1].trim() };
      }
    }

    let original: string;
    let modified: string;

    if (styleInfo) {
      // Modify existing style attribute
      original = styleInfo.full;
      const existingStyles = styleInfo.inner;
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
