import type { CodeDiff, SourceInput } from '@/types';
import { pxToTw } from '../strategies/tailwind-strategy';
import { findClassNameAttribute } from '@/lib/ast-utils';

/**
 * Determine whether a project uses Tailwind by looking for a tailwind config file.
 */
export function projectUsesTailwind(sources: SourceInput[]): boolean {
  return sources.some((s) =>
    /(^|\/)tailwind\.config\.(js|mjs|cjs|ts)$/.test(s.path),
  );
}

/**
 * Parse an inline JSX style body like `height: '256px', width: '100px'` into a
 * plain record. Returns null if the body looks too complex (expressions,
 * template literals, unquoted values).
 */
function parseInlineStyleBody(body: string): Record<string, string> | null {
  const props: Record<string, string> = {};
  const trimmed = body.trim().replace(/,$/, '');
  if (!trimmed) return props;
  const parts = trimmed.split(',');
  for (const part of parts) {
    const match = part.trim().match(/^([a-zA-Z][a-zA-Z0-9]*)\s*:\s*['"]([^'"]+)['"]$/);
    if (!match) return null;
    props[match[1]] = match[2];
  }
  return props;
}

/**
 * Try to map a single (camelCase) CSS property + value to a Tailwind utility class.
 * Returns null if the value doesn't correspond to a Tailwind preset bucket.
 *
 * Phase 4 covers the common height/width/margin cases that are produced by
 * `changeToCssProperties`. Colour, typography, border, etc. are punted to
 * follow-up work.
 */
function cssPropToTailwindPreset(prop: string, value: string): string | null {
  const pxMatch = value.match(/^(-?\d+(?:\.\d+)?)px$/);
  if (!pxMatch) return null;
  const px = parseFloat(pxMatch[1]);

  const prefix = ((): string | null => {
    switch (prop) {
      case 'height':
        return 'h';
      case 'width':
        return 'w';
      case 'marginTop':
        return 'mt';
      case 'marginLeft':
        return 'ml';
      case 'marginRight':
        return 'mr';
      case 'marginBottom':
        return 'mb';
      default:
        return null;
    }
  })();
  if (!prefix) return null;

  const cls = pxToTw(px, prefix);
  // pxToTw falls back to arbitrary values like `h-[257px]`. We only accept
  // exact preset matches for cleanup safety.
  if (cls.includes('[')) return null;
  return cls;
}

/**
 * Remove any existing Tailwind classes that would conflict with the new ones,
 * so cleanup never leaves duplicates on the same element (M-5 from PRD review).
 */
function removeConflictingClasses(className: string, newClasses: string[]): string {
  const conflicts = new Set<string>();
  for (const c of newClasses) {
    const dash = c.indexOf('-');
    if (dash === -1) continue;
    conflicts.add(c.slice(0, dash + 1));
  }
  return className
    .split(/\s+/)
    .filter((token) => {
      for (const prefix of conflicts) {
        if (token.startsWith(prefix)) return false;
      }
      return true;
    })
    .filter(Boolean)
    .join(' ');
}

/**
 * Attempt to rewrite an `inline-style` CodeDiff into a Tailwind className diff.
 * Returns the original diff untouched if any step fails — cleanup is best-effort
 * and must never introduce a worse diff than what dispatch produced.
 */
export function tailwindCleanupPass(diff: CodeDiff, sources: SourceInput[]): CodeDiff {
  if (diff.strategy !== 'inline-style') return diff;
  if (!projectUsesTailwind(sources)) return diff;

  // Locate the source file that contains the diff's original snippet.
  const source = sources.find((s) => s.content.includes(diff.original));
  if (!source) return diff;

  // Extract the inline style body from `modified` and `original`.
  const styleMatch = diff.modified.match(/style=\{\{\s*([^}]+)\s*\}\}/);
  if (!styleMatch) return diff;
  const props = parseInlineStyleBody(styleMatch[1]);
  if (!props || Object.keys(props).length === 0) return diff;

  // Try to map every property to a preset Tailwind utility.
  const newClasses: string[] = [];
  for (const [prop, value] of Object.entries(props)) {
    const cls = cssPropToTailwindPreset(prop, value);
    if (!cls) return diff; // Partial match → bail out, keep original diff
    newClasses.push(cls);
  }

  // Find the className attribute in the source to know what to rewrite.
  // We need *some* className on the target element to attach new classes to.
  // The diff's `original` contains `className="..."` — pull it out.
  const classNameMatch = diff.original.match(/className\s*=\s*["']([^"']*)["']/);
  if (!classNameMatch) return diff;
  const existingClassName = classNameMatch[1];

  const attr = findClassNameAttribute(source.content, existingClassName);
  if (!attr || attr.type !== 'string-literal') return diff;

  const cleaned = removeConflictingClasses(existingClassName, newClasses);
  const mergedClassName = [cleaned, ...newClasses].filter(Boolean).join(' ').trim();
  if (mergedClassName === existingClassName) return diff;

  // Rebuild the diff: className="..." swap only. No style attribute.
  const original = `className="${existingClassName}"`;
  const modified = `className="${mergedClassName}"`;
  if (!source.content.includes(original)) return diff;
  // Uniqueness guard — if the className literal is duplicated, bail rather than
  // risk a wrong-site rewrite.
  if (source.content.split(original).length - 1 !== 1) return diff;

  return {
    file: source.path,
    original,
    modified,
    lineNumber: diff.lineNumber,
    explanation: `tailwind cleanup: ${newClasses.join(' ')}`,
    strategy: 'tailwind',
  };
}
