import type { CodeDiff, SourceInput, SourceRewriter, StyleIntent, TargetLocation } from '@/types';
import { findClassNameAttribute, type JsxAttributeLocation } from '@/lib/ast-utils';
import { pxToTw, parseTwPx, findTwClass } from './tailwind-utils';

/**
 * Parse a px string like "256px" into a number. Returns null if invalid.
 */
function parsePx(value: string | undefined): number | null {
  if (value == null) return null;
  const match = value.match(/^(-?\d+(?:\.\d+)?)px$/);
  if (!match) return null;
  return parseFloat(match[1]);
}

/**
 * Tailwind rewriter: modifies JSX className utility classes.
 *
 * Operates directly on StyleIntent.targetStyles. Intent convention (matching
 * changeToCssProperties):
 *   - targetStyles.width/height  → absolute px values (e.g. "256px")
 *   - targetStyles.marginTop/Left → delta px values (signed, e.g. "-20px")
 */
export const tailwindRewriter: SourceRewriter = {
  id: 'tailwind',
  rewrite(
    _target: TargetLocation,
    intent: StyleIntent,
    sources: SourceInput[],
  ): CodeDiff | null {
    const fullClassName = intent.sourceHint?.className || '';
    if (!fullClassName) return null;

    const ts = intent.targetStyles;
    const targetHeight = parsePx(ts.height);
    const targetWidth = parsePx(ts.width);
    const dy = parsePx(ts.marginTop) ?? 0;
    const dx = parsePx(ts.marginLeft) ?? 0;

    // AST-based: find className attribute precisely (handles multi-line, template literals)
    let targetSource: SourceInput | null = null;
    let targetLineNumber = 0;
    let targetAttr: JsxAttributeLocation | null = null;
    for (const src of sources) {
      const attr = findClassNameAttribute(src.content, fullClassName);
      if (attr) {
        targetSource = src;
        targetAttr = attr;
        // Calculate line number from character position
        targetLineNumber = src.content.slice(0, attr.fullStart).split('\n').length;
        break;
      }
    }

    // Fallback: string-based search for non-parseable files
    if (!targetSource) {
      for (const src of sources) {
        const lines = src.content.split('\n');
        const lineIdx = lines.findIndex(line => line.includes(`className="${fullClassName}"`));
        if (lineIdx !== -1) {
          targetSource = src;
          targetLineNumber = lineIdx + 1;
          break;
        }
      }
    }

    const sourceFile = intent.sourceHint?.file;
    if (!targetSource && sourceFile) {
      targetSource = sources.find(s => s.path === sourceFile) || null;
    }

    if (!targetSource) {
      console.log(`[Tailwind] Cannot find "${fullClassName.slice(0, 40)}..." in any source file`);
      return null;
    }

    const replacements: { old: string; new: string }[] = [];
    const additions: string[] = [];
    const explanation: string[] = [];

    // ── Dimension changes (height / width) ──
    // Note: intent conveys absolute target px; the legacy py/px "padding as
    // height/width fallback" branch used dh/2 against the existing padding
    // value. We preserve the same call shape (dh ≈ targetHeight since synth
    // treated from as zero) so the v2.2 pipeline matches pre-migration
    // behavior byte-for-byte.
    if (targetHeight != null) {
      const hClass = findTwClass(fullClassName, 'h');
      if (hClass) {
        const hNew = pxToTw(targetHeight, 'h');
        replacements.push({ old: hClass, new: hNew });
        explanation.push(`높이: ${hClass} → ${hNew}`);
      } else {
        const pyClass = findTwClass(fullClassName, 'py');
        if (pyClass) {
          const currentPy = parseInt(pyClass.replace(/\D/g, '') || '0');
          const newPy = Math.max(0, currentPy + Math.round(targetHeight / 2));
          const pyNew = pxToTw(newPy, 'py');
          replacements.push({ old: pyClass, new: pyNew });
          explanation.push(`패딩: ${pyClass} → ${pyNew}`);
        } else {
          const hAdded = pxToTw(targetHeight, 'h');
          additions.push(hAdded);
          explanation.push(`높이 추가: ${hAdded}`);
        }
      }
    }

    if (targetWidth != null) {
      const wClass = findTwClass(fullClassName, 'w');
      if (wClass) {
        const wNew = pxToTw(targetWidth, 'w');
        replacements.push({ old: wClass, new: wNew });
        explanation.push(`너비: ${wClass} → ${wNew}`);
      } else {
        const pxClass = findTwClass(fullClassName, 'px');
        if (pxClass) {
          const currentPx = parseInt(pxClass.replace(/\D/g, '') || '0');
          const newPx = Math.max(0, currentPx + Math.round(targetWidth / 2));
          const pxNew = pxToTw(newPx, 'px');
          replacements.push({ old: pxClass, new: pxNew });
          explanation.push(`패딩: ${pxClass} → ${pxNew}`);
        } else {
          const wAdded = pxToTw(targetWidth, 'w');
          additions.push(wAdded);
          explanation.push(`너비 추가: ${wAdded}`);
        }
      }
    }

    // ── Position changes (margin deltas) ──
    if (dy !== 0) {
      const mtClass = findTwClass(fullClassName, 'mt');
      if (mtClass) {
        const currentPx = parseTwPx(mtClass, 'mt');
        const newPx = Math.max(0, currentPx + Math.round(dy));
        const mtNew = pxToTw(newPx, 'mt');
        replacements.push({ old: mtClass, new: mtNew });
        explanation.push(`마진: ${mtClass} → ${mtNew}`);
      } else {
        const mbClass = findTwClass(fullClassName, 'mb');
        if (mbClass) {
          const currentPx = parseTwPx(mbClass, 'mb');
          const newPx = Math.max(0, currentPx - Math.round(dy));
          const mbNew = pxToTw(newPx, 'mb');
          replacements.push({ old: mbClass, new: mbNew });
          explanation.push(`마진: ${mbClass} → ${mbNew}`);
        } else {
          if (dy > 0) {
            const added = `mt-[${Math.round(dy)}px]`;
            additions.push(added);
            explanation.push(`마진 추가: ${added}`);
          } else {
            const added = `-translate-y-[${Math.abs(Math.round(dy))}px]`;
            additions.push(added);
            explanation.push(`이동: ${added}`);
          }
        }
      }
    }

    if (dx !== 0) {
      const mlClass = findTwClass(fullClassName, 'ml');
      if (mlClass) {
        const currentPx = parseTwPx(mlClass, 'ml');
        const newPx = Math.max(0, currentPx + Math.round(dx));
        const mlNew = pxToTw(newPx, 'ml');
        replacements.push({ old: mlClass, new: mlNew });
        explanation.push(`마진: ${mlClass} → ${mlNew}`);
      } else {
        const added = dx > 0
          ? `ml-[${Math.round(dx)}px]`
          : `-translate-x-[${Math.abs(Math.round(dx))}px]`;
        additions.push(added);
        explanation.push(dx > 0 ? `마진 추가: ${added}` : `이동: ${added}`);
      }
    }

    if (replacements.length === 0 && additions.length === 0) return null;

    // Build modified className by applying all replacements and additions
    let modifiedClassName = fullClassName;
    for (const r of replacements) {
      if (r.old !== r.new) {
        modifiedClassName = modifiedClassName.replace(r.old, r.new);
      }
    }
    if (additions.length > 0) {
      modifiedClassName = `${modifiedClassName} ${additions.join(' ')}`;
    }

    if (modifiedClassName === fullClassName) return null;

    // Prefer AST-span replacement: uses the exact source text of the className
    // attribute value, which handles multi-line strings, template literals,
    // single vs double quotes, and duplicate classNames in the same file.
    let original: string;
    let modified: string;

    if (targetAttr) {
      if (targetAttr.type === 'string-literal') {
        original = targetAttr.valueText;
        const quote = original[0];
        modified = `${quote}${modifiedClassName}${quote}`;
      } else if (targetAttr.type === 'template-literal') {
        // Splice the fullClassName inside the template literal's static part.
        const replaced = targetAttr.valueText.replace(fullClassName, modifiedClassName);
        if (replaced === targetAttr.valueText) return null;
        original = targetAttr.valueText;
        modified = replaced;
      } else {
        // expression-based className (e.g. clsx(...)) — not safe to mutate
        return null;
      }

      // Uniqueness guard: if valueText appears more than once, fall back to
      // full-attribute splice (attribute start..end) to disambiguate.
      const occurrences = targetSource.content.split(original).length - 1;
      if (occurrences > 1) {
        const fullAttrText = targetSource.content.slice(targetAttr.fullStart, targetAttr.fullEnd);
        original = fullAttrText;
        modified = fullAttrText.slice(0, targetAttr.valueStart - targetAttr.fullStart)
          + modified
          + fullAttrText.slice(targetAttr.valueEnd - targetAttr.fullStart);
      }
    } else {
      // Non-AST fallback path
      original = `className="${fullClassName}"`;
      modified = `className="${modifiedClassName}"`;
      if (!targetSource.content.includes(original)) return null;
    }

    return {
      file: targetSource.path,
      original,
      modified,
      lineNumber: targetLineNumber,
      explanation: explanation.join(', '),
      strategy: 'tailwind',
    };
  },
};
