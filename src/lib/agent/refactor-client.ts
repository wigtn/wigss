import OpenAI from 'openai';
import type { CodeDiff, ComponentChange, DetectedComponent } from '@/types';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type SourceInput = {
  path: string;
  content: string;
};

function parseJsonArray(text: string): unknown[] {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  const payload = fenced ? fenced[1] : text;
  const parsed = JSON.parse(payload);
  return Array.isArray(parsed) ? parsed : [];
}

function coerceDiffs(raw: unknown[], sourcePaths: Set<string>): CodeDiff[] {
  const diffs: CodeDiff[] = [];

  for (const item of raw) {
    const row = item as Partial<CodeDiff>;
    const file = typeof row.file === 'string' ? row.file : '';
    if (!file || !sourcePaths.has(file)) continue;

    const original = typeof row.original === 'string' ? row.original : '';
    const modified = typeof row.modified === 'string' ? row.modified : '';
    const lineNumber = Number.isInteger(row.lineNumber) && (row.lineNumber as number) > 0
      ? (row.lineNumber as number)
      : 1;
    const explanation = typeof row.explanation === 'string'
      ? row.explanation
      : 'Auto-generated refactor diff';

    if (original === modified) continue;

    diffs.push({
      file,
      original,
      modified,
      lineNumber,
      explanation,
    });
  }

  return diffs;
}

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

  // Tailwind px→class mapping for pre-calculation
  const TW_SPACING: Record<number, string> = {
    0:'0', 2:'0.5', 4:'1', 6:'1.5', 8:'2', 10:'2.5', 12:'3', 14:'3.5',
    16:'4', 20:'5', 24:'6', 28:'7', 32:'8', 36:'9', 40:'10', 44:'11',
    48:'12', 56:'14', 64:'16', 80:'20', 96:'24', 112:'28', 128:'32',
    160:'40', 192:'48', 224:'56', 256:'64', 288:'72', 320:'80', 384:'96',
  };

  function pxToTailwind(px: number, prefix: string): string {
    const closest = Object.keys(TW_SPACING)
      .map(Number)
      .reduce((prev, curr) => Math.abs(curr - px) < Math.abs(prev - px) ? curr : prev, 0);
    if (Math.abs(closest - px) <= 2) {
      return `${prefix}-${TW_SPACING[closest]}`;
    }
    return `${prefix}-[${Math.round(px)}px]`;
  }

  function suggestClassChange(from: any, to: any, type: string, fullClassName: string): string {
    const suggestions: string[] = [];

    if (type === 'resize') {
      const dw = (to.width ?? 0) - (from.width ?? 0);
      const dh = (to.height ?? 0) - (from.height ?? 0);

      if (Math.abs(dw) > 2) {
        // Find current w-XX or px-XX in className
        const wMatch = fullClassName.match(/\b(w-\[?\d+)/);
        const pxMatch = fullClassName.match(/\b(px-\[?\d+)/);
        if (wMatch) {
          suggestions.push(`Width: change "${wMatch[0]}" → "${pxToTailwind(to.width, 'w')}"`);
        } else if (pxMatch) {
          // px changes affect width
          const currentPx = parseInt(pxMatch[0].replace(/\D/g, ''));
          const newPx = Math.max(0, currentPx + Math.round(dw / 2));
          suggestions.push(`Padding: change "${pxMatch[0]}" → "${pxToTailwind(newPx, 'px')}"`);
        } else {
          suggestions.push(`Width changed by ${dw}px → add or change w-XX class to "${pxToTailwind(to.width, 'w')}"`);
        }
      }
      if (Math.abs(dh) > 2) {
        const hMatch = fullClassName.match(/\b(h-\[?\d+)/);
        const pyMatch = fullClassName.match(/\b(py-\[?\d+)/);
        if (hMatch) {
          suggestions.push(`Height: change "${hMatch[0]}" → "${pxToTailwind(to.height, 'h')}"`);
        } else if (pyMatch) {
          const currentPy = parseInt(pyMatch[0].replace(/\D/g, ''));
          const newPy = Math.max(0, currentPy + Math.round(dh / 2));
          suggestions.push(`Padding: change "${pyMatch[0]}" → "${pxToTailwind(newPy, 'py')}"`);
        } else {
          suggestions.push(`Height changed by ${dh}px → add or change h-XX class to "${pxToTailwind(to.height, 'h')}"`);
        }
      }
    }

    if (type === 'move') {
      const dy = (to.y ?? 0) - (from.y ?? 0);
      const dx = (to.x ?? 0) - (from.x ?? 0);
      if (Math.abs(dy) > 2) {
        const mtMatch = fullClassName.match(/\b(mt-\[?\d+)/);
        if (mtMatch) {
          const currentMt = parseInt(mtMatch[0].replace(/\D/g, ''));
          const newMt = Math.max(0, currentMt + dy);
          suggestions.push(`Margin-top: change "${mtMatch[0]}" → "${pxToTailwind(newMt, 'mt')}"`);
        } else {
          suggestions.push(`Y moved by ${dy}px → add "mt-[${Math.round(to.y)}px]" or adjust margin-top`);
        }
      }
      if (Math.abs(dx) > 2) {
        const mlMatch = fullClassName.match(/\b(ml-\[?\d+)/);
        if (mlMatch) {
          const currentMl = parseInt(mlMatch[0].replace(/\D/g, ''));
          const newMl = Math.max(0, currentMl + dx);
          suggestions.push(`Margin-left: change "${mlMatch[0]}" → "${pxToTailwind(newMl, 'ml')}"`);
        }
      }
    }

    return suggestions.join('; ') || 'No specific class suggestion';
  }

  const changeSummary = Array.from(latestChanges.values()).map((change) => {
    const component = componentMap.get(change.componentId);
    const name = component?.name || '';
    const parts = name.split(': ');
    const tagAndClass = parts[0] || '';
    const textContent = parts[1] || '';
    const fullClassName = (component as any)?.fullClassName || '';

    // Pre-calculate the exact Tailwind class change
    const suggestedChange = suggestClassChange(change.from, change.to, change.type, fullClassName);

    return {
      componentId: change.componentId,
      type: change.type,
      from: change.from,
      to: change.to,
      componentName: name,
      textContent: textContent,
      sourceFile: component?.sourceFile || '',
      fullClassName: fullClassName,
      suggestedTailwindChange: suggestedChange,
    };
  });

  const sourcePayload = input.sources.map((source) => ({
    path: source.path,
    content: source.content,
  }));

  const prompt = [
    'You are a precise Tailwind CSS refactoring engine.',
    'Given pixel-level layout changes and source files, return ONLY a JSON array of CodeDiff objects.',
    'Each item: { file, original, modified, lineNumber, explanation }',
    '',
    '=== TAILWIND REFERENCE (px values) ===',
    'Spacing: 0=0px, 0.5=2px, 1=4px, 1.5=6px, 2=8px, 2.5=10px, 3=12px, 3.5=14px, 4=16px, 5=20px, 6=24px, 7=28px, 8=32px, 9=36px, 10=40px, 11=44px, 12=48px, 14=56px, 16=64px, 20=80px, 24=96px',
    'Width/Height: w-16=64px, w-20=80px, w-24=96px, w-32=128px, w-40=160px, w-48=192px, w-56=224px, w-64=256px, w-72=288px, w-80=320px, w-96=384px',
    'Height: h-8=32px, h-10=40px, h-12=48px, h-14=56px, h-16=64px, h-20=80px, h-24=96px',
    'Padding: p-1=4px, p-2=8px, p-3=12px, p-4=16px, p-5=20px, p-6=24px, p-8=32px, p-10=40px, p-12=48px',
    'Margin: m-1=4px, m-2=8px, m-3=12px, m-4=16px, m-5=20px, m-6=24px, m-8=32px',
    'Gap: gap-1=4px, gap-2=8px, gap-3=12px, gap-4=16px, gap-5=20px, gap-6=24px, gap-8=32px',
    'Text: text-xs=12px, text-sm=14px, text-base=16px, text-lg=18px, text-xl=20px, text-2xl=24px',
    'For arbitrary values use: w-[200px], h-[48px], px-[30px], mt-[12px], gap-[20px]',
    '',
    '=== RULES ===',
    '1. original = EXACT copy from source file (character-for-character)',
    '2. modified = ONLY the className string changed, nothing else',
    '3. Change ONLY the Tailwind classes that correspond to the pixel change:',
    '   - Width change → w-XX or px-XX',
    '   - Height change → h-XX or py-XX',
    '   - X position change → ml-XX, mr-XX, or gap-XX on parent',
    '   - Y position change → mt-XX, mb-XX',
    '4. Use the reference table above to pick the correct class for the target px value',
    '5. If no standard class exists, use arbitrary value: w-[285px], h-[52px]',
    '6. NEVER modify: JS logic, event handlers, SVG, component structure, text content',
    '7. original and modified must have the SAME number of lines',
    '8. Return [] if unsure',
    '',
    '=== PROCESS ===',
    '1. Each change has a "suggestedTailwindChange" field — FOLLOW IT. It tells you exactly which class to change.',
    '2. Each change has "fullClassName" — search this string in the source files to find the exact line.',
    '3. Find the className="..." string that contains the fullClassName value.',
    '4. Apply the suggested change (e.g., change "h-24" to "h-16" in that className string).',
    '5. Output ONE diff per change.',
    '',
    'EXAMPLE:',
    '  suggestedTailwindChange: "Height: change h-24 → h-16"',
    '  fullClassName: "h-24 bg-gray-900 py-8 px-8 flex items-center"',
    '  → Find className="h-24 bg-gray-900 py-8 px-8 flex items-center" in source',
    '  → Change to className="h-16 bg-gray-900 py-8 px-8 flex items-center"',
    '',
    'Layout changes:',
    JSON.stringify(changeSummary, null, 2),
    '',
    'Source files:',
    JSON.stringify(sourcePayload, null, 2),
  ].join('\n');

  const request = {
    messages: [
      { role: 'system' as const, content: 'You are a Tailwind CSS expert. Return strict JSON array only. Use the reference table for exact px→class mapping.' },
      { role: 'user' as const, content: prompt },
    ],
    temperature: 0.1,
    max_tokens: 4096,
  };

  let content = '';
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-5.4',
      ...request,
    });
    content = response.choices[0]?.message?.content || '[]';
  } catch {
    const fallback = await openai.chat.completions.create({
      model: 'gpt-4o',
      ...request,
    });
    content = fallback.choices[0]?.message?.content || '[]';
  }

  const raw = parseJsonArray(content);
  const sourcePaths = new Set(input.sources.map((s) => s.path));
  return coerceDiffs(raw, sourcePaths);
}
