/**
 * 드롭 중재 후보 생성 (P13 · PROD-642, 부모 편집은 P14 · PROD-643)
 *
 * 지금까지는 휴리스틱이 마진/순서 변경을 조용히 골랐다. 이 모듈은 한 번의
 * 드롭을 해석하는 결정론 후보들을 각자가 쓸 diff 와 함께 내놓는다 — 고르는
 * 것은 사람이고, 적용 후 판정은 여전히 화면이 한다.
 *
 * 후보:
 *   own          자기 요소의 마진 스냅(이동) / 크기(리사이즈) — 기존 T0 경로
 *   parent-gap   부모 flex/grid 의 gap 조정 — 형제 전원이 움직인다 (경고)
 *   parent-cols  부모 grid-cols 열 수 조정 — 리사이즈된 폭이 요구하는 열 수
 *   absolute     absolute + left/top — 반응형 흐름을 깬다 (최후 수단, 경고)
 *
 * 모든 diff 는 주소 해석 → attr 범위 splice 로 만들어져 기존 /api/apply 의
 * range 경로와 역치환 백업을 그대로 쓴다.
 */
import type {
  CodeDiff,
  ComponentChange,
  DetectedComponent,
  FidelityExpectation,
  SourceInput,
} from '@/types';
import { parseAddress, resolveAddressInSource, isResolveFailure } from './address-resolver';
import { editClassTokens, bpFromWidth, type TokenOp, type EditTokensResult } from './rewriters/breakpoint-tailwind';
import { generateRefactorResult } from './refactor-client';

export interface ParentContext {
  address?: string;
  boundingBox: { x: number; y: number; width: number; height: number };
  display: string;
  position: string;
  gap: string;
  flexDirection?: string;
}

export interface EditCandidate {
  id: 'own' | 'parent-gap' | 'parent-cols' | 'absolute';
  label: string;
  explanation: string;
  diffs: CodeDiff[];
  expectations: FidelityExpectation[];
  warning?: string;
}

export interface CandidateInput {
  change: ComponentChange;
  component: DetectedComponent;
  parent?: ParentContext;
  sources: SourceInput[];
  viewportWidth?: number;
}

export interface CandidateOutput {
  candidates: EditCandidate[];
  /** 만들 수 없었던 후보의 사유 — UI 가 "왜 이 선택지가 없는지" 보여줄 수 있다 */
  skipped: string[];
}

const BP_RE = /^(?:(sm|md|lg|xl|2xl):)?/;
const BP_ORDER = ['base', 'sm', 'md', 'lg', 'xl', '2xl'];

/** 주소 하나에 className 편집 함수를 적용해 range diff 를 만든다 */
export function diffAtAddress(
  address: string,
  sources: SourceInput[],
  editFn: (staticClass: string) => EditTokensResult,
): { diff: CodeDiff } | { reason: string } {
  const parsed = parseAddress(address);
  if (!parsed) return { reason: `주소 형식 오류: ${address}` };
  const source = sources.find((s) => s.path === parsed.file);
  if (!source) return { reason: `주소의 파일이 소스 목록에 없음: ${parsed.file}` };
  const resolved = resolveAddressInSource(source.content, parsed.line, parsed.column);
  if (isResolveFailure(resolved)) return { reason: resolved.error };

  const edit = editFn(resolved.staticClass);
  if (!edit.ok) return { reason: edit.reason };

  const content = source.content;
  const original = content.slice(resolved.attrStart, resolved.attrEnd);
  const modified =
    content.slice(resolved.attrStart, resolved.valueRange.start) +
    edit.className +
    content.slice(resolved.valueRange.end, resolved.attrEnd);
  if (modified === original) return { reason: '변경 결과가 원본과 동일' };

  return {
    diff: {
      file: source.path,
      original,
      modified,
      lineNumber: resolved.lineNumber,
      explanation: edit.explanation,
      strategy: 'tailwind',
      range: { start: resolved.attrStart, end: resolved.attrEnd },
    },
  };
}

