/**
 * wigss 런타임 설정 (provider 선택 등). 서버측 영속화 — ~/.wigss/settings.json.
 * 에이전트(llm-client)가 read, 설정 API가 write. CLI 재실행에도 유지.
 *
 * 현재 provider는 Claude(Code 구독제)만 지원 — 향후 추가 가능한 골격으로 둔다.
 * Claude는 로컬 ~/.claude OAuth를 쓰므로 저장할 시크릿(API 키)이 없다.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

export type ProviderId = 'claude';

export interface WigssSettings {
  /** 활성 LLM provider — 현재 Claude(Code 구독제)만 */
  provider: ProviderId;
  /** Claude(Code 구독제) 모델 */
  claudeModel: string;
}

const DEFAULTS: WigssSettings = {
  provider: 'claude',
  claudeModel: process.env.WIGSS_CLAUDE_MODEL || 'claude-haiku-4-5-20251001',
};

const FILE = join(homedir(), '.wigss', 'settings.json');

export function readSettings(): WigssSettings {
  try {
    const saved = JSON.parse(readFileSync(FILE, 'utf8')) as Partial<WigssSettings>;
    // provider는 claude 고정 (레거시 openai 값은 무시). 알려진 필드만 재구성.
    return {
      provider: 'claude',
      claudeModel: saved.claudeModel || DEFAULTS.claudeModel,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function writeSettings(patch: Partial<WigssSettings>): WigssSettings {
  const next: WigssSettings = {
    provider: 'claude',
    claudeModel: patch.claudeModel || readSettings().claudeModel,
  };
  try {
    mkdirSync(join(homedir(), '.wigss'), { recursive: true });
    writeFileSync(FILE, JSON.stringify(next, null, 2));
  } catch (e) {
    console.error('[settings] write failed:', e);
  }
  return next;
}

/** UI 노출용 — Claude는 로컬 OAuth라 마스킹할 시크릿이 없다. */
export function publicSettings(): WigssSettings {
  return readSettings();
}
