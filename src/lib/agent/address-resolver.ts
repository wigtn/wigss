/**
 * 주소 리졸버 (P2 · PROD-632)
 *
 * jsx-dev-runtime 이 DOM 에 부착한 "file:line:col" 주소를 소스의 AST 노드로
 * 해석한다. className 문자열 검색을 대체하는 조인의 소비 측이다.
 *
 * 좌표계 (Phase 0 실측): SWC 의 jsxDEV source 는 줄·칸 모두 1-기반이고
 * Babel 의 loc.start.column 은 0-기반이다. 따라서 column-1 을 우선 매칭하고
 * column 을 폴백으로 받는다 — Babel 좌표로 주소를 만든 호출자(테스트 등)도
 * 같은 리졸버를 쓸 수 있다.
 *
 * 반환하는 범위는 전부 문자 오프셋이며, 편집은 이 범위를 CodeDiff.range 로
 * apply 까지 그대로 전달한다 (PRD D2 — 하네스가 잡아낸 결함: 주소로 찾고도
 * apply 가 indexOf 로 재조회하면 중복 모호성이 되살아난다).
 */
import { parse } from '@babel/parser';

export interface ParsedAddress {
  file: string;
  line: number;
  column: number;
}

export interface ResolvedTarget {
  kind: 'string' | 'template' | 'call';
  /** 편집 가능한 정적 className 조각 */
  staticClass: string;
  /** staticClass 가 차지하는 문자 범위 (따옴표/quasi 안쪽) */
  valueRange: { start: number; end: number };
  /** className 속성 전체 범위 — diff 와 apply 가드의 경계 */
  attrStart: number;
  attrEnd: number;
  lineNumber: number;
  elementName: string;
}

export type ResolveResult = ResolvedTarget | { error: string };

/** "path:line:col" → 구성 요소. 경로에 콜론이 있어도 뒤에서부터 자른다. */
export function parseAddress(address: string): ParsedAddress | null {
  const m = /^(.+):(\d+):(\d+)$/.exec(address);
  if (!m) return null;
  const line = parseInt(m[2], 10);
  const column = parseInt(m[3], 10);
  if (!Number.isFinite(line) || line < 1 || !Number.isFinite(column)) return null;
  return { file: m[1], line, column };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function walk(node: any, visit: (n: any) => void): void {
  if (!node || typeof node !== 'object') return;
  if (node.type) visit(node);
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'start' || key === 'end') continue;
    const child = node[key];
    if (Array.isArray(child)) {
      for (const item of child) {
        if (item && typeof item === 'object' && item.type) walk(item, visit);
      }
    } else if (child && typeof child === 'object' && child.type) {
      walk(child, visit);
    }
  }
}

/**
 * 소스 내용에서 (line, column) 의 JSXOpeningElement 를 찾아
 * 편집 가능한 className 조각과 범위를 돌려준다.
 */
export function resolveAddressInSource(
  content: string,
  line: number,
  column: number,
): ResolveResult {
  let ast: any;
  try {
    ast = parse(content, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
      errorRecovery: true,
    });
  } catch (err) {
    return { error: `소스 파싱 실패: ${err instanceof Error ? err.message : String(err)}` };
  }

  // column-1(1-기반 주소) 우선, column(0-기반 주소) 폴백
  let exact: any = null;
  let fallback: any = null;
  walk(ast.program, (n) => {
    if (n.type !== 'JSXOpeningElement' || !n.loc) return;
    if (n.loc.start.line !== line) return;
    if (n.loc.start.column === column - 1 && !exact) exact = n;
    else if (n.loc.start.column === column && !fallback) fallback = n;
  });
  const node = exact ?? fallback;
  if (!node) {
    return { error: `주소 ${line}:${column} 에 해당하는 JSX 요소가 없음 — 소스가 변경됐다면 재스캔 필요` };
  }

  const elementName = node.name?.name ?? '?';
  const attr = (node.attributes ?? []).find(
    (a: any) => a.type === 'JSXAttribute' && a.name?.name === 'className',
  );
  if (!attr || !attr.value) {
    return { error: `<${elementName}> 에 className 속성이 없음 (PRD D8 — v3 범위 밖)` };
  }

  const attrStart: number = attr.start;
  const attrEnd: number = attr.end;
  const lineNumber: number = attr.loc?.start?.line ?? line;

  if (attr.value.type === 'StringLiteral') {
    return {
      kind: 'string',
      staticClass: attr.value.value,
      valueRange: { start: attr.value.start + 1, end: attr.value.end - 1 },
      attrStart,
      attrEnd,
      lineNumber,
      elementName,
    };
  }

  const expr = attr.value.type === 'JSXExpressionContainer' ? attr.value.expression : null;

  if (expr?.type === 'TemplateLiteral') {
    // 유틸리티 토큰이 사는 첫 번째 비어있지 않은 정적 조각을 편집 대상으로 삼는다
    const quasi = (expr.quasis ?? []).find((q: any) => q.value.raw.trim().length > 0);
    if (!quasi) return { error: `<${elementName}> 템플릿 리터럴에 정적 조각이 없음` };
    return {
      kind: 'template',
      staticClass: quasi.value.raw,
      valueRange: { start: quasi.start, end: quasi.end },
      attrStart,
      attrEnd,
      lineNumber,
      elementName,
    };
  }

  if (expr?.type === 'CallExpression') {
    // cn('...', cond && '...') — 첫 문자열 리터럴 인자가 기본 스타일 자리
    const first = (expr.arguments ?? []).find((a: any) => a.type === 'StringLiteral');
    if (!first) {
      const callee = expr.callee?.name ?? 'call';
      return { error: `<${elementName}> ${callee}() 에 문자열 리터럴 인자가 없음` };
    }
    return {
      kind: 'call',
      staticClass: first.value,
      valueRange: { start: first.start + 1, end: first.end - 1 },
      attrStart,
      attrEnd,
      lineNumber,
      elementName,
    };
  }

  return { error: `<${elementName}> 의 className 이 수정 불가한 표현식 (${expr?.type ?? attr.value.type})` };
}

export function isResolveFailure(r: ResolveResult): r is { error: string } {
  return 'error' in r;
}
