import { parse } from '@babel/parser';

export interface JsxAttributeLocation {
  name: string;
  valueStart: number;
  valueEnd: number;
  fullStart: number;
  fullEnd: number;
  valueText: string;
  type: 'string-literal' | 'expression' | 'template-literal';
}

/**
 * Parse TSX/JSX and find all occurrences of a specific JSX attribute.
 * Returns position information for precise string splicing.
 */
export function findJsxAttributes(
  source: string,
  attributeName: 'className' | 'style',
): JsxAttributeLocation[] {
  let ast;
  try {
    ast = parse(source, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
      errorRecovery: true,
    });
  } catch (e) {
    console.warn('[ast-utils] Parse failed:', e instanceof Error ? e.message : e);
    return [];
  }

  const results: JsxAttributeLocation[] = [];

  function walk(node: any): void {
    if (!node || typeof node !== 'object') return;

    if (node.type === 'JSXAttribute' && node.name?.name === attributeName && node.value) {
      const value = node.value;
      let type: JsxAttributeLocation['type'] = 'string-literal';
      let valueStart = value.start;
      let valueEnd = value.end;

      if (value.type === 'StringLiteral') {
        type = 'string-literal';
      } else if (value.type === 'JSXExpressionContainer') {
        const expr = value.expression;
        if (expr.type === 'TemplateLiteral') {
          type = 'template-literal';
        } else {
          type = 'expression';
        }
      }

      results.push({
        name: attributeName,
        valueStart,
        valueEnd,
        fullStart: node.start,
        fullEnd: node.end,
        valueText: source.slice(valueStart, valueEnd),
        type,
      });
    }

    // Walk all child nodes
    for (const key of Object.keys(node)) {
      if (key === 'start' || key === 'end' || key === 'loc' || key === 'type') continue;
      const child = node[key];
      if (Array.isArray(child)) {
        for (const item of child) {
          if (item && typeof item === 'object' && item.type) walk(item);
        }
      } else if (child && typeof child === 'object' && child.type) {
        walk(child);
      }
    }
  }

  walk(ast.program);
  return results;
}

/**
 * Position-based string splice: replace characters at [start, end) with replacement.
 * Preserves all formatting outside the replaced range.
 */
export function spliceString(source: string, start: number, end: number, replacement: string): string {
  return source.slice(0, start) + replacement + source.slice(end);
}

/**
 * Find a className attribute whose value matches the given className string.
 * Returns the first match, or null.
 */
export function findClassNameAttribute(
  source: string,
  className: string,
): JsxAttributeLocation | null {
  const attrs = findJsxAttributes(source, 'className');
  for (const attr of attrs) {
    if (attr.type === 'string-literal') {
      // Match: className="flex h-48 ..."
      const innerText = attr.valueText.slice(1, -1); // strip quotes
      if (innerText === className) return attr;
    } else if (attr.type === 'template-literal') {
      // Match within static parts of template literal
      if (attr.valueText.includes(className)) return attr;
    }
  }
  return null;
}
