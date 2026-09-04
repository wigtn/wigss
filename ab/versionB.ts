/**
 * Version B — 개선안 프로토타입.
 *
 * 세 가지만 다르다:
 *   1) 조인      className 문자열 검색이 아니라 소스 주소(file:line:col)로 직접 해석
 *   2) 번역      활성 브레이크포인트의 토큰만 조작 (base / md: / lg: 구분)
 *   3) 출력      컨벤션 린터 통과 필수. 인라인 스타일 금지, 못 하면 정직하게 포기
 *
 * px↔Tailwind 스케일 매핑은 A와 동일한 테이블(tailwind-utils)을 쓴다.
 * 비교 대상은 "조인·번역·출력 정책"이지 스케일 표가 아니다.
 */
import { pxToTw } from '@/lib/agent/rewriters/tailwind-utils';
import {
  loadOneSource,
  applyByRange,
  staticClassAt,
  filePollution,
  parseTsx,
  walkAst,
} from './util';
import type { Scenario } from './scenarios';
import type { RunResult } from './versionA';

/** 프로젝트 컨벤션 프로파일 — 설치 시 1회 스캔으로 뽑는 값 */
export type ConventionProfile = {
  /** 임의값(h-[213px])이 코드베이스에서 차지하는 비율 */
  arbitraryRatio: number;
  /** 임의값을 새로 만들어도 되는 상한 */
  arbitraryBudget: number;
};

const PROFILE: ConventionProfile = { arbitraryRatio: 0.0, arbitraryBudget: 0.05 };

type Resolved = {
  kind: 'string' | 'template' | 'call';
  /** 편집 가능한 정적 className */
  staticClass: string;
  /** staticClass 가 소스에서 차지하는 문자 범위 */
  range: { start: number; end: number };
  /** 진단용 */
  elementName: string;
};

/**
 * ① 주소로 요소를 해석한다. 파일 하나만 파싱한다.
 * className 이 문자열/템플릿/cn() 어느 쪽이든 "정적으로 수정 가능한 조각"의 범위를 찾는다.
 */
export function resolveByAddress(
  content: string,
  address: { line: number; column: number },
): Resolved | { error: string } {
  const ast = parseTsx(content);
  let hit: Resolved | { error: string } | null = null;

  walkAst(ast.program, (n) => {
    if (hit) return;
    if (n.type !== 'JSXOpeningElement' || !n.loc) return;
    if (n.loc.start.line !== address.line || n.loc.start.column !== address.column) return;

    const elementName = n.name?.name ?? '?';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const attr = (n.attributes ?? []).find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (a: any) => a.type === 'JSXAttribute' && a.name?.name === 'className',
    );
    if (!attr || !attr.value) {
      hit = { error: 'className 속성이 없음' };
      return;
    }

    if (attr.value.type === 'StringLiteral') {
      hit = {
        kind: 'string',
        staticClass: attr.value.value,
        range: { start: attr.value.start + 1, end: attr.value.end - 1 },
        elementName,
      };
      return;
    }

    const expr = attr.value.expression;

    if (expr?.type === 'TemplateLiteral') {
      // 보간이 아닌 정적 조각 중 유틸리티 토큰을 담은 첫 quasi 를 고른다
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const q = (expr.quasis ?? []).find((x: any) => x.value.raw.trim().length > 0);
      if (!q) {
        hit = { error: '템플릿에 정적 조각이 없음' };
        return;
      }
      hit = {
        kind: 'template',
        staticClass: q.value.raw,
        range: { start: q.start, end: q.end },
        elementName,
      };
      return;
    }

    if (expr?.type === 'CallExpression') {
      // cn('...', cond && '...') — 첫 문자열 인자가 기본 스타일 자리
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const first = (expr.arguments ?? []).find((a: any) => a.type === 'StringLiteral');
      if (!first) {
        hit = { error: `${expr.callee?.name ?? 'call'}() 에 문자열 리터럴 인자가 없음` };
        return;
      }
      hit = {
        kind: 'call',
        staticClass: first.value,
        range: { start: first.start + 1, end: first.end - 1 },
        elementName,
      };
      return;
    }

    hit = { error: `수정 불가한 className 표현식 (${expr?.type})` };
  });

  return hit ?? { error: '주소에 해당하는 요소를 찾지 못함' };
}

