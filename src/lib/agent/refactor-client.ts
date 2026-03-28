import type { CodeDiff, ComponentChange, DetectedComponent } from '@/types';

type SourceInput = { path: string; content: string };

// ── Tailwind px↔class mapping ──
const TW_MAP: Record<number, string> = {
  0:'0', 2:'0.5', 4:'1', 6:'1.5', 8:'2', 10:'2.5', 12:'3', 14:'3.5',
  16:'4', 20:'5', 24:'6', 28:'7', 32:'8', 36:'9', 40:'10', 44:'11',
  48:'12', 56:'14', 64:'16', 80:'20', 96:'24', 112:'28', 128:'32',
  160:'40', 192:'48', 224:'56', 256:'64', 288:'72', 320:'80', 384:'96',
};

function pxToTw(px: number, prefix: string): string {
  const closest = Object.keys(TW_MAP).map(Number)
    .reduce((prev, curr) => Math.abs(curr - px) < Math.abs(prev - px) ? curr : prev, 0);
  if (Math.abs(closest - px) <= 2) return `${prefix}-${TW_MAP[closest]}`;
  return `${prefix}-[${Math.round(px)}px]`;
}

// ── Find a Tailwind class pattern in className string ──
function findTwClass(className: string, prefix: string): string | null {
  // Match: prefix-NUMBER, prefix-[NUMBERpx], prefix-NUMBER.5
  const regex = new RegExp(`\\b${prefix}-(?:\\[\\d+px\\]|\\d+\\.?\\d*)\\b`);
  const match = className.match(regex);
  return match ? match[0] : null;
}

