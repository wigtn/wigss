/**
 * T1 모델 폴백 (P9 · PROD-638)
 *
 * T0(결정론 지배 토큰 편집)가 사유 있는 포기를 냈거나 화면 검증이 어긋났을 때,
 * 범위를 좁혀 Claude 에 수선을 위임한다. 리포트의 논지 전환 그 구현체다 —
 * "모델이 코드를 쓰되, 결과는 화면으로 채점하고 어긋나면 되돌린다."
 *
 * 울타리 4겹 (전부 결정론 경로와 동일):
 *   1. 범위 강제 — 모델 출력은 정적 className 조각 자리에만 splice 된다.
 *      파일의 다른 어떤 바이트도 물리적으로 바꿀 수 없다.
 *   2. 출력 검증 — 한 줄, 클래스 토큰 문법만 허용. 따옴표·태그·세미콜론·
 *      style= 이 보이면 폐기한다.
 *   3. apply 가드 — range 드리프트 검사와 JS 토큰 패리티는 /api/apply 가
 *      결정론 diff 와 똑같이 적용한다.
 *   4. 화면 재측정 — 최종 심판. 어긋나면 역치환 롤백된다.
 *
 * 모델에게 주는 것: 요소 주변 ±8줄, 목표 스타일, 활성 브레이크포인트,
 * T0 의 포기 사유(있다면), 검증 불일치(있다면). 파일 전체를 주지 않는다 —
 * 토큰 절약과 피해 반경 제한이 같은 설계에서 나온다.
 */
import type { CodeDiff } from '@/types';
import { callClaude, type ClaudeRequest, type ClaudeResponse } from './providers/claude';
import { readSettings } from '@/lib/settings';
import { resolveAddressInSource, isResolveFailure } from './address-resolver';
import { bpFromWidth } from './rewriters/breakpoint-tailwind';

export interface RepairMismatch {
  property: string;
  expected: string;
  actual: string;
}

export interface RepairInput {
  file: string;
  content: string;
  line: number;
  column: number;
  targetStyles: Record<string, string>;
  /** T2(PROD-643): 사용자의 자연어 지시 — 있으면 targetStyles 보다 우선한다 */
  instruction?: string;
  viewportWidth?: number;
  /** T0 가 포기한 사유 (있다면 모델에게 알려준다) */
  reason?: string;
  /** 화면 검증 불일치 (재수선 모드) */
  mismatches?: RepairMismatch[];
}

export type RepairResult =
  | { ok: true; diff: CodeDiff; fragment: string }
  | { ok: false; reason: string };

