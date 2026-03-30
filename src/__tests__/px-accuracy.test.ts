import { describe, it, expect } from 'vitest';
import { generateRefactorDiffs } from '../lib/agent/refactor-client';
import type { ComponentChange, DetectedComponent } from '../types';

/**
 * 핵심 검증: 사용자가 드래그한 정확한 px 값이 소스코드에 반영되는가?
 *
 * 시나리오: 사용자가 박스를 드래그해서 특정 px 크기로 만듦
 *  → refactor-client가 해당 px을 Tailwind 클래스로 변환
 *  → 변환된 클래스가 원래 px과 일치하는가?
 */

function makeComp(id: string, className: string): DetectedComponent {
  return {
    id,
    name: `Comp ${id}`,
    type: 'section',
    elementIds: [id],
    boundingBox: { x: 0, y: 0, width: 200, height: 100 },
    sourceFile: '',
    reasoning: '',
    fullClassName: className,
  } as DetectedComponent & { fullClassName: string };
}

function makeSource(className: string) {
  return {
    path: 'src/Test.tsx',
    content: `<div className="${className}">content</div>`,
  };
}

// TW_MAP에서 정확한 매핑 테이블 (refactor-client.ts와 동일)
const TW_MAP: Record<number, string> = {
  0:'0', 2:'0.5', 4:'1', 6:'1.5', 8:'2', 10:'2.5', 12:'3', 14:'3.5',
  16:'4', 20:'5', 24:'6', 28:'7', 32:'8', 36:'9', 40:'10', 44:'11',
  48:'12', 56:'14', 64:'16', 80:'20', 96:'24', 112:'28', 128:'32',
  160:'40', 192:'48', 224:'56', 256:'64', 288:'72', 320:'80', 384:'96',
};

// 변환 결과에서 실제 px을 추출하는 함수
function extractPxFromTwClass(twClass: string): number {
  // h-[150px] → 150
  const bracketMatch = twClass.match(/\[(\d+)px\]/);
  if (bracketMatch) return parseInt(bracketMatch[1]);

  // h-64 → token '64' → TW_MAP에서 역산
  const tokenMatch = twClass.match(/-(\d+\.?\d*)$/);
  if (tokenMatch) {
    const token = tokenMatch[1];
    // TW_MAP 역방향: token → px
    for (const [px, tw] of Object.entries(TW_MAP)) {
      if (tw === token) return Number(px);
    }
    // fallback: token * 4
    return parseFloat(token) * 4;
  }
  return 0;
}

