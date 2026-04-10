import type { CodeDiff, SourceInput, SourceRewriter, StyleIntent, TargetLocation } from '@/types';
import { modifyCssRuleAst } from '@/lib/postcss-utils';
import { targetStylesToKebab } from '../intent-adapter';

/**
 * Check whether an offset into an HTML document is inside a <script> block.
 * Rewriters must never modify script content (CSP + script injection guard).
 */
function isInsideScriptBlock(html: string, offset: number): boolean {
  const scriptRegex = /<script\b[^>]*>[\s\S]*?<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = scriptRegex.exec(html))) {
    if (offset >= match.index && offset < match.index + match[0].length) return true;
  }
  return false;
}

/**
 * Find the opening-tag range of the first HTML element carrying the given class.
 * Returns null if not found or if the element lives inside a <script> block.
 */
function findHtmlElementWithClass(
  html: string,
  className: string,
): { tagStart: number; tagEnd: number; hasStyleAttr: boolean; styleValueRange?: { start: number; end: number } } | null {
  // Match an opening tag that carries class="...className..."
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(
    `<([a-zA-Z][a-zA-Z0-9-]*)\\b[^>]*?class\\s*=\\s*["'][^"']*\\b${escaped}\\b[^"']*["'][^>]*?>`,
    'g',
  );

  let match: RegExpExecArray | null;
  while ((match = regex.exec(html))) {
    if (isInsideScriptBlock(html, match.index)) continue;

    const tagStart = match.index;
    const tagEnd = tagStart + match[0].length;
    const tagText = match[0];

    const styleMatch = tagText.match(/style\s*=\s*["']([^"']*)["']/);
    if (styleMatch && styleMatch.index != null) {
      const valueStartInTag = styleMatch.index + styleMatch[0].indexOf(styleMatch[1]);
      const valueStart = tagStart + valueStartInTag;
      const valueEnd = valueStart + styleMatch[1].length;
      return {
        tagStart,
        tagEnd,
        hasStyleAttr: true,
        styleValueRange: { start: valueStart, end: valueEnd },
      };
    }
    return { tagStart, tagEnd, hasStyleAttr: false };
  }
  return null;
}

/**
 * Merge new CSS declarations into an existing inline `style=""` value.
 * Existing properties are overwritten; new ones are appended.
 */
function mergeInlineStyleValue(existing: string, kebabStyles: Record<string, string>): string {
  const declarations = new Map<string, string>();
  for (const part of existing.split(';')) {
    const [rawKey, ...rest] = part.split(':');
    const key = rawKey?.trim();
    const value = rest.join(':').trim();
    if (key && value) declarations.set(key, value);
  }
  for (const [key, value] of Object.entries(kebabStyles)) {
    declarations.set(key, value);
  }
  return Array.from(declarations.entries())
    .map(([k, v]) => `${k}: ${v}`)
    .join('; ');
}

/**
 * Format a new CSS rule block for appending to a stylesheet.
 */
function formatNewCssRule(selector: string, kebabStyles: Record<string, string>): string {
  const body = Object.entries(kebabStyles)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n');
  return `\n.${selector} {\n${body}\n}\n`;
}

/**
 * Build a diff that replaces a specific byte range in `source`, expanding
 * the captured range until the `original` text is unique in the file.
 * The apply route uses `content.indexOf(original)`; non-unique originals
 * would cause the wrong site to be modified.
 */
function buildRangeDiff(
  source: string,
  innerStart: number,
  innerEnd: number,
  newInner: string,
): { original: string; modified: string } | null {
  let start = innerStart;
  let end = innerEnd;
  const len = source.length;
  for (let attempt = 0; attempt < 64; attempt++) {
    const original = source.slice(start, end);
    const occurrences = source.split(original).length - 1;
    if (occurrences === 1) {
      const prefix = source.slice(start, innerStart);
      const suffix = source.slice(innerEnd, end);
      const modified = prefix + newInner + suffix;
      if (modified === original) return null;
      return { original, modified };
    }
    if (start === 0 && end === len) return null;
    start = Math.max(0, start - 16);
    end = Math.min(len, end + 16);
  }
  return null;
}