/** 모델 출력 검증기 — 한 줄짜리 클래스 목록만 통과한다 */
export function validateClassFragment(raw: string): { ok: true; fragment: string } | { ok: false; reason: string } {
  const text = raw.trim();
  if (!text) return { ok: false, reason: '모델 응답이 비어 있음' };
  if (text.includes('\n')) return { ok: false, reason: '모델 응답이 여러 줄' };
  if (text.length > 400) return { ok: false, reason: '모델 응답이 너무 김' };
  if (/["'`<>{};]|style=/.test(text)) {
    return { ok: false, reason: '클래스 목록이 아닌 문자가 포함됨' };
  }
  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.length === 0 || tokens.length > 40) {
    return { ok: false, reason: `토큰 수 비정상 (${tokens.length})` };
  }
  const tokenRe = /^[!-]?[a-zA-Z0-9:_[\]/.%#-]+$/;
  for (const t of tokens) {
    if (!tokenRe.test(t)) return { ok: false, reason: `허용되지 않는 토큰: ${t.slice(0, 30)}` };
  }
  return { ok: true, fragment: tokens.join(' ') };
}

const SYSTEM_PROMPT = `당신은 WIGSS 의 Tailwind className 수선기입니다.
주어진 정적 className 조각을, 요구된 스타일 변경이 반영되도록 고쳐서
**클래스 목록 한 줄만** 응답하세요.

규칙:
- 응답은 공백으로 구분된 Tailwind 클래스 토큰만. 따옴표·설명·코드블록 금지.
- 요구와 무관한 기존 토큰은 그대로 보존하세요.
- 활성 브레이크포인트가 base 가 아니면 그 접두사(md:, lg: 등)가 붙은 토큰을 수정 대상으로 하고,
  다른 브레이크포인트의 토큰은 건드리지 마세요.
- 스페이싱은 프리셋 스케일을 우선하고, 스케일에 없는 값만 임의값([Npx])을 쓰세요.
- 인라인 스타일이나 새 속성을 발명하지 마세요.`;

type CallFn = (req: ClaudeRequest) => Promise<ClaudeResponse>;

export async function repairWithModel(
  input: RepairInput,
  call: CallFn = callClaude,
): Promise<RepairResult> {
  const resolved = resolveAddressInSource(input.content, input.line, input.column);
  if (isResolveFailure(resolved)) {
    return { ok: false, reason: `T1 불가 — ${resolved.error}` };
  }

  const lines = input.content.split('\n');
  const from = Math.max(0, input.line - 1 - 8);
  const to = Math.min(lines.length, input.line - 1 + 9);
  const context = lines.slice(from, to).join('\n');

  const bp = bpFromWidth(input.viewportWidth);
  const styleWants = Object.entries(input.targetStyles)
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ');
  const wants = input.instruction
    ? `사용자 지시(T2): ${input.instruction}` + (styleWants ? ` (참고 측정값: ${styleWants})` : '')
    : styleWants;
  if (!wants) return { ok: false, reason: 'T1 불가 — 목표 스타일도 지시도 없음' };

  const userMessage = [
    `파일: ${input.file} (<${resolved.elementName}>)`,
    `활성 브레이크포인트: ${bp}`,
    `현재 정적 className 조각:`,
    resolved.staticClass,
    ``,
    `요구된 스타일 변경: ${wants}`,
    input.reason ? `결정론 편집기가 포기한 사유: ${input.reason}` : '',
    input.mismatches?.length
      ? `화면 검증 불일치: ${input.mismatches.map((m) => `${m.property} 기대 ${m.expected} 실제 ${m.actual}`).join('; ')}`
      : '',
    ``,
    `주변 소스 (참고용, 수정 금지):`,
    '```',
    context,
    '```',
    ``,
    `수정된 클래스 목록 한 줄만 응답:`,
  ]
    .filter((l) => l !== '')
    .join('\n');

  let res: ClaudeResponse;
  try {
    res = await call({
      model: readSettings().claudeModel,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
      temperature: 0.2,
      max_tokens: 300,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/인증|auth|credential/i.test(msg)) {
      return { ok: false, reason: `NO_AUTH: Claude 인증 없음 — T1 건너뜀` };
    }
    return { ok: false, reason: `모델 호출 실패: ${msg.slice(0, 160)}` };
  }

  const validated = validateClassFragment(res.text ?? '');
  if (!validated.ok) return { ok: false, reason: `모델 출력 폐기 — ${validated.reason}` };
  if (validated.fragment === resolved.staticClass.trim().replace(/\s+/g, ' ')) {
    return { ok: false, reason: '모델이 변경 없이 동일한 조각을 반환' };
  }

  const content = input.content;
  const original = content.slice(resolved.attrStart, resolved.attrEnd);
  const modified =
    content.slice(resolved.attrStart, resolved.valueRange.start) +
    validated.fragment +
    content.slice(resolved.valueRange.end, resolved.attrEnd);

  return {
    ok: true,
    fragment: validated.fragment,
    diff: {
      file: input.file,
      original,
      modified,
      lineNumber: resolved.lineNumber,
      explanation: `T1 model repair: ${resolved.staticClass.slice(0, 40)} → ${validated.fragment.slice(0, 40)}`,
      strategy: 'tailwind',
      range: { start: resolved.attrStart, end: resolved.attrEnd },
    },
  };
}