// ── Direct refactoring: no GPT, just string replacement ──
function directRefactor(
  change: ComponentChange,
  component: DetectedComponent,
  sources: SourceInput[],
): CodeDiff | null {
  const fullClassName = (component as any).fullClassName || '';
  if (!fullClassName) return null;

  // Find which source file contains this className
  let targetSource: SourceInput | null = null;
  for (const src of sources) {
    if (src.content.includes(fullClassName)) {
      targetSource = src;
      break;
    }
  }

  // Fallback: try sourceFile field
  if (!targetSource && component.sourceFile) {
    targetSource = sources.find(s => s.path === component.sourceFile) || null;
  }

  if (!targetSource) {
    console.log(`[DirectRefactor] Cannot find "${fullClassName.slice(0, 40)}..." in any source file`);
    return null;
  }

  // Calculate what to change
  let oldClass = '';
  let newClass = '';
  let addedClass = ''; // Class to ADD when no existing class matches
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
          // No h-XX or py-XX → ADD h-[Npx] to className
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
          // No w-XX or px-XX → ADD w-[Npx]
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
        const currentPx = parseInt(mtClass.replace(/[^\d]/g, '') || '0');
        // Convert TW value to px, add delta, convert back
        const twVal = TW_MAP[currentPx * 4] ? currentPx * 4 : currentPx;
        const newPx = Math.max(0, twVal + dy);
        oldClass = mtClass;
        newClass = pxToTw(newPx, 'mt');
        explanation.push(`마진: ${oldClass} → ${newClass}`);
      } else {
        const mbClass = findTwClass(fullClassName, 'mb');
        if (mbClass) {
          const currentPx = parseInt(mbClass.replace(/[^\d]/g, '') || '0');
          const twVal = TW_MAP[currentPx * 4] ? currentPx * 4 : currentPx;
          const newPx = Math.max(0, twVal - dy);
          oldClass = mbClass;
          newClass = pxToTw(newPx, 'mb');
          explanation.push(`마진: ${oldClass} → ${newClass}`);
        } else {
          // No mt-XX → ADD mt-[Npx]
          if (dy > 0) {
            addedClass = `mt-[${Math.round(dy)}px]`;
            explanation.push(`마진 추가: ${addedClass}`);
          }
        }
      }
    }

    if (Math.abs(dx) > 2 && !oldClass && !addedClass) {
      const mlClass = findTwClass(fullClassName, 'ml');
      if (mlClass) {
        const currentPx = parseInt(mlClass.replace(/[^\d]/g, '') || '0');
        const twVal = TW_MAP[currentPx * 4] ? currentPx * 4 : currentPx;
        const newPx = Math.max(0, twVal + dx);
        oldClass = mlClass;
        newClass = pxToTw(newPx, 'ml');
        explanation.push(`마진: ${oldClass} → ${newClass}`);
      } else if (dx > 0) {
        addedClass = `ml-[${Math.round(dx)}px]`;
        explanation.push(`마진 추가: ${addedClass}`);
      }
    }
  }

  // Handle case: ADD a new class (no existing class to swap)
  if (addedClass && !oldClass) {
    const modifiedClassName = `${fullClassName} ${addedClass}`;
    const originalLine = `className="${fullClassName}"`;
    const modifiedLine = `className="${modifiedClassName}"`;

    if (!targetSource.content.includes(originalLine)) {
      console.log(`[DirectRefactor] Cannot find className to add ${addedClass} in ${targetSource.path}`);
      return null;
    }

    console.log(`[DirectRefactor] ✓ ADD ${addedClass} to ${targetSource.path}`);
    return {
      file: targetSource.path,
      original: originalLine,
      modified: modifiedLine,
      lineNumber: 0,
      explanation: explanation.join(', '),
    };
  }

  if (!oldClass || !newClass || oldClass === newClass) {
    console.log(`[DirectRefactor] No class change for ${component.name} (old="${oldClass}" new="${newClass}" added="${addedClass}")`);
    return null;
  }

  // Build the diff: replace oldClass with newClass in the className string
  const modifiedClassName = fullClassName.replace(oldClass, newClass);
  const originalLine = `className="${fullClassName}"`;
  const modifiedLine = `className="${modifiedClassName}"`;

  // Verify the original exists in the source
  if (!targetSource.content.includes(originalLine)) {
    console.log(`[DirectRefactor] Cannot find className="${fullClassName.slice(0, 40)}..." in ${targetSource.path}`);
    return null;
  }

  console.log(`[DirectRefactor] ✓ ${targetSource.path}: ${oldClass} → ${newClass}`);

  return {
    file: targetSource.path,
    original: originalLine,
    modified: modifiedLine,
    lineNumber: 0,
    explanation: explanation.join(', ') || `${oldClass} → ${newClass}`,
  };
}

// ── Main export ──
export async function generateRefactorDiffs(input: {
  changes: ComponentChange[];
  components: DetectedComponent[];
  sources: SourceInput[];
}): Promise<CodeDiff[]> {
  const componentMap = new Map(input.components.map((c) => [c.id, c]));

  // Deduplicate: keep only the LATEST change per component
  const latestChanges = new Map<string, ComponentChange>();
  for (const change of input.changes) {
    latestChanges.set(change.componentId, change);
  }

  const diffs: CodeDiff[] = [];
  const failedChanges: ComponentChange[] = [];

  // Step 1: Try DIRECT refactoring first (no GPT, 100% reliable)
  for (const change of latestChanges.values()) {
    const component = componentMap.get(change.componentId);
    if (!component) continue;

    const diff = directRefactor(change, component, input.sources);
    if (diff) {
      diffs.push(diff);
    } else {
      failedChanges.push(change);
    }
  }

  console.log(`[Refactor] Direct: ${diffs.length} diffs. Failed: ${failedChanges.length} (will skip GPT fallback for safety)`);

  // Step 2: For failed changes, DON'T use GPT (too risky for code quality)
  // Instead, log what couldn't be changed
  for (const change of failedChanges) {
    const comp = componentMap.get(change.componentId);
    console.log(`[Refactor] Skipped: ${comp?.name || change.componentId} — no matching className found in source`);
  }

  return diffs;
}
