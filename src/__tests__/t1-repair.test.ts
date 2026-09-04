import { describe, it, expect } from 'vitest';
import { repairWithModel, validateClassFragment } from '../lib/agent/t1-repair';
import type { ClaudeResponse } from '../lib/agent/providers/claude';

const SRC = `export function Card() {
  return (
    <div className="flex h-48 w-64 rounded-lg p-4">
      <h3 className="text-lg">Title</h3>
    </div>
  );
}
`;

function fakeCall(text: string) {
  return async (): Promise<ClaudeResponse> => ({
    text,
    toolUses: [],
    stopReason: 'end_turn',
    usage: { input_tokens: 0, output_tokens: 0 },
  });
}

describe('validateClassFragment — 모델 출력 울타리', () => {
  it('정상 클래스 목록은 통과한다', () => {
    const r = validateClassFragment('flex h-64 w-64 rounded-lg p-4 lg:h-80 -mt-2 h-[250px]');
    expect(r.ok).toBe(true);
  });

  it('여러 줄·따옴표·태그·style= 은 폐기한다', () => {
    expect(validateClassFragment('h-64\nw-64').ok).toBe(false);
    expect(validateClassFragment('h-64 "quoted"').ok).toBe(false);
    expect(validateClassFragment('<div class=x>').ok).toBe(false);
    expect(validateClassFragment('style=height:10px').ok).toBe(false);
    expect(validateClassFragment('h-64; alert(1)').ok).toBe(false);
    expect(validateClassFragment('').ok).toBe(false);
  });
});

describe('T2 지시 모드 (PROD-643)', () => {
  const base = {
    file: 'Card.tsx',
    content: SRC,
    line: 3,
    column: 5,
    targetStyles: {},
    viewportWidth: 1280,
  };

  it('targetStyles 없이 instruction 만으로 수선한다 — 프롬프트에 지시가 실린다', async () => {
    let captured = '';
    const spy = async (req: { messages: { content: string }[] }): Promise<ClaudeResponse> => {
      captured = req.messages[0].content;
      return { text: 'flex h-64 w-64 rounded-2xl p-4', toolUses: [], stopReason: 'end_turn', usage: { input_tokens: 0, output_tokens: 0 } };
    };
    const r = await repairWithModel(
      { ...base, instruction: '더 크게, 모서리 둥글게' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      spy as any,
    );
    expect(r.ok).toBe(true);
    expect(captured).toContain('사용자 지시(T2)');
    expect(captured).toContain('더 크게, 모서리 둥글게');
  });

  it('목표도 지시도 없으면 T1 불가', async () => {
    const r = await repairWithModel(base, fakeCall('h-64'));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('T1 불가');
  });
});

describe('repairWithModel (PROD-638)', () => {
  const base = {
    file: 'Card.tsx',
    content: SRC,
    line: 3,
    column: 5, // <div> Babel 3:4 → 주소 3:5
    targetStyles: { height: '256px' },
    viewportWidth: 1280,
  };

  it('모델의 조각으로 range 를 실은 diff 를 만든다', async () => {
    const r = await repairWithModel(base, fakeCall('flex h-64 w-64 rounded-lg p-4'));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.diff.range).toBeDefined();
    expect(r.diff.modified).toContain('h-64');
    expect(SRC.slice(r.diff.range!.start, r.diff.range!.end)).toBe(r.diff.original);
    // 범위 강제: 다른 요소(h3)는 물리적으로 못 건드린다
    const next = SRC.slice(0, r.diff.range!.start) + r.diff.modified + SRC.slice(r.diff.range!.end);
    expect(next).toContain('className="text-lg"');
  });

  it('울타리: 모델이 코드를 섞어 보내면 폐기한다', async () => {
    const r = await repairWithModel(base, fakeCall('h-64"; import x from "y'));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('폐기');
  });

  it('변경 없는 응답은 거절한다', async () => {
    const r = await repairWithModel(base, fakeCall('flex h-48 w-64 rounded-lg p-4'));
    expect(r.ok).toBe(false);
  });

  it('주소 해석이 안 되면 T1 자체가 불가하다', async () => {
    const r = await repairWithModel({ ...base, line: 99 }, fakeCall('h-64'));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('T1 불가');
  });

  it('인증 오류는 NO_AUTH 로 표면화된다 (정중한 스킵)', async () => {
    const throwing = async (): Promise<ClaudeResponse> => {
      throw new Error('Claude provider: no auth — 인증 필요');
    };
    const r = await repairWithModel(base, throwing);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('NO_AUTH');
  });

  it('검증 불일치를 프롬프트에 실어 재수선 모드로 부른다', async () => {
    let captured = '';
    const spy = async (req: { messages: { content: string }[] }): Promise<ClaudeResponse> => {
      captured = req.messages[0].content;
      return { text: 'flex h-64 w-64 rounded-lg p-4', toolUses: [], stopReason: 'end_turn', usage: { input_tokens: 0, output_tokens: 0 } };
    };
    const r = await repairWithModel(
      { ...base, mismatches: [{ property: 'height', expected: '256px', actual: '192px' }] },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      spy as any,
    );
    expect(r.ok).toBe(true);
    expect(captured).toContain('검증 불일치');
    expect(captured).toContain('256px');
  });
});
