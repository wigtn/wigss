import type { CodeDiff, SourceInput, SourceRewriter, StyleIntent, TargetLocation } from '@/types';
import { findJsxAttributes, findClassNameAttribute } from '@/lib/ast-utils';

/**
 * Inline style rewriter: modifies or adds `style={{...}}` attributes on a JSX
 * element. Serves as the universal fallback for any language/strategy whose
 * preferred rewriter cannot resolve an intent.
 *
 * Operates directly on StyleIntent.targetStyles (camelCase JS properties).
 */
export const inlineRewriter: SourceRewriter = {
  id: 'inline-style',
  rewrite(
    _target: TargetLocation,
    intent: StyleIntent,
    sources: SourceInput[],
  ): CodeDiff | null {
    const fullClassName = intent.sourceHint?.className || '';
    const componentName = intent.sourceHint?.componentName || '';
    const cssProps = intent.targetStyles;

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
          if (componentName && !src.content.includes(`data-component="${componentName}"`)) {
            continue;
          }
        }
      }

      const lines = src.content.split('\n');
      let targetLineIdx = -1;
      if (fullClassName) {
        targetLineIdx = lines.findIndex(line => line.includes(`className="${fullClassName}"`));
      }
      if (targetLineIdx === -1 && componentName) {
        targetLineIdx = lines.findIndex(line =>
          line.includes(`data-component="${componentName}"`) ||
          line.includes(`data-component='${componentName}'`)
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
        // Balanced brace matching for nested objects (e.g., style={{ transform: `translate(${x}px)` }})
        const styleIdx = targetLine.indexOf('style={{');
        if (styleIdx !== -1) {
          let braceCount = 0;
          const start = styleIdx + 6; // position of first {
          let end = start;
          for (let i = start; i < targetLine.length; i++) {
            if (targetLine[i] === '{') braceCount++;
            if (targetLine[i] === '}') braceCount--;
            if (braceCount === 0) {
              end = i + 1;
              break;
            }
          }
          const full = targetLine.slice(styleIdx, end);
          const inner = targetLine.slice(styleIdx + 8, end - 2).trim();
          styleInfo = { full, inner };
        }
      }

      let original: string;
      let modified: string;

      if (styleInfo) {
        // Modify existing style attribute
        original = styleInfo.full;
        const existingStyles = styleInfo.inner;

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
  },
};