// ── ② 브레이크포인트 인식 토큰 편집 ────────────────────────────────────────

type Op = { prefix: string; px: number };

function bpPrefix(bp: Scenario['breakpoint']): string {
  return bp === 'base' ? '' : `${bp}:`;
}

function escapeRe(s: string): string {
  return s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
}

/**
 * 활성 브레이크포인트의 토큰만 찾는다.
 * 현행 findTwClass 는 접두사를 무시해서 lg 편집 중에 base 토큰을 잡는다 — 그 버그를 고친 버전.
 */
export function findTokenAtBreakpoint(
  className: string,
  prefix: string,
  bp: Scenario['breakpoint'],
): { token: string; index: number } | null {
  const bp_ = escapeRe(bpPrefix(bp));
  const p = escapeRe(prefix);
  const re = new RegExp(`^${bp_}-?${p}-(?:\\[[^\\]]+\\]|[\\d.]+|full|auto|screen|min|max|fit)$`);
  const toks = className.split(/\s+/).filter(Boolean);
  for (let i = 0; i < toks.length; i++) {
    if (re.test(toks[i])) return { token: toks[i], index: i };
  }
  return null;
}

/** ③ 컨벤션 린터: 같은 브레이크포인트의 충돌 토큰 제거 */
function removeConflicts(toks: string[], keepIndex: number, prefix: string, bp: Scenario['breakpoint']): string[] {
  const bp_ = escapeRe(bpPrefix(bp));
  const p = escapeRe(prefix);
  const re = new RegExp(`^${bp_}-?${p}-`);
  return toks.filter((t, i) => i === keepIndex || !re.test(t));
}

export type EditOutcome =
  | { ok: true; className: string; explanation: string[] }
  | { ok: false; abandon: string };

export function editClassName(
  className: string,
  ops: Op[],
  bp: Scenario['breakpoint'],
): EditOutcome {
  let toks = className.split(/\s+/).filter(Boolean);
  const explanation: string[] = [];

  for (const op of ops) {
    const cls = pxToTw(op.px, op.prefix);

    // 컨벤션 린터: 임의값 예산 검사
    if (cls.includes('[') && PROFILE.arbitraryRatio <= PROFILE.arbitraryBudget) {
      return {
        ok: false,
        abandon: `임의값 ${cls} 이 필요하지만 이 프로젝트는 임의값을 쓰지 않는다 (관측 ${(PROFILE.arbitraryRatio * 100).toFixed(0)}%) → T1(AI)로 위임`,
      };
    }

    const newTok = `${bpPrefix(bp)}${cls}`;
    const found = findTokenAtBreakpoint(toks.join(' '), op.prefix, bp);

    if (found) {
      toks[found.index] = newTok;
      toks = removeConflicts(toks, found.index, op.prefix, bp);
      explanation.push(`${found.token} → ${newTok}`);
    } else {
      toks.push(newTok);
      toks = removeConflicts(toks, toks.length - 1, op.prefix, bp);
      explanation.push(`+ ${newTok}`);
    }
  }

  return { ok: true, className: toks.join(' '), explanation };
}

