import type { CodeDiff, ComponentChange, DetectedComponent } from '@/types';
import { findClassNameAttribute } from '@/lib/ast-utils';

export type SourceInput = { path: string; content: string };

// ── Tailwind px↔class mapping ──
const TW_MAP: Record<number, string> = {
  0:'0', 2:'0.5', 4:'1', 6:'1.5', 8:'2', 10:'2.5', 12:'3', 14:'3.5',
  16:'4', 20:'5', 24:'6', 28:'7', 32:'8', 36:'9', 40:'10', 44:'11',
  48:'12', 56:'14', 64:'16', 80:'20', 96:'24', 112:'28', 128:'32',
  160:'40', 192:'48', 224:'56', 256:'64', 288:'72', 320:'80', 384:'96',
};

export function pxToTw(px: number, prefix: string): string {
  const closest = Object.keys(TW_MAP).map(Number)
    .reduce((prev, curr) => Math.abs(curr - px) < Math.abs(prev - px) ? curr : prev, 0);
  if (Math.abs(closest - px) <= 2) return `${prefix}-${TW_MAP[closest]}`;
  return `${prefix}-[${Math.round(px)}px]`;
}

const TW_REVERSE = new Map(Object.entries(TW_MAP).map(([px, tw]) => [tw, Number(px)]));

function parseTwPx(twClass: string, prefix: string): number {
  const bracketMatch = twClass.match(/\[(\d+)px\]/);
  if (bracketMatch) return parseInt(bracketMatch[1]);
  const twNum = twClass.replace(new RegExp(`^-?${prefix}-`), '');
  return TW_REVERSE.get(twNum) ?? parseInt(twNum) * 4;
}

function findTwClass(className: string, prefix: string): string | null {
  const escaped = prefix.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const regex = new RegExp(`(?:^|\\s)-?${escaped}-(?:\\[\\d+px\\]|\\d+\\.?\\d*)(?=\\s|$)`);
  const match = className.match(regex);
  return match ? match[0].trim() : null;
}

export function refactorTailwind(
  change: ComponentChange,
  component: DetectedComponent,
  sources: SourceInput[],
): CodeDiff | null {
  const fullClassName = component.fullClassName || '';
  if (!fullClassName) return null;

  // AST-based: find className attribute precisely (handles multi-line, template literals)
  let targetSource: SourceInput | null = null;
  let targetLineNumber = 0;
  for (const src of sources) {
    const attr = findClassNameAttribute(src.content, fullClassName);
    if (attr) {
      targetSource = src;
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

  if (!targetSource && component.sourceFile) {
    targetSource = sources.find(s => s.path === component.sourceFile) || null;
  }

  if (!targetSource) {
    console.log(`[Tailwind] Cannot find "${fullClassName.slice(0, 40)}..." in any source file`);
    return null;
  }

  const replacements: { old: string; new: string }[] = [];
  const additions: string[] = [];
  const explanation: string[] = [];

  if (change.type === 'resize') {
    const dw = (change.to.width ?? 0) - (change.from.width ?? 0);
    const dh = (change.to.height ?? 0) - (change.from.height ?? 0);

    if (Math.abs(dh) > 2) {
      const hClass = findTwClass(fullClassName, 'h');
      if (hClass) {
        const hNew = pxToTw(change.to.height!, 'h');
        replacements.push({ old: hClass, new: hNew });
        explanation.push(`높이: ${hClass} → ${hNew}`);
      } else {
        const pyClass = findTwClass(fullClassName, 'py');
        if (pyClass) {
          const currentPy = parseInt(pyClass.replace(/\D/g, '') || '0');
          const newPy = Math.max(0, currentPy + Math.round(dh / 2));
          const pyNew = pxToTw(newPy, 'py');
          replacements.push({ old: pyClass, new: pyNew });
          explanation.push(`패딩: ${pyClass} → ${pyNew}`);
        } else {
          const hAdded = pxToTw(change.to.height!, 'h');
          additions.push(hAdded);
          explanation.push(`높이 추가: ${hAdded}`);
        }
      }
    }

    if (Math.abs(dw) > 2) {
      const wClass = findTwClass(fullClassName, 'w');
      if (wClass) {
        const wNew = pxToTw(change.to.width!, 'w');
        replacements.push({ old: wClass, new: wNew });
        explanation.push(`너비: ${wClass} → ${wNew}`);
      } else {
        const pxClass = findTwClass(fullClassName, 'px');
        if (pxClass) {
          const currentPx = parseInt(pxClass.replace(/\D/g, '') || '0');
          const newPx = Math.max(0, currentPx + Math.round(dw / 2));
          const pxNew = pxToTw(newPx, 'px');
          replacements.push({ old: pxClass, new: pxNew });
          explanation.push(`패딩: ${pxClass} → ${pxNew}`);
        } else {
          const wAdded = pxToTw(change.to.width!, 'w');
          additions.push(wAdded);
          explanation.push(`너비 추가: ${wAdded}`);
        }
      }
    }
  }

  if (change.type === 'move') {
    const dy = (change.to.y ?? 0) - (change.from.y ?? 0);
    const dx = (change.to.x ?? 0) - (change.from.x ?? 0);

    if (Math.abs(dy) > 2) {
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

    if (Math.abs(dx) > 2) {
      const mlClass = findTwClass(fullClassName, 'ml');
      if (mlClass) {
        const currentPx = parseTwPx(mlClass, 'ml');
        const newPx = Math.max(0, currentPx + Math.round(dx));
        const mlNew = pxToTw(newPx, 'ml');
        replacements.push({ old: mlClass, new: mlNew });
        explanation.push(`마진: ${mlClass} → ${mlNew}`);
      } else {
        const hClass = dx > 0
          ? `ml-[${Math.round(dx)}px]`
          : `-translate-x-[${Math.abs(Math.round(dx))}px]`;
        additions.push(hClass);
        explanation.push(dx > 0 ? `마진 추가: ${hClass}` : `이동: ${hClass}`);
      }
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

  const originalLine = `className="${fullClassName}"`;
  const modifiedLine = `className="${modifiedClassName}"`;

  if (!targetSource.content.includes(originalLine)) return null;

  return {
    file: targetSource.path,
    original: originalLine,
    modified: modifiedLine,
    lineNumber: targetLineNumber,
    explanation: explanation.join(', '),
    strategy: 'tailwind',
  };
}
