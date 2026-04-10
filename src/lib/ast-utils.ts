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

  // Babel AST nodes are typed loosely at our walker boundary; we narrow
  // via `type` discriminants and a minimal structural alias.
  type AstNode = {
    type?: string;
    start?: number | null;
    end?: number | null;
    name?: { name?: string };
    value?: AstNode;
    expression?: AstNode;
    [key: string]: unknown;
  };

  function walk(node: AstNode | null | undefined): void {
    if (!node || typeof node !== 'object') return;

    if (node.type === 'JSXAttribute' && node.name?.name === attributeName && node.value) {
      const value = node.value;
      let type: JsxAttributeLocation['type'] = 'string-literal';
      const valueStart = value.start ?? 0;
      const valueEnd = value.end ?? 0;

      if (value.type === 'StringLiteral') {
        type = 'string-literal';
      } else if (value.type === 'JSXExpressionContainer') {
        const expr = value.expression;
        if (expr?.type === 'TemplateLiteral') {
          type = 'template-literal';
        } else {
          type = 'expression';
        }
      }

      results.push({
        name: attributeName,
        valueStart,
        valueEnd,
        fullStart: node.start ?? 0,
        fullEnd: node.end ?? 0,
        valueText: source.slice(valueStart, valueEnd),
        type,
      });
    }

    // Walk all child nodes
    for (const key of Object.keys(node)) {
      if (key === 'start' || key === 'end' || key === 'loc' || key === 'type') continue;
      const child = (node as Record<string, unknown>)[key];
      if (Array.isArray(child)) {
        for (const item of child) {
          if (item && typeof item === 'object' && (item as AstNode).type) walk(item as AstNode);
        }
      } else if (child && typeof child === 'object' && (child as AstNode).type) {
        walk(child as AstNode);
      }
    }
  }

  walk(ast.program as unknown as AstNode);
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
