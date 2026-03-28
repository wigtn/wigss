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
  const explanation: string[] = [];

  if (change.type === 'resize') {
    const dw = (change.to.width ?? 0) - (change.from.width ?? 0);
    const dh = (change.to.height ?? 0) - (change.from.height ?? 0);

    if (Math.abs(dh) > 2) {
      // Height change: look for h-XX or py-XX
      const hClass = findTwClass(fullClassName, 'h');
      if (hClass) {
        const newH = pxToTw(change.to.height!, 'h');
        oldClass = hClass;
        newClass = newH;
        explanation.push(`높이: ${hClass} → ${newH} (${change.from.height}px → ${change.to.height}px)`);
      } else {
        const pyClass = findTwClass(fullClassName, 'py');
        if (pyClass) {
          const currentPy = parseInt(pyClass.replace(/\D/g, '') || '0');
          const newPy = Math.max(0, currentPy + Math.round(dh / 2));
          const newPyClass = pxToTw(newPy, 'py');
          oldClass = pyClass;
          newClass = newPyClass;
          explanation.push(`패딩: ${pyClass} → ${newPyClass}`);
        }
      }
    }

    if (Math.abs(dw) > 2 && !oldClass) {
      const wClass = findTwClass(fullClassName, 'w');
      if (wClass) {
        const newW = pxToTw(change.to.width!, 'w');
        oldClass = wClass;
        newClass = newW;
        explanation.push(`너비: ${wClass} → ${newW} (${change.from.width}px → ${change.to.width}px)`);
      } else {
        const pxClass = findTwClass(fullClassName, 'px');
        if (pxClass) {
          const currentPx = parseInt(pxClass.replace(/\D/g, '') || '0');
          const newPx = Math.max(0, currentPx + Math.round(dw / 2));
          const newPxClass = pxToTw(newPx, 'px');
          oldClass = pxClass;
          newClass = newPxClass;
          explanation.push(`패딩: ${pxClass} → ${newPxClass}`);
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
        const currentMt = parseInt(mtClass.replace(/\D/g, '') || '0');
        const newMt = Math.max(0, currentMt + Math.round(dy / 4)); // Approximate
        const newMtClass = pxToTw(newMt * 4, 'mt'); // Convert back to px then to tw
        oldClass = mtClass;
        newClass = newMtClass;
        explanation.push(`마진: ${mtClass} → ${newMtClass}`);
      } else {
        const mbClass = findTwClass(fullClassName, 'mb');
        if (mbClass) {
          const currentMb = parseInt(mbClass.replace(/\D/g, '') || '0');
          const newMb = Math.max(0, currentMb - Math.round(dy / 4));
          const newMbClass = pxToTw(newMb * 4, 'mb');
          oldClass = mbClass;
          newClass = newMbClass;
          explanation.push(`마진: ${mbClass} → ${newMbClass}`);
        }
      }
    }

    if (Math.abs(dx) > 2 && !oldClass) {
      const mlClass = findTwClass(fullClassName, 'ml');
      if (mlClass) {
        const currentMl = parseInt(mlClass.replace(/\D/g, '') || '0');
        const newMl = Math.max(0, currentMl + Math.round(dx / 4));
        const newMlClass = pxToTw(newMl * 4, 'ml');
        oldClass = mlClass;
        newClass = newMlClass;
        explanation.push(`마진: ${mlClass} → ${newMlClass}`);
      }
    }
  }

  if (!oldClass || !newClass || oldClass === newClass) {
    console.log(`[DirectRefactor] No class change computed for ${component.name}`);
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
