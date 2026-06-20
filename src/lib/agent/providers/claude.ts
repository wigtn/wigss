/**
 * Claude provider — Claude Code 구독제(Claude Max OAuth)를 wigss 에이전트의 LLM provider로.
 *
 * Anthropic Messages API 네이티브. OpenAI 포맷/SDK/번역 계층 없음 (wigss는 Claude만 지원).
 * tools는 Anthropic tool-use 스키마({name, input_schema})를 그대로 받고,
 * 응답은 content 블록(text + tool_use)을 파싱한 슬림 형태로 반환한다.
 * 외부 프록시/데몬 불필요 — wigss 서버(Node)에서 직접 동작.
 *
 * 인증: 우선 ~/.claude/.credentials.json(Claude Code가 갱신) 의 OAuth accessToken,
 *       없으면 ANTHROPIC_API_KEY(x-api-key)로 폴백.
 */
import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

export type ClaudeMessage = { role: 'user' | 'assistant'; content: string };
export type ClaudeToolDef = { name: string; description?: string; input_schema: unknown };
export type ClaudeToolChoice = 'auto' | 'any' | 'none' | { name: string };

export type ClaudeRequest = {
  model: string;
  /** system prompt — Anthropic은 messages와 별도 필드로 받는다 */
  system?: string;
  messages: ClaudeMessage[];
  tools?: readonly ClaudeToolDef[];
  tool_choice?: ClaudeToolChoice;
  temperature?: number;
  max_tokens?: number;
};

export type ClaudeToolUse = { id: string; name: string; input: Record<string, unknown> };

/** content 블록을 파싱한 슬림 응답 — 호출부는 text/toolUses만 본다. */
export type ClaudeResponse = {
  text: string;
  toolUses: ClaudeToolUse[];
  stopReason: string;
  usage: { input_tokens: number; output_tokens: number };
};

function auth(): { headers: Record<string, string> } {
  // 1) Claude Code OAuth (구독제, 토큰당 $0)
  try {
    const cred = JSON.parse(readFileSync(join(homedir(), '.claude', '.credentials.json'), 'utf8'));
    const token = cred?.claudeAiOauth?.accessToken;
    if (token) {
      return { headers: { authorization: `Bearer ${token}`, 'anthropic-beta': 'oauth-2025-04-20' } };
    }
  } catch {
    /* fall through */
  }
  // 2) API key 폴백
  const key = process.env.ANTHROPIC_API_KEY;
  if (key) return { headers: { 'x-api-key': key } };
  throw new Error('Claude provider: no auth — ~/.claude/.credentials.json 또는 ANTHROPIC_API_KEY 필요');
}

/** wigss 요청 → Anthropic Messages 요청 바디 */
function buildBody(req: ClaudeRequest): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: req.model,
    max_tokens: Math.max(req.max_tokens ?? 2048, 1024),
    messages: req.messages.length ? req.messages : [{ role: 'user', content: '' }],
  };
  if (req.system) body.system = req.system;
  // 일부 최신 모델은 temperature 미지원
  if (!req.model.includes('opus-4-8') && typeof req.temperature === 'number') body.temperature = req.temperature;

  if (req.tools?.length) {
    body.tools = req.tools.map((t) => ({
      name: t.name,
      description: t.description ?? '',
      input_schema: t.input_schema ?? { type: 'object', properties: {} },
    }));
    const tc = req.tool_choice;
    if (tc === 'any') body.tool_choice = { type: 'any' };
    else if (typeof tc === 'object' && tc?.name) body.tool_choice = { type: 'tool', name: tc.name };
    else if (tc !== 'none') body.tool_choice = { type: 'auto' };
  }
  return body;
}

/** Anthropic 응답 → 슬림 응답(text + tool_use) */
function parse(ar: Record<string, unknown>): ClaudeResponse {
  const content = (ar.content as Array<Record<string, unknown>>) || [];
  const text = content
    .filter((b) => b.type === 'text')
    .map((b) => b.text as string)
    .join('');
  const toolUses: ClaudeToolUse[] = content
    .filter((b) => b.type === 'tool_use')
    .map((b, i) => ({
      id: (b.id as string) || `tool_${i}`,
      name: b.name as string,
      input: (b.input as Record<string, unknown>) ?? {},
    }));
  const usage = (ar.usage as Record<string, number>) || {};
  return {
    text,
    toolUses,
    stopReason: (ar.stop_reason as string) || 'end_turn',
    usage: { input_tokens: usage.input_tokens || 0, output_tokens: usage.output_tokens || 0 },
  };
}

/** Claude(Anthropic Messages API) 호출. 429/5xx 지수 백오프 재시도 내장. */
export async function callClaude(req: ClaudeRequest): Promise<ClaudeResponse> {
  const body = JSON.stringify(buildBody(req));
  const { headers } = auth();
  let lastErr: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await fetch(ANTHROPIC_URL, {
        method: 'POST',
        headers: { 'anthropic-version': '2023-06-01', 'content-type': 'application/json', ...headers },
        body,
      });
      if (!res.ok) {
        if ([429, 500, 503, 529].includes(res.status) && attempt < 4) {
          await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
          continue;
        }
        throw new Error(`Claude API ${res.status}: ${(await res.text()).slice(0, 300)}`);
      }
      return parse(await res.json());
    } catch (err) {
      lastErr = err;
      if (attempt < 4) {
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        continue;
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Claude provider failed');
}
