/**
 * A/B 하네스 공용 유틸.
 * 채점과 오염 검사는 A·B 양쪽에 똑같이 적용된다.
 */
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { parse } from '@babel/parser';
import type { CodeDiff } from '@/types';

export const FIXTURE_DIR = join(__dirname, 'fixtures');

export type SourceInput = { path: string; content: string };

/** 프로젝트의 모든 소스 파일을 읽는다 — /api/refactor 의 listSourceFiles 와 같은 역할 */
export function loadAllSources(): SourceInput[] {
  return readdirSync(FIXTURE_DIR)
    .filter((f) => f.endsWith('.tsx') || f.endsWith('.js'))
    .sort()
    .map((f) => ({ path: f, content: readFileSync(join(FIXTURE_DIR, f), 'utf8') }));
}

/** 주소가 가리키는 파일 하나만 읽는다 — 개선안(B)의 읽기 비용 */
export function loadOneSource(file: string): SourceInput {
  return { path: file, content: readFileSync(join(FIXTURE_DIR, file), 'utf8') };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseTsx(src: string): any {
  return parse(src, { sourceType: 'module', plugins: ['jsx', 'typescript'], errorRecovery: true });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function walkAst(node: any, visit: (n: any) => void): void {
  if (!node || typeof node !== 'object') return;
  if (node.type) visit(node);
  for (const k of Object.keys(node)) {
    if (k === 'loc' || k === 'start' || k === 'end') continue;
    const c = node[k];
    if (Array.isArray(c)) c.forEach((x) => walkAst(x, visit));
    else if (c && typeof c === 'object' && c.type) walkAst(c, visit);
  }
}

/**
 * 채점용: 파일 내용에서 지정 주소의 요소가 가진 className 표현을 뽑는다.
 * - 문자열 리터럴이면 그 값
 * - 그 외(템플릿/호출식)면 표현식 소스 텍스트
 */
export function readClassNameAt(
  content: string,
  address: { line: number; column: number },
): { kind: 'string' | 'template' | 'call' | 'other' | 'none'; value: string } {
  const ast = parseTsx(content);
  let found: { kind: 'string' | 'template' | 'call' | 'other' | 'none'; value: string } = {
    kind: 'none',
    value: '',
  };
  walkAst(ast.program, (n) => {
    if (found.kind !== 'none') return;
    if (n.type !== 'JSXOpeningElement' || !n.loc) return;
    if (n.loc.start.line !== address.line || n.loc.start.column !== address.column) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const attr = (n.attributes ?? []).find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (a: any) => a.type === 'JSXAttribute' && a.name?.name === 'className',
    );
    if (!attr || !attr.value) {
      found = { kind: 'none', value: '' };
      return;
    }
    if (attr.value.type === 'StringLiteral') {
      found = { kind: 'string', value: attr.value.value };
      return;
    }
    const expr = attr.value.expression;
    const text = content.slice(expr.start, expr.end);
    if (expr.type === 'TemplateLiteral') found = { kind: 'template', value: text };
    else if (expr.type === 'CallExpression') found = { kind: 'call', value: text };
    else found = { kind: 'other', value: text };
  });
  return found;
}

/**
 * /api/apply 의 안전장치를 그대로 재현한다.
 * A와 B 모두 같은 관문을 통과해야 한다.
 */
export function applyDiff(
  content: string,
  diff: CodeDiff,
): { ok: true; content: string } | { ok: false; reason: string } {
  const original = diff.original ?? '';
  const modified = diff.modified ?? '';
  if (!original || !modified) return { ok: false, reason: 'empty original/modified' };

  // v3: 주소 경로의 range 치환 (드리프트 검사 포함) — /api/apply 와 동일 계약
  if (diff.range) {
    const { start, end } = diff.range;
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end > content.length || start >= end) {
      return { ok: false, reason: 'range out of bounds' };
    }
    if (content.slice(start, end) !== original) {
      return { ok: false, reason: 'drift: range content changed' };
    }
  }

  const isCss = diff.file.endsWith('.css') || diff.file.endsWith('.scss');
  if (!isCss) {
    if (!original.includes('className') && !original.includes('style')) {
      return { ok: false, reason: 'diff must modify className or style' };
    }
    const dangerous = ['function ', 'const ', 'let ', 'var ', 'return ', 'import ', 'export ', '=>'];
    for (const p of dangerous) {
      const esc = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const a = (original.match(new RegExp(esc, 'g')) || []).length;
      const b = (modified.match(new RegExp(esc, 'g')) || []).length;
      if (a !== b) return { ok: false, reason: `JS structure changed (${p.trim()})` };
    }
  }
  if (diff.range) {
    const { start, end } = diff.range;
    return { ok: true, content: content.slice(0, start) + modified + content.slice(end) };
  }
  const idx = content.indexOf(original);
  if (idx === -1) return { ok: false, reason: 'original snippet not found' };
  return { ok: true, content: content.slice(0, idx) + modified + content.slice(idx + original.length) };
}

