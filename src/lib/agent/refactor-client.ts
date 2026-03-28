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
    return {
      componentId: change.componentId,
      type: change.type,
      from: change.from,
      to: change.to,
      name: component?.name || '',
      sourceFile: component?.sourceFile || '',
    };
  });

  const sourcePayload = input.sources.map((source) => ({
    path: source.path,
    content: source.content,
  }));

  const prompt = [
    'You are GPT-5.4 acting as a code refactoring engine for a visual editor.',
    'Given layout changes and source files, return ONLY a JSON array of CodeDiff objects.',
    'Each item must have: file, original, modified, lineNumber, explanation.',
    'Rules:',
    '- file must match one of the provided source paths exactly.',
    '- original must be an exact snippet from that file.',
    '- modified should implement the requested layout change.',
    '- Keep changes minimal and safe.',
    '- Return [] if no safe change can be produced.',
    '',
    'Layout changes:',
    JSON.stringify(changeSummary, null, 2),
    '',
    'Source files:',
    JSON.stringify(sourcePayload, null, 2),
  ].join('\n');

  const request = {
    messages: [
      { role: 'system' as const, content: 'Return strict JSON array only.' },
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
