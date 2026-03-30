import type { CodeDiff, ComponentChange, DetectedComponent } from '@/types';

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
  const fullClassName = (component as any).fullClassName || '';
  if (!fullClassName) return null;

  let targetSource: SourceInput | null = null;
  let targetLineNumber = 0;
  for (const src of sources) {
    const lines = src.content.split('\n');
    const lineIdx = lines.findIndex(line => line.includes(`className="${fullClassName}"`));
    if (lineIdx !== -1) {
      targetSource = src;
      targetLineNumber = lineIdx + 1;
      break;
    }
  }

  if (!targetSource && component.sourceFile) {
    targetSource = sources.find(s => s.path === component.sourceFile) || null;
  }

  if (!targetSource) {
    console.log(`[Tailwind] Cannot find "${fullClassName.slice(0, 40)}..." in any source file`);
    return null;
  }

  let oldClass = '';
  let newClass = '';
  let addedClass = '';
  const explanation: string[] = [];

  if (change.type === 'resize') {
    const dw = (change.to.width ?? 0) - (change.from.width ?? 0);
    const dh = (change.to.height ?? 0) - (change.from.height ?? 0);

    if (Math.abs(dh) > 2) {
      const hClass = findTwClass(fullClassName, 'h');
      if (hClass) {
        oldClass = hClass;
        newClass = pxToTw(change.to.height!, 'h');
        explanation.push(`높이: ${hClass} → ${newClass}`);
      } else {
        const pyClass = findTwClass(fullClassName, 'py');
        if (pyClass) {
          const currentPy = parseInt(pyClass.replace(/\D/g, '') || '0');
          const newPy = Math.max(0, currentPy + Math.round(dh / 2));
          oldClass = pyClass;
          newClass = pxToTw(newPy, 'py');
          explanation.push(`패딩: ${oldClass} → ${newClass}`);
        } else {
          addedClass = pxToTw(change.to.height!, 'h');
          explanation.push(`높이 추가: ${addedClass}`);
        }
      }
    }

    if (Math.abs(dw) > 2 && !oldClass && !addedClass) {
      const wClass = findTwClass(fullClassName, 'w');
      if (wClass) {
        oldClass = wClass;
        newClass = pxToTw(change.to.width!, 'w');
        explanation.push(`너비: ${oldClass} → ${newClass}`);
      } else {
        const pxClass = findTwClass(fullClassName, 'px');
        if (pxClass) {
          const currentPx = parseInt(pxClass.replace(/\D/g, '') || '0');
          const newPx = Math.max(0, currentPx + Math.round(dw / 2));
          oldClass = pxClass;
          newClass = pxToTw(newPx, 'px');
          explanation.push(`패딩: ${oldClass} → ${newClass}`);
        } else {
          addedClass = pxToTw(change.to.width!, 'w');
          explanation.push(`너비 추가: ${addedClass}`);
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
        oldClass = mtClass;
        newClass = pxToTw(newPx, 'mt');
        explanation.push(`마진: ${oldClass} → ${newClass}`);
      } else {
        const mbClass = findTwClass(fullClassName, 'mb');
        if (mbClass) {
          const currentPx = parseTwPx(mbClass, 'mb');
          const newPx = Math.max(0, currentPx - Math.round(dy));
          oldClass = mbClass;
          newClass = pxToTw(newPx, 'mb');
          explanation.push(`마진: ${oldClass} → ${newClass}`);
        } else {
          if (dy > 0) {
            addedClass = `mt-[${Math.round(dy)}px]`;
            explanation.push(`마진 추가: ${addedClass}`);
          } else {
            addedClass = `-translate-y-[${Math.abs(Math.round(dy))}px]`;
            explanation.push(`이동: ${addedClass}`);
          }
        }
      }
    }

    if (Math.abs(dx) > 2 && !oldClass) {
      const mlClass = findTwClass(fullClassName, 'ml');
      if (mlClass) {
        const currentPx = parseTwPx(mlClass, 'ml');
        const newPx = Math.max(0, currentPx + Math.round(dx));
        oldClass = mlClass;
        newClass = pxToTw(newPx, 'ml');
        explanation.push(`마진: ${oldClass} → ${newClass}`);
      } else {
        const hClass = dx > 0
          ? `ml-[${Math.round(dx)}px]`
          : `-translate-x-[${Math.abs(Math.round(dx))}px]`;
        addedClass = addedClass ? `${addedClass} ${hClass}` : hClass;
        explanation.push(dx > 0 ? `마진 추가: ${hClass}` : `이동: ${hClass}`);
      }
    }
  }

  if (addedClass && !oldClass) {
    const modifiedClassName = `${fullClassName} ${addedClass}`;
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

  if (!oldClass || !newClass || oldClass === newClass) return null;

  const modifiedClassName = fullClassName.replace(oldClass, newClass);
  const originalLine = `className="${fullClassName}"`;
  const modifiedLine = `className="${modifiedClassName}"`;

  if (!targetSource.content.includes(originalLine)) return null;

  return {
    file: targetSource.path,
    original: originalLine,
    modified: modifiedLine,
    lineNumber: targetLineNumber,
    explanation: explanation.join(', ') || `${oldClass} → ${newClass}`,
    strategy: 'tailwind',
  };
}