/** getComputedStyle().gap ("32px 4px" | "16px" | "normal") → 축의 px 값 */
export function parseGapPx(gap: string, axis: 'row' | 'column'): number | null {
  const parts = gap.trim().split(/\s+/);
  const pick = parts.length > 1 ? (axis === 'row' ? parts[0] : parts[1]) : parts[0];
  const m = /^(-?\d+(?:\.\d+)?)px$/.exec(pick ?? '');
  return m ? parseFloat(m[1]) : null;
}

/** 지배 grid-cols-N 토큰을 M 으로 교체 (bp 규칙은 editClassTokens 와 동일) */
export function editGridCols(
  className: string,
  targetCols: number,
  viewportWidth?: number,
): EditTokensResult {
  const active = bpFromWidth(viewportWidth);
  const activeIdx = BP_ORDER.indexOf(active);
  const tokens = className.split(/\s+/).filter(Boolean);
  let governing: { index: number; bp: string; cols: number } | null = null;
  tokens.forEach((t, i) => {
    const m = /^(?:(sm|md|lg|xl|2xl):)?grid-cols-(\d+)$/.exec(t);
    if (!m) return;
    const bp = m[1] ?? 'base';
    if (BP_ORDER.indexOf(bp) > activeIdx) return;
    if (!governing || BP_ORDER.indexOf(bp) > BP_ORDER.indexOf(governing.bp)) {
      governing = { index: i, bp, cols: parseInt(m[2], 10) };
    }
  });
  if (!governing) return { ok: false, reason: '부모에 활성 뷰포트가 보는 grid-cols-N 토큰이 없음' };
  const g: { index: number; bp: string; cols: number } = governing;
  if (g.cols === targetCols) {
    return { ok: false, reason: `이미 ${targetCols}열` };
  }
  const prefix = g.bp === 'base' ? '' : `${g.bp}:`;
  const nextToken = `${prefix}grid-cols-${targetCols}`;
  const prevToken = tokens[g.index];
  tokens[g.index] = nextToken;
  return { ok: true, className: tokens.join(' '), explanation: `${prevToken} → ${nextToken}` };
}

