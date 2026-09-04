/**
 * 지배 토큰 편집기 (P3 · PROD-633)
 *
 * 기존 findTwClass 는 브레이크포인트 접두사를 보지 않아 lg 에서 한 편집이
 * base 토큰을 덮어썼다 (하네스 실험 1 / S6 — h-32 md:h-48 lg:h-64 가
 * h-80 md:h-48 lg:h-64 로, 모바일 높이가 조용히 320px 가 된다).
 *
 * 규칙 (PRD D3 · D7):
 * - 지배 토큰 = 그 속성의 토큰 중 bp ≤ 활성 뷰포트에서 가장 큰 것.
 *   교체는 그 토큰의 접두사를 유지한다. 없으면 base 로 추가한다 —
 *   새 브레이크포인트를 발명해 다른 화면 폭을 조용히 바꾸지 않는다.
 * - 이동(margin)은 스케일로 스냅한다: 드래그 위치는 본질적으로 부정확하므로
 *   가장 가까운 프리셋이 의도에 가장 가깝다. mt-[12px] 은 mt-3 이 된다.
 * - 크기(w/h)는 사용자가 고른 명시값이므로 ±2px 프리셋 우선 후 임의값 허용.
 * - 같은 (브레이크포인트, 속성) 의 잔여 충돌 토큰은 제거한다 (컨벤션 린터).
 *
 * hover:/dark: 등 상태 변형이 섞인 토큰은 지배 판정에서 제외하고 건드리지
 * 않는다 — 화면에 보이지 않는 상태를 드래그가 대변할 수 없다.
 */
import { pxToTw, parseTwPx } from './tailwind-utils';

export type Breakpoint = 'base' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

export const BP_MIN: Record<Breakpoint, number> = {
  base: 0,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
};

const BP_ORDER: Breakpoint[] = ['base', 'sm', 'md', 'lg', 'xl', '2xl'];

export function bpFromWidth(width?: number): Breakpoint {
  const w = typeof width === 'number' && Number.isFinite(width) ? width : 1280;
  let out: Breakpoint = 'base';
  for (const bp of BP_ORDER) {
    if (w >= BP_MIN[bp]) out = bp;
  }
  return out;
}

/** Tailwind 스페이싱 스케일 px 값 (tailwind-utils TW_MAP 과 동일 근원) */
const SCALE_PX = [0, 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 36, 40, 44, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 288, 320, 384];

/** 가장 가까운 스케일 값으로 스냅 (동률이면 작은 쪽) */
export function snapToScalePx(px: number): number {
  const abs = Math.abs(px);
  let best = SCALE_PX[0];
  for (const s of SCALE_PX) {
    if (Math.abs(s - abs) < Math.abs(best - abs)) best = s;
  }
  return px < 0 ? -best : best;
}

export interface TokenOp {
  /** 유틸리티 접두사: h, w, mt, ml, mr, mb */
  prefix: string;
  /** 목표 px. margin 은 델타(음수 가능), 크기는 절대값 */
  px: number;
  /** snap = 스케일 스냅(이동), absolute = ±2px 프리셋 후 임의값(크기) */
  mode: 'snap' | 'absolute';
}

const OP_TABLE: Record<string, { prefix: string; mode: TokenOp['mode'] }> = {
  height: { prefix: 'h', mode: 'absolute' },
  width: { prefix: 'w', mode: 'absolute' },
  marginTop: { prefix: 'mt', mode: 'snap' },
  marginLeft: { prefix: 'ml', mode: 'snap' },
  marginRight: { prefix: 'mr', mode: 'snap' },
  marginBottom: { prefix: 'mb', mode: 'snap' },
};

function parsePx(value: string): number | null {
  const m = /^(-?\d+(?:\.\d+)?)px$/.exec(value);
  return m ? parseFloat(m[1]) : null;
}

/** targetStyles → 토큰 연산 목록. 다루지 못하는 속성은 unsupported 로 보고한다. */
export function opsFromTargetStyles(
  targetStyles: Record<string, string>,
): { ops: TokenOp[]; unsupported: string[] } {
  const ops: TokenOp[] = [];
  const unsupported: string[] = [];
  for (const [prop, value] of Object.entries(targetStyles)) {
    const spec = OP_TABLE[prop];
    const px = parsePx(value);
    if (!spec || px == null) {
      unsupported.push(prop);
      continue;
    }
    ops.push({ prefix: spec.prefix, px, mode: spec.mode });
  }
  return { ops, unsupported };
}

