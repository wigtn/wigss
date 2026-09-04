/**
 * 구조 편집기 (P8 · PROD-637) — StructureIntent 의 첫 구현: 형제 순서 변경.
 *
 * 드래그앤드롭에서 사용자가 기대하는 동작 중 스타일로 표현할 수 없는 것이
 * 순서 변경이다 ("이 카드를 저 앞으로"). 주소가 지목한 JSX 요소를 같은 부모
 * 안의 다른 인덱스로 옮기는 순수 텍스트 이동이며, 결정론적이다.
 *
 * 포맷 보존 전략: 형제 요소들 사이의 구분 텍스트(개행·들여쓰기)는 제자리에
 * 두고 요소 조각만 재배열한다. 구분자가 위치를 지키므로 들여쓰기가 유지된다.
 *
 * 불변식: 순서 변경은 순수 이동이므로 original 과 modified 는 문자 다중집합이
 * 같아야 한다(애너그램). apply 가드는 이 불변식으로 구조 diff 를 검증한다 —
 * className 존재 검사보다 강한 보장이다 (<Card /> 는 className 이 없다).
 *
 * .map() 렌더 안의 항목은 사유 있는 포기다: 화면의 순서는 배열의 순서이지
 * JSX 의 순서가 아니다. 배열 수정은 T1/후속 범위.
 */
import { parse } from '@babel/parser';
import type { CodeDiff } from '@/types';

/* eslint-disable @typescript-eslint/no-explicit-any */

export type ReorderResult =
  | { ok: true; diff: CodeDiff; fromIndex: number; toIndex: number; siblingCount: number }
  | { ok: false; reason: string };

interface Found {
  element: any; // JSXElement (여는 태그가 주소와 일치)
  parentElement: any | null; // 가장 가까운 JSXElement 조상
  crossesFunction: boolean; // 조상 경로에 함수/콜백이 끼어 있는가 (.map 등)
}

function findElementAt(ast: any, line: number, column: number): Found | null {
  let found: Found | null = null;

  function walk(node: any, ancestors: any[]): void {
    if (!node || typeof node !== 'object' || found) return;
    if (node.type === 'JSXElement' && node.openingElement?.loc) {
      const loc = node.openingElement.loc.start;
      if (loc.line === line && (loc.column === column - 1 || loc.column === column)) {
        let parentElement: any = null;
        let crossesFunction = false;
        for (let i = ancestors.length - 1; i >= 0; i--) {
          const a = ancestors[i];
          if (a.type === 'JSXElement' || a.type === 'JSXFragment') {
            parentElement = a;
            break;
          }
          if (
            a.type === 'ArrowFunctionExpression' ||
            a.type === 'FunctionExpression' ||
            a.type === 'CallExpression'
          ) {
            crossesFunction = true;
          }
        }
        found = { element: node, parentElement, crossesFunction };
        return;
      }
    }
    for (const key of Object.keys(node)) {
      if (key === 'loc' || key === 'start' || key === 'end') continue;
      const child = node[key];
      if (Array.isArray(child)) {
        for (const item of child) {
          if (item && typeof item === 'object' && item.type) walk(item, [...ancestors, node]);
        }
      } else if (child && typeof child === 'object' && child.type) {
        walk(child, [...ancestors, node]);
      }
    }
  }

  walk(ast.program, []);
  return found;
}

/** 순수 이동 불변식 — 문자 다중집합 동일성 */
export function isCharPermutation(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const count = new Map<string, number>();
  for (const ch of a) count.set(ch, (count.get(ch) ?? 0) + 1);
  for (const ch of b) {
    const n = count.get(ch);
    if (!n) return false;
    count.set(ch, n - 1);
  }
  return true;
}

/**
 * 주소의 요소를 같은 부모의 toIndex 위치로 옮긴 diff 를 만든다.
 * toIndex 는 형제 JSXElement 기준 0-기반이며 범위 밖이면 양끝으로 클램프된다.
 */
export function reorderSibling(
  content: string,
  file: string,
  line: number,
  column: number,
  toIndex: number,
): ReorderResult {
  let ast: any;
  try {
    ast = parse(content, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
      errorRecovery: true,
    });
  } catch (err) {
    return { ok: false, reason: `소스 파싱 실패: ${err instanceof Error ? err.message : String(err)}` };
  }

  const found = findElementAt(ast, line, column);
  if (!found) {
    return { ok: false, reason: `주소 ${line}:${column} 에 해당하는 JSX 요소가 없음 — 재스캔 필요` };
  }
  if (!found.parentElement) {
    return { ok: false, reason: '같은 부모 안의 형제가 없음 (최상위 요소)' };
  }
  if (found.crossesFunction) {
    return {
      ok: false,
      reason: '.map() 등 콜백 렌더 안의 항목 — 화면 순서는 배열 순서이므로 JSX 이동으로 표현 불가',
    };
  }

  const siblings: any[] = (found.parentElement.children ?? []).filter(
    (c: any) => c.type === 'JSXElement',
  );
  if (siblings.length < 2) {
    return { ok: false, reason: '옮길 형제가 없음 (형제 1개)' };
  }

  const fromIndex = siblings.indexOf(found.element);
  if (fromIndex === -1) {
    return { ok: false, reason: '요소가 부모의 직접 자식이 아님' };
  }

  const clamped = Math.max(0, Math.min(siblings.length - 1, toIndex));
  if (clamped === fromIndex) {
    return { ok: false, reason: '이미 그 위치에 있음' };
  }

  // 영역: 첫 형제 시작 ~ 마지막 형제 끝. 구분자는 제자리, 요소만 재배열.
  const regionStart: number = siblings[0].start;
  const regionEnd: number = siblings[siblings.length - 1].end;
  const pieces = siblings.map((s: any) => content.slice(s.start, s.end));
  const separators: string[] = [];
  for (let i = 0; i < siblings.length - 1; i++) {
    separators.push(content.slice(siblings[i].end, siblings[i + 1].start));
  }

  const order = siblings.map((_: any, i: number) => i);
  order.splice(fromIndex, 1);
  order.splice(clamped, 0, fromIndex);

  let rebuilt = '';
  for (let i = 0; i < order.length; i++) {
    rebuilt += pieces[order[i]];
    if (i < separators.length) rebuilt += separators[i];
  }

  const original = content.slice(regionStart, regionEnd);
  if (rebuilt === original) {
    return { ok: false, reason: '변경 결과가 원본과 동일' };
  }
  if (!isCharPermutation(original, rebuilt)) {
    // 이 경로는 논리 오류를 뜻한다 — 부분 손상 diff 를 절대 내보내지 않는다
    return { ok: false, reason: '내부 불변식 위반: 순수 이동이 아님 (버그 방지 차단)' };
  }

  return {
    ok: true,
    fromIndex,
    toIndex: clamped,
    siblingCount: siblings.length,
    diff: {
      file,
      original,
      modified: rebuilt,
      lineNumber: line,
      explanation: `순서 변경: ${fromIndex + 1}번째 → ${clamped + 1}번째 (형제 ${siblings.length}개)`,
      range: { start: regionStart, end: regionEnd },
    },
  };
}