// ── 오염 검사 ────────────────────────────────────────────────────────────

/** Tailwind 스페이싱 스케일 (프로젝트 프로파일에서 관측된 값) */
export const SCALE_PX = [0, 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 36, 40, 44, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 288, 320, 384];

export type Pollution = {
  duplicateTokens: string[];
  arbitraryValues: string[];
  inlineStyleAdded: boolean;
  total: number;
};

/** 같은 브레이크포인트에서 같은 유틸리티 접두사가 두 번 나오는지 */
function duplicatePrefixes(className: string): string[] {
  const seen = new Map<string, string[]>();
  for (const tok of className.split(/\s+/).filter(Boolean)) {
    const m = tok.match(/^((?:[a-z0-9-]+:)*)(-?[a-z]+)-/);
    if (!m) continue;
    const key = `${m[1]}${m[2]}-`;
    const arr = seen.get(key) ?? [];
    arr.push(tok);
    seen.set(key, arr);
  }
  const dupes: string[] = [];
  for (const [key, toks] of seen) {
    // 다른 축을 공유하는 접두사는 제외 (예: text- 는 색/크기 둘 다 씀)
    if (['text-', 'bg-', 'ring-', 'border-', 'font-'].some((p) => key.endsWith(p))) continue;
    if (toks.length > 1) dupes.push(`${key}× ${toks.join(' + ')}`);
  }
  return dupes;
}

export function checkPollution(
  beforeFile: string,
  afterFile: string,
  className: string,
): Pollution {
  const duplicateTokens = duplicatePrefixes(className);
  const arbitraryValues = (className.match(/[a-z-]+\[[^\]]+\]/g) ?? []).filter(
    (t) => !/^(?:group|peer|data|aria|supports|has)-/.test(t),
  );
  const inlineBefore = (beforeFile.match(/style=\{\{/g) ?? []).length;
  const inlineAfter = (afterFile.match(/style=\{\{/g) ?? []).length;
  const inlineStyleAdded = inlineAfter > inlineBefore;
  return {
    duplicateTokens,
    arbitraryValues,
    inlineStyleAdded,
    total: duplicateTokens.length + arbitraryValues.length + (inlineStyleAdded ? 1 : 0),
  };
}

/** 토큰 집합 비교 — 공백/순서 차이를 무시하고 의미가 같은지 */
export function sameClassSet(a: string, b: string): boolean {
  const norm = (s: string) => s.trim().split(/\s+/).filter(Boolean).sort().join(' ');
  return norm(a) === norm(b);
}

/**
 * 종류에 상관없이 "정적 className 문자열"을 뽑는다.
 * - 문자열 리터럴  → 값 그대로
 * - 템플릿 리터럴  → 정적 조각(quasis)만 이어붙임
 * - cn()/clsx()   → 첫 문자열 인자
 * 채점은 이 값으로 한다. A와 B에 동일 적용.
 */
export function staticClassAt(
  content: string,
  address: { line: number; column: number },
): string {
  const ast = parseTsx(content);
  let out = '';
  let done = false;
  walkAst(ast.program, (n) => {
    if (done) return;
    if (n.type !== 'JSXOpeningElement' || !n.loc) return;
    if (n.loc.start.line !== address.line || n.loc.start.column !== address.column) return;
    done = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const attr = (n.attributes ?? []).find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (a: any) => a.type === 'JSXAttribute' && a.name?.name === 'className',
    );
    if (!attr || !attr.value) return;
    if (attr.value.type === 'StringLiteral') {
      out = attr.value.value;
      return;
    }
    const expr = attr.value.expression;
    if (expr?.type === 'TemplateLiteral') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      out = expr.quasis.map((q: any) => q.value.raw).join(' ').trim().replace(/\s+/g, ' ');
      return;
    }
    if (expr?.type === 'CallExpression') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const first = (expr.arguments ?? []).find((a: any) => a.type === 'StringLiteral');
      out = first ? first.value : '';
      return;
    }
    out = '';
  });
  return out;
}