/** 제스처 → 편집 연산. 2px 미만은 버린다 (A와 동일 임계값) */
function gestureToOps(s: Scenario): Op[] {
  const ops: Op[] = [];
  if (s.gesture.type === 'resize') {
    const dh = s.gesture.to.height - s.gesture.from.height;
    const dw = s.gesture.to.width - s.gesture.from.width;
    if (Math.abs(dh) > 2) ops.push({ prefix: 'h', px: Math.round(s.gesture.to.height) });
    if (Math.abs(dw) > 2) ops.push({ prefix: 'w', px: Math.round(s.gesture.to.width) });
  } else {
    const dy = s.gesture.to.y - s.gesture.from.y;
    const dx = s.gesture.to.x - s.gesture.from.x;
    if (Math.abs(dy) > 2) ops.push({ prefix: 'mt', px: Math.round(dy) });
    if (Math.abs(dx) > 2) ops.push({ prefix: 'ml', px: Math.round(dx) });
  }
  return ops;
}

export async function runB(s: Scenario): Promise<RunResult> {
  // ① 주소가 있으므로 파일 하나만 읽는다
  const t0 = performance.now();
  const src = loadOneSource(s.file);
  const before = src.content;

  const base = {
    version: 'B' as const,
    scenario: s.id,
    filesRead: 1,
    filesParsed: 1,
  };

  const resolved = resolveByAddress(before, s.address);
  if ('error' in resolved) {
    const elapsedMs = performance.now() - t0;
    return {
      ...base,
      elapsedMs,
      resolved: false,
      produced: false,
      applied: false,
      finalClassName: '',
      correct: s.expect.className === null,
      abandoned: true,
      abandonReason: resolved.error,
      pollution: 0,
      pollutionDetail: [],
      note: `포기(사유 보고): ${resolved.error}`,
    };
  }

  const ops = gestureToOps(s);
  const edit = editClassName(resolved.staticClass, ops, s.breakpoint);

  if (!edit.ok) {
    const elapsedMs = performance.now() - t0;
    return {
      ...base,
      elapsedMs,
      resolved: true,
      produced: false,
      applied: false,
      finalClassName: '',
      correct: s.expect.className === null,
      abandoned: true,
      abandonReason: edit.abandon,
      pollution: 0,
      pollutionDetail: [],
      note: `포기(사유 보고): ${edit.abandon}`,
    };
  }

  // 주소에서 온 문자 범위를 그대로 치환한다.
  // 현행 CodeDiff 는 (original, modified) 문자열 쌍뿐이라 apply 단계에서
  // indexOf 로 위치를 다시 찾는다 — 그 순간 주소가 버려지고 중복이 되살아난다.
  // 개선안은 range 를 apply 까지 전달한다.
  const attrStart = before.lastIndexOf('className', resolved.range.start);
  const guardOriginal = before.slice(attrStart, resolved.range.end + 1);
  const guardModified =
    before.slice(attrStart, resolved.range.start) + edit.className + before.slice(resolved.range.end, resolved.range.end + 1);

  const res = applyByRange(before, resolved.range, edit.className, {
    original: guardOriginal,
    modified: guardModified,
  });
  const elapsedMs = performance.now() - t0;

  if (!res.ok) {
    return {
      ...base,
      elapsedMs,
      resolved: true,
      produced: true,
      applied: false,
      finalClassName: '',
      correct: false,
      abandoned: false,
      pollution: 0,
      pollutionDetail: [],
      note: `apply 거부: ${res.reason}`,
    };
  }

  const after = res.content;
  const finalClassName = staticClassAt(after, s.address);
  const correct = s.expect.className !== null && finalClassName === s.expect.className;
  const pol = filePollution(before, after);

  return {
    ...base,
    elapsedMs,
    resolved: true,
    produced: true,
    applied: true,
    finalClassName,
    correct,
    abandoned: false,
    pollution: pol.total,
    pollutionDetail: [
      ...pol.duplicateTokens.map((d) => `중복: ${d}`),
      ...pol.arbitraryValues.map((v) => `임의값: ${v}`),
      ...(pol.inlineStyleAdded ? ['인라인 style 주입'] : []),
    ],
    note: `${resolved.kind} · ${edit.explanation.join(', ')}`,
  };
}