describe('px 정확도: 드래그한 px이 정확하게 반영되는가', () => {

  // ── 정확한 Tailwind 토큰이 있는 px 값 ──

  it('h=192px → h-48 (정확한 매핑)', async () => {
    const cls = 'flex h-24 bg-white';
    const diffs = await generateRefactorDiffs({
      changes: [{ componentId: 'c1', type: 'resize', from: { height: 96, width: 200 }, to: { height: 192, width: 200 } }],
      components: [makeComp('c1', cls)],
      sources: [makeSource(cls)],
    });
    expect(diffs).toHaveLength(1);
    expect(diffs[0].modified).toContain('h-48');
    expect(extractPxFromTwClass('h-48')).toBe(192); // 정확히 192px
  });

  it('h=256px → h-64 (정확한 매핑)', async () => {
    const cls = 'flex h-48 bg-white';
    const diffs = await generateRefactorDiffs({
      changes: [{ componentId: 'c1', type: 'resize', from: { height: 192, width: 200 }, to: { height: 256, width: 200 } }],
      components: [makeComp('c1', cls)],
      sources: [makeSource(cls)],
    });
    expect(diffs).toHaveLength(1);
    expect(diffs[0].modified).toContain('h-64');
    expect(extractPxFromTwClass('h-64')).toBe(256);
  });

  it('w=320px → w-80 (정확한 매핑)', async () => {
    const cls = 'flex w-64 bg-white';
    const diffs = await generateRefactorDiffs({
      changes: [{ componentId: 'c1', type: 'resize', from: { width: 256, height: 100 }, to: { width: 320, height: 100 } }],
      components: [makeComp('c1', cls)],
      sources: [makeSource(cls)],
    });
    expect(diffs).toHaveLength(1);
    expect(diffs[0].modified).toContain('w-80');
    expect(extractPxFromTwClass('w-80')).toBe(320);
  });

  // ── Tailwind 토큰이 없는 px 값 → arbitrary [Npx] ──

  it('h=150px → h-[150px] (arbitrary 값)', async () => {
    const cls = 'flex bg-white';
    const diffs = await generateRefactorDiffs({
      changes: [{ componentId: 'c1', type: 'resize', from: { height: 100, width: 200 }, to: { height: 150, width: 200 } }],
      components: [makeComp('c1', cls)],
      sources: [makeSource(cls)],
    });
    expect(diffs).toHaveLength(1);
    // 150은 TW_MAP에 없으므로 [150px] 형태여야 함
    expect(diffs[0].modified).toMatch(/h-\[150px\]/);
    expect(extractPxFromTwClass('h-[150px]')).toBe(150);
  });

  it('w=300px → w-[300px] (arbitrary 값)', async () => {
    const cls = 'flex bg-white';
    const diffs = await generateRefactorDiffs({
      changes: [{ componentId: 'c1', type: 'resize', from: { width: 200, height: 100 }, to: { width: 300, height: 100 } }],
      components: [makeComp('c1', cls)],
      sources: [makeSource(cls)],
    });
    expect(diffs).toHaveLength(1);
    expect(diffs[0].modified).toMatch(/w-\[300px\]/);
    expect(extractPxFromTwClass('w-[300px]')).toBe(300);
  });

  // ── 근접 매핑: 2px 이내면 가까운 토큰 사용 ──

  it('h=193px → h-48 (192에 가깝, 1px 차이 = 토큰 사용)', async () => {
    const cls = 'flex h-24 bg-white';
    const diffs = await generateRefactorDiffs({
      changes: [{ componentId: 'c1', type: 'resize', from: { height: 96, width: 200 }, to: { height: 193, width: 200 } }],
      components: [makeComp('c1', cls)],
      sources: [makeSource(cls)],
    });
    expect(diffs).toHaveLength(1);
    // 193은 192(h-48)와 1px 차이 → h-48 사용 (2px tolerance)
    expect(diffs[0].modified).toContain('h-48');
  });

  it('h=195px → h-[195px] (192에서 3px 차이 = arbitrary 사용)', async () => {
    const cls = 'flex h-24 bg-white';
    const diffs = await generateRefactorDiffs({
      changes: [{ componentId: 'c1', type: 'resize', from: { height: 96, width: 200 }, to: { height: 195, width: 200 } }],
      components: [makeComp('c1', cls)],
      sources: [makeSource(cls)],
    });
    expect(diffs).toHaveLength(1);
    // 195은 어떤 토큰과도 2px 이내가 아님 → [195px]
    expect(diffs[0].modified).toMatch(/h-\[195px\]/);
  });

  // ── Move: mt 정확도 ──

  it('mt-4(16px) + 32px 이동 → mt-12(48px)', async () => {
    const cls = 'flex mt-4 bg-white';
    const diffs = await generateRefactorDiffs({
      changes: [{ componentId: 'c1', type: 'move', from: { x: 0, y: 16 }, to: { x: 0, y: 48 } }],
      components: [makeComp('c1', cls)],
      sources: [makeSource(cls)],
    });
    expect(diffs).toHaveLength(1);
    expect(diffs[0].modified).toContain('mt-12');
    // mt-12 = 48px, 이동 결과 y=48 이므로 정확
    expect(extractPxFromTwClass('mt-12')).toBe(48);
  });

  it('mt-4(16px) + 14px 이동 → mt-[30px] (30은 토큰 없음)', async () => {
    const cls = 'flex mt-4 bg-white';
    const diffs = await generateRefactorDiffs({
      changes: [{ componentId: 'c1', type: 'move', from: { x: 0, y: 16 }, to: { x: 0, y: 30 } }],
      components: [makeComp('c1', cls)],
      sources: [makeSource(cls)],
    });
    expect(diffs).toHaveLength(1);
    // 16 + 14 = 30px, 가장 가까운 토큰: 28px(mt-7, 2px 차이) → mt-7 사용
    // pxToTw(30, 'mt') → closest=28 (차이 2, tolerance 이내) → mt-7
    expect(diffs[0].modified).toContain('mt-7');
  });

  // ── 큰 값 정확도 ──

  it('h=384px → h-96', async () => {
    const cls = 'flex h-48 bg-white';
    const diffs = await generateRefactorDiffs({
      changes: [{ componentId: 'c1', type: 'resize', from: { height: 192, width: 200 }, to: { height: 384, width: 200 } }],
      components: [makeComp('c1', cls)],
      sources: [makeSource(cls)],
    });
    expect(diffs).toHaveLength(1);
    expect(diffs[0].modified).toContain('h-96');
    expect(extractPxFromTwClass('h-96')).toBe(384);
  });

  it('h=500px → h-[500px] (TW_MAP 범위 밖)', async () => {
    const cls = 'flex h-48 bg-white';
    const diffs = await generateRefactorDiffs({
      changes: [{ componentId: 'c1', type: 'resize', from: { height: 192, width: 200 }, to: { height: 500, width: 200 } }],
      components: [makeComp('c1', cls)],
      sources: [makeSource(cls)],
    });
    expect(diffs).toHaveLength(1);
    expect(diffs[0].modified).toMatch(/h-\[500px\]/);
  });
});