/**
 * 오프셋 기반 적용 — 개선안이 요구하는 apply 경로.
 * /api/apply 의 안전 가드는 그대로 통과시키되, 대상 위치를 문자열 검색이 아니라
 * 주소에서 온 문자 범위로 확정한다. (현행 CodeDiff 에는 이 범위 필드가 없다)
 */
export function applyByRange(
  content: string,
  range: { start: number; end: number },
  replacement: string,
  attrSnippetForGuards: { original: string; modified: string },
): { ok: true; content: string } | { ok: false; reason: string } {
  const { original, modified } = attrSnippetForGuards;
  if (!original.includes('className') && !original.includes('style')) {
    return { ok: false, reason: 'diff must modify className or style' };
  }
  const dangerous = ['function ', 'const ', 'let ', 'var ', 'return ', 'import ', 'export ', '=>'];
  for (const p of dangerous) {
    const esc = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const a = (original.match(new RegExp(esc, 'g')) || []).length;
    const b = (modified.match(new RegExp(esc, 'g')) || []).length;
    if (a !== b) return { ok: false, reason: `JS structure changed (${p.trim()})` };
  }
  if (range.start < 0 || range.end > content.length || range.start > range.end) {
    return { ok: false, reason: 'range out of bounds' };
  }
  return { ok: true, content: content.slice(0, range.start) + replacement + content.slice(range.end) };
}

/** 파일 전체에서 className 문자열을 모두 뽑는다 (오염 검사용) */
export function allClassStrings(content: string): string[] {
  const out: string[] = [];
  try {
    const ast = parseTsx(content);
    walkAst(ast.program, (n) => {
      if (n.type === 'StringLiteral' && typeof n.value === 'string') out.push(n.value);
      if (n.type === 'TemplateElement') out.push(n.value?.raw ?? '');
    });
  } catch {
    /* ignore */
  }
  return out;
}

/**
 * 파일 단위 오염 검사 — 어느 요소를 건드렸든 상관없이
 * "이 편집이 코드베이스에 무엇을 남겼는가"를 센다.
 */
export function filePollution(before: string, after: string): Pollution {
  const arbRe = /(?:^|\s)((?:[a-z0-9-]+:)*-?[a-z]+-\[[^\]]+\])/g;
  const grab = (s: string) => {
    const set = new Set<string>();
    for (const cls of allClassStrings(s)) {
      let m: RegExpExecArray | null;
      arbRe.lastIndex = 0;
      while ((m = arbRe.exec(cls))) set.add(m[1]);
    }
    return set;
  };
  const beforeArb = grab(before);
  const afterArb = grab(after);
  const arbitraryValues = [...afterArb].filter((v) => !beforeArb.has(v));

  const dupOf = (s: string) => {
    const out: string[] = [];
    for (const cls of allClassStrings(s)) {
      const seen = new Map<string, string[]>();
      for (const tok of cls.split(/\s+/).filter(Boolean)) {
        const m = tok.match(/^((?:[a-z0-9-]+:)*)(-?[a-z]+)-/);
        if (!m) continue;
        const key = `${m[1]}${m[2]}-`;
        if (['text-', 'bg-', 'ring-', 'border-', 'font-'].some((p) => key.endsWith(p))) continue;
        const arr = seen.get(key) ?? [];
        arr.push(tok);
        seen.set(key, arr);
      }
      for (const [key, toks] of seen) if (toks.length > 1) out.push(`${key}${toks.join('+')}`);
    }
    return out;
  };
  const beforeDup = new Set(dupOf(before));
  const duplicateTokens = dupOf(after).filter((d) => !beforeDup.has(d));

  const inlineStyleAdded =
    (after.match(/style=\{\{/g) ?? []).length > (before.match(/style=\{\{/g) ?? []).length;

  return {
    duplicateTokens,
    arbitraryValues,
    inlineStyleAdded,
    total: duplicateTokens.length + arbitraryValues.length + (inlineStyleAdded ? 1 : 0),
  };
}