/**
 * HTML+CSS rewriter.
 *
 * Applies a StyleIntent to either the linked stylesheet (modify or append a rule)
 * or inline on the HTML element itself (`style=""`). The exact behaviour is
 * driven by whether the stylesheet exists and whether the target class is
 * already defined there.
 *
 * Fidelity guarantee: if no valid write location can be found, returns `null`
 * so the dispatcher can try a downstream fallback.
 */
export const htmlCssRewriter: SourceRewriter = {
  id: 'html-css',
  rewrite(
    _target: TargetLocation,
    intent: StyleIntent,
    sources: SourceInput[],
  ): CodeDiff | null {
    const hint = intent.sourceHint;
    if (!hint?.file) return null;

    const htmlSource = sources.find((s) => s.path === hint.file);
    if (!htmlSource) return null;

    const className = (hint.cssStrategy?.cssClassName || hint.className || '').split(/\s+/)[0];
    if (!className) return null;

    const kebabStyles = targetStylesToKebab(intent.targetStyles);
    if (Object.keys(kebabStyles).length === 0) return null;

    const stylesheetPath = hint.cssStrategy?.stylesheetPath;
    const stylesheet = stylesheetPath
      ? sources.find((s) => s.path === stylesheetPath)
      : undefined;

    // 1. Try to replace an existing rule in the linked stylesheet.
    if (stylesheet) {
      const modifyResult = modifyCssRuleAst(stylesheet.content, className, kebabStyles);
      if (modifyResult) {
        return {
          file: stylesheet.path,
          original: modifyResult.ruleOriginal,
          modified: modifyResult.ruleModified,
          lineNumber: 0,
          explanation: `.${className} { ${Object.entries(kebabStyles)
            .map(([k, v]) => `${k}: ${v}`)
            .join(', ')} }`,
          strategy: 'html-css',
        };
      }

      // 2. Rule missing — append a new one to the stylesheet.
      const newRule = formatNewCssRule(className, kebabStyles);
      const trimmedEnd = stylesheet.content.replace(/\s+$/, '');
      const original = trimmedEnd + stylesheet.content.slice(trimmedEnd.length);
      const modified = `${trimmedEnd}\n${newRule.trimStart()}`;
      if (original === modified) return null;
      return {
        file: stylesheet.path,
        original,
        modified,
        lineNumber: 0,
        explanation: `append new rule .${className}`,
        strategy: 'html-css',
      };
    }

    // 3. No stylesheet available — fall back to inline style on the element.
    const location = findHtmlElementWithClass(htmlSource.content, className);
    if (!location) return null;

    if (location.hasStyleAttr && location.styleValueRange) {
      const existing = htmlSource.content.slice(
        location.styleValueRange.start,
        location.styleValueRange.end,
      );
      const merged = mergeInlineStyleValue(existing, kebabStyles);
      if (merged === existing) return null;

      const diff = buildRangeDiff(
        htmlSource.content,
        location.tagStart,
        location.tagEnd,
        htmlSource.content
          .slice(location.tagStart, location.tagEnd)
          .replace(existing, merged),
      );
      if (!diff) return null;
      return {
        file: htmlSource.path,
        original: diff.original,
        modified: diff.modified,
        lineNumber: 0,
        explanation: `inline style update on .${className}`,
        strategy: 'html-css',
      };
    }

    // No existing style attribute — inject one.
    const originalTag = htmlSource.content.slice(location.tagStart, location.tagEnd);
    const isSelfClosing = originalTag.endsWith('/>');
    const closer = isSelfClosing ? '/>' : '>';
    const body = Object.entries(kebabStyles)
      .map(([k, v]) => `${k}: ${v}`)
      .join('; ');
    const modifiedTag = `${originalTag.slice(0, originalTag.length - closer.length).trimEnd()} style="${body}"${closer}`;

    const diff = buildRangeDiff(htmlSource.content, location.tagStart, location.tagEnd, modifiedTag);
    if (!diff) return null;
    return {
      file: htmlSource.path,
      original: diff.original,
      modified: diff.modified,
      lineNumber: 0,
      explanation: `add inline style on .${className}`,
      strategy: 'html-css',
    };
  },
};