/** position/left/top 토큰을 걷어내고 absolute + 좌표를 단다 (bp 없음 — 경고 대상) */
export function editToAbsolute(
  className: string,
  left: number,
  top: number,
): EditTokensResult {
  const drop = (t: string) => {
    const bare = t.replace(BP_RE, '');
    return (
      /^(static|relative|absolute|fixed|sticky)$/.test(bare) ||
      /^-?(left|top|right|bottom|inset)(-|\[)/.test(bare)
    );
  };
  const tokens = className.split(/\s+/).filter(Boolean).filter((t) => !drop(t));
  const added = ['absolute', `left-[${Math.round(left)}px]`, `top-[${Math.round(top)}px]`];
  tokens.push(...added);
  return { ok: true, className: tokens.join(' '), explanation: `+ ${added.join(' ')}` };
}

export async function buildCandidates(input: CandidateInput): Promise<CandidateOutput> {
  const { change, component, parent, sources, viewportWidth } = input;
  const candidates: EditCandidate[] = [];
  const skipped: string[] = [];
  const isMove = change.type === 'move';
  const dx = Math.round((change.to.x ?? 0) - (change.from.x ?? 0));
  const dy = Math.round((change.to.y ?? 0) - (change.from.y ?? 0));

  // 1) own — 기존 T0 경로 그대로 (마진 스냅 / 크기)
  const own = await generateRefactorResult({
    changes: [change],
    components: [component],
    sources,
    viewportWidth,
    tailwindProject: true,
  });
  if (own.diffs.length > 0) {
    candidates.push({
      id: 'own',
      label: isMove ? "This element's margin (snap to scale)" : "This element's size",
      explanation: own.diffs[0].explanation,
      diffs: own.diffs,
      expectations: own.expectations,
      warning: isMove ? 'Flow edit — following siblings shift too' : undefined,
    });
  } else if (own.skipped[0]) {
    skipped.push(`own: ${own.skipped[0].reason}`);
  }

  // 2) parent-gap — 이동을 "이 줄의 간격" 으로 해석 (형제 전원이 움직인다)
  if (isMove && parent?.address && /^(flex|grid|inline-flex|inline-grid)$/.test(parent.display)) {
    const columnAxis = (parent.flexDirection ?? '').startsWith('column');
    const delta = columnAxis ? dy : dx;
    const gapPx = parseGapPx(parent.gap, columnAxis ? 'row' : 'column');
    if (gapPx == null) {
      skipped.push('parent-gap: 부모 gap 이 px 로 측정되지 않음');
    } else if (Math.abs(delta) < 3) {
      skipped.push('parent-gap: 축 방향 이동이 3px 미만');
    } else {
      const ops: TokenOp[] = [{ prefix: columnAxis ? 'gap-y' : 'gap-x', px: delta, mode: 'snap' }];
      // gap-x/gap-y 토큰이 없으면 gap 통합 토큰을 시도한다
      const r1 = diffAtAddress(parent.address, sources, (cls) => {
        const bare = editClassTokens(cls, [{ prefix: 'gap', px: delta, mode: 'snap' }], viewportWidth);
        const axis = editClassTokens(cls, ops, viewportWidth);
        // 축 토큰이 실제로 존재해 교체됐다면 축을 우선한다
        const axisRe = new RegExp(`(?:^|\\s)(?:(?:sm|md|lg|xl|2xl):)?${columnAxis ? 'gap-y' : 'gap-x'}-`);
        return axisRe.test(cls) ? axis : bare;
      });
      if ('diff' in r1) {
        candidates.push({
          id: 'parent-gap',
          label: 'Parent gap',
          explanation: r1.diff.explanation,
          diffs: [r1.diff],
          expectations: [],
          warning: 'Every sibling in this container moves',
        });
      } else {
        skipped.push(`parent-gap: ${r1.reason}`);
      }
    }
  }

  // 3) parent-cols — 리사이즈된 폭이 요구하는 열 수 (그리드 자식 전용)
  if (!isMove && parent?.address && /grid/.test(parent.display)) {
    const newW = change.to.width ?? 0;
    if (newW >= 40 && parent.boundingBox.width > 0) {
      const target = Math.min(6, Math.max(1, Math.round(parent.boundingBox.width / newW)));
      const r = diffAtAddress(parent.address, sources, (cls) => editGridCols(cls, target, viewportWidth));
      if ('diff' in r) {
        candidates.push({
          id: 'parent-cols',
          label: `Parent grid → ${target} column${target > 1 ? 's' : ''}`,
          explanation: r.diff.explanation,
          diffs: [r.diff],
          expectations: [],
          warning: 'Reflows the whole row',
        });
      } else {
        skipped.push(`parent-cols: ${r.reason}`);
      }
    }
  }

  // 4) absolute — 최후 수단. 부모가 positioned 일 때만 좌표가 의미를 가진다
  if (isMove && component.sourceAddress) {
    if (!parent) {
      skipped.push('absolute: 부모 정보 없음');
    } else if (parent.position === 'static') {
      skipped.push('absolute: 부모가 static — 좌표가 페이지 기준이 되어 제외');
    } else {
      const left = Math.round((change.to.x ?? 0) - parent.boundingBox.x);
      const top = Math.round((change.to.y ?? 0) - parent.boundingBox.y);
      const r = diffAtAddress(component.sourceAddress, sources, (cls) => editToAbsolute(cls, left, top));
      if ('diff' in r) {
        candidates.push({
          id: 'absolute',
          label: 'Absolute position',
          explanation: r.diff.explanation,
          diffs: [r.diff],
          expectations: [
            {
              componentId: component.id,
              expectedStyles: {
                ...(dx !== 0 ? { marginLeft: `${dx}px` } : {}),
                ...(dy !== 0 ? { marginTop: `${dy}px` } : {}),
              },
              sourceFile: r.diff.file,
            },
          ],
          warning: 'Breaks responsive flow — last resort',
        });
      } else {
        skipped.push(`absolute: ${r.reason}`);
      }
    }
  }

  return { candidates, skipped };
}
