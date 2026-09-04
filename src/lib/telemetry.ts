/**
 * 로컬 텔레메트리 (P11 · PROD-640)
 *
 * 편집 시도의 결과를 ~/.wigss/telemetry.jsonl 에 한 줄씩 기록한다.
 * 리포트가 지적한 그 계측이다 — "나중에 붙이면 데이터가 안 쌓인다."
 * T0 성공률, 사유별 포기 분포, T1 구제율과 검증 탈락률(킬러 지표)이
 * 전부 이 파일에서 나온다.
 *
 * 원칙:
 * - 전송 없음. 로컬 파일 전용. 소스 코드 내용은 기록하지 않는다.
 * - WIGSS_TELEMETRY=0 으로 끈다.
 * - 기록 실패가 편집을 실패시키지 않는다 (fire-and-forget).
 */
import { appendFileSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

export type EditTier = 'T0' | 'T1';
export type EditIntentKind = 'style' | 'structure';
export type EditResult = 'pass' | 'fail' | 'abandon' | 'repaired' | 'rolled_back' | 'refused';

export interface EditAttemptEvent {
  tier: EditTier;
  intent: EditIntentKind;
  result: EditResult;
  breakpoint?: string;
  failReason?: string;
  latencyMs?: number;
}

export function telemetryEnabled(): boolean {
  return process.env.WIGSS_TELEMETRY !== '0';
}

export function telemetryPath(): string {
  // 테스트 주입용 오버라이드
  return process.env.WIGSS_TELEMETRY_PATH || join(homedir(), '.wigss', 'telemetry.jsonl');
}

export function recordEditAttempt(event: EditAttemptEvent): void {
  if (!telemetryEnabled()) return;
  try {
    const file = telemetryPath();
    mkdirSync(join(file, '..'), { recursive: true });
    appendFileSync(
      file,
      JSON.stringify({ ts: new Date().toISOString(), type: 'edit_attempt', ...event }) + '\n',
      'utf8',
    );
  } catch {
    // 계측이 제품을 방해하면 안 된다
  }
}