interface TokenInfo {
  index: number;
  token: string;
  bp: Breakpoint;
  negative: boolean;
}

/** 순수 bp 접두사(또는 없음)만 허용 — hover: 등 상태 변형은 제외 */
function tokenInfoFor(token: string, prefix: string): TokenInfo | null {
  const esc = prefix.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const re = new RegExp(
    `^(?:(sm|md|lg|xl|2xl):)?(-)?${esc}-(?:\\[-?\\d+(?:\\.\\d+)?px\\]|\\d+(?:\\.\\d+)?|px|full|auto|screen|min|max|fit)$`,
  );
  const m = re.exec(token);
  if (!m) return null;
  return { index: -1, token, bp: (m[1] as Breakpoint) ?? 'base', negative: m[2] === '-' };
}

function valueClass(op: TokenOp): string {
  if (op.mode === 'snap') {
    const snapped = snapToScalePx(Math.round(op.px));
    const cls = pxToTw(Math.abs(snapped), op.prefix); // 스냅 후에는 항상 프리셋
    return snapped < 0 ? `-${cls}` : cls;
  }
  const px = Math.max(0, Math.round(op.px)); // 크기는 음수가 없다
  return pxToTw(px, op.prefix);
}

export type EditTokensResult =
  | { ok: true; className: string; explanation: string }
  | { ok: false; reason: string };

/**
 * className 문자열에 토큰 연산을 적용한다.
 * 반환 문자열은 토큰 순서를 보존하며, 같은 (bp, 접두사) 충돌은 정리된다.
 */
export function editClassTokens(
  className: string,
  ops: TokenOp[],
  viewportWidth?: number,
): EditTokensResult {
  if (ops.length === 0) return { ok: false, reason: '적용할 스타일 변경이 없음 (2px 미만)' };

  const active = bpFromWidth(viewportWidth);
  const activeIdx = BP_ORDER.indexOf(active);
  let tokens = className.split(/\s+/).filter(Boolean);
  const notes: string[] = [];

  for (const op of ops) {
    const infos: TokenInfo[] = [];
    tokens.forEach((t, i) => {
      const info = tokenInfoFor(t, op.prefix);
      if (info) infos.push({ ...info, index: i });
    });

    // 지배 토큰: bp ≤ 활성 중 가장 큰 것
    const governing = infos
      .filter((i) => BP_ORDER.indexOf(i.bp) <= activeIdx)
      .sort((a, b) => BP_ORDER.indexOf(b.bp) - BP_ORDER.indexOf(a.bp))[0];

    const cls = valueClass(op);

    if (governing) {
      let next: string;
      if (op.mode === 'snap') {
        // margin 델타: 기존 값에 더한 뒤 스냅한다 (기존 mt-4 에서 +12px → mt-7)
        const bare = governing.token.replace(/^(?:sm|md|lg|xl|2xl):/, '').replace(/^-/, '');
        const parsedCurrent = parseTwPx(bare, op.prefix);
        const current = Number.isFinite(parsedCurrent)
          ? (governing.negative ? -1 : 1) * parsedCurrent
          : 0; // mt-auto 등 수치화 불가 토큰은 0 기준으로 대체한다
        const target = snapToScalePx(Math.round(current + op.px));
        const base = pxToTw(Math.abs(target), op.prefix);
        next = (governing.bp === 'base' ? '' : `${governing.bp}:`) + (target < 0 ? `-${base}` : base);
      } else {
        next = (governing.bp === 'base' ? '' : `${governing.bp}:`) + cls;
      }
      if (next === governing.token) continue;
      tokens[governing.index] = next;
      notes.push(`${governing.token} → ${next}`);
      // 컨벤션 린터: 같은 bp 의 잔여 충돌 토큰 제거
      tokens = tokens.filter((t, i) => {
        if (i === governing.index) return true;
        const info = tokenInfoFor(t, op.prefix);
        return !(info && info.bp === governing.bp);
      });
    } else {
      // 지배 토큰 없음 → base 로 추가 (D3: 새 브레이크포인트를 발명하지 않는다)
      tokens.push(cls);
      notes.push(`+ ${cls}`);
    }
  }

  const next = tokens.join(' ');
  if (next === className.trim().replace(/\s+/g, ' ')) {
    return { ok: false, reason: '변경 결과가 기존 className 과 동일' };
  }
  return { ok: true, className: next, explanation: notes.join(', ') };
}
