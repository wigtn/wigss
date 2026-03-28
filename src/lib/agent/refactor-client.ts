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
  const changeSummary = input.changes.map((change) => {
    const component = componentMap.get(change.componentId);
    const name = component?.name || '';
    // Extract useful info from component name (format: "tagName.class1.class2: text")
    const parts = name.split(': ');
    const tagAndClass = parts[0] || '';
    const textContent = parts[1] || '';

    return {
      componentId: change.componentId,
      type: change.type,
      from: change.from,
      to: change.to,
      componentName: name,
      tagName: tagAndClass.split('.')[0] || '',
      cssClasses: tagAndClass.split('.').slice(1).join(' ') || '',
      textContent: textContent,
      sourceFile: component?.sourceFile || '',
      // Pre-calculate what changed
      widthChange: change.type === 'resize' ? `${change.from.width}px → ${change.to.width}px` : null,
      heightChange: change.type === 'resize' ? `${change.from.height}px → ${change.to.height}px` : null,
      xChange: change.type === 'move' ? `${change.from.x}px → ${change.to.x}px` : null,
      yChange: change.type === 'move' ? `${change.from.y}px → ${change.to.y}px` : null,
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
    '1. For each change, find the component name/text in the source files',
    '2. Find the className="" string that controls the changed dimension',
    '3. Calculate the target Tailwind class from the "to" pixel values using the reference',
    '4. Output ONE diff per change, modifying only that className string',
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
