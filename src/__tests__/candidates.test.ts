import { describe, it, expect } from 'vitest';
import {
  buildCandidates,
  editGridCols,
  editToAbsolute,
  parseGapPx,
} from '../lib/agent/candidates';
import type { ComponentChange, DetectedComponent } from '../types';

const GRID_SRC = `export function Grid() {
  return (
    <section className="grid grid-cols-3 gap-x-1 gap-y-8 p-4">
      <article className="rounded-lg p-4 mt-2">A</article>
      <article className="rounded-lg p-4 mt-2">B</article>
    </section>
  );
}
`;

const FLEX_SRC = `export function Row() {
  return (
    <div className="relative flex gap-8 p-2">
      <span data-component="chip" className="h-10 w-24 ml-2">chip</span>
    </div>
  );
}
`;

function comp(over: Partial<DetectedComponent>): DetectedComponent {
  return {
    id: 'c1',
    name: 'Card',
    type: 'card',
    elementIds: ['el-1'],
    boundingBox: { x: 0, y: 0, width: 300, height: 200 },
    sourceFile: 'Grid.tsx',
    reasoning: 'test',
    ...over,
  };
}

describe('editGridCols — 지배 grid-cols 교체', () => {
  it('base 토큰을 교체한다', () => {
    const r = editGridCols('grid grid-cols-3 gap-x-1', 2);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.className).toBe('grid grid-cols-2 gap-x-1');
  });

  it('활성 뷰포트가 보는 bp 토큰을 고른다 (lg)', () => {
    const r = editGridCols('grid grid-cols-1 lg:grid-cols-3', 2, 1024);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.className).toBe('grid grid-cols-1 lg:grid-cols-2');
  });

  it('토큰이 없으면 사유 있는 포기', () => {
    const r = editGridCols('flex gap-4', 2);
    expect(r.ok).toBe(false);
  });

  it('같은 열 수면 거절한다', () => {
    expect(editGridCols('grid grid-cols-3', 3).ok).toBe(false);
  });
});

describe('parseGapPx', () => {
  it('행/열 축을 구분한다', () => {
    expect(parseGapPx('32px 4px', 'row')).toBe(32);
    expect(parseGapPx('32px 4px', 'column')).toBe(4);
    expect(parseGapPx('16px', 'column')).toBe(16);
    expect(parseGapPx('normal', 'column')).toBeNull();
  });
});

describe('editToAbsolute — 최후 수단 편집', () => {
  it('position/offset 토큰을 걷고 absolute 좌표를 단다', () => {
    const r = editToAbsolute('relative flex left-2 top-[3px] p-4', 120, 48);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.className).toBe('flex p-4 absolute left-[120px] top-[48px]');
  });
});

describe('buildCandidates (PROD-642/643)', () => {
  const sources = [
    { path: 'Grid.tsx', content: GRID_SRC },
    { path: 'Row.tsx', content: FLEX_SRC },
  ];

  it('그리드 자식 리사이즈 → own + parent-cols', async () => {
    const change: ComponentChange = {
      componentId: 'c1',
      type: 'resize',
      from: { x: 10, y: 10, width: 300, height: 200 },
      to: { x: 10, y: 10, width: 460, height: 200 },
    };
    const out = await buildCandidates({
      change,
      component: comp({ sourceAddress: 'Grid.tsx:4:7' }),
      parent: {
        address: 'Grid.tsx:3:5',
        boundingBox: { x: 0, y: 0, width: 920, height: 400 },
        display: 'grid',
        position: 'static',
        gap: '32px 4px',
      },
      sources,
      viewportWidth: 1024,
    });
    const ids = out.candidates.map((c) => c.id);
    expect(ids).toContain('own');
    expect(ids).toContain('parent-cols');
    const cols = out.candidates.find((c) => c.id === 'parent-cols')!;
    // 920 / 460 = 2 열
    expect(cols.diffs[0].modified).toContain('grid-cols-2');
    expect(cols.diffs[0].modified).not.toContain('grid-cols-3');
    expect(cols.warning).toBeTruthy();
  });

  it('flex 자식 이동 → own(마진) + parent-gap, static 부모라 absolute 는 사유와 함께 제외', async () => {
    const change: ComponentChange = {
      componentId: 'c1',
      type: 'move',
      from: { x: 40, y: 10, width: 96, height: 40 },
      to: { x: 56, y: 10, width: 96, height: 40 },
    };
    const out = await buildCandidates({
      change,
      component: comp({ sourceAddress: 'Row.tsx:4:7', sourceFile: 'Row.tsx' }),
      parent: {
        address: 'Row.tsx:3:5',
        boundingBox: { x: 0, y: 0, width: 600, height: 60 },
        display: 'flex',
        position: 'static',
        gap: '32px',
        flexDirection: 'row',
      },
      sources,
      viewportWidth: 1024,
    });
    const ids = out.candidates.map((c) => c.id);
    expect(ids).toContain('own');
    expect(ids).toContain('parent-gap');
    // gap-8(32px) + 16px = 48px → gap-12
    const gap = out.candidates.find((c) => c.id === 'parent-gap')!;
    expect(gap.diffs[0].modified).toContain('gap-12');
    expect(ids).not.toContain('absolute');
    expect(out.skipped.some((r) => r.includes('absolute'))).toBe(true);
  });

  it('positioned 부모면 absolute 후보가 경고와 함께 나온다', async () => {
    const change: ComponentChange = {
      componentId: 'c1',
      type: 'move',
      from: { x: 40, y: 10, width: 96, height: 40 },
      to: { x: 160, y: 58, width: 96, height: 40 },
    };
    const out = await buildCandidates({
      change,
      component: comp({ sourceAddress: 'Row.tsx:4:7', sourceFile: 'Row.tsx' }),
      parent: {
        address: 'Row.tsx:3:5',
        boundingBox: { x: 8, y: 6, width: 600, height: 60 },
        display: 'flex',
        position: 'relative',
        gap: '32px',
        flexDirection: 'row',
      },
      sources,
      viewportWidth: 1024,
    });
    const abs = out.candidates.find((c) => c.id === 'absolute');
    expect(abs).toBeTruthy();
    expect(abs!.diffs[0].modified).toContain('absolute left-[152px] top-[52px]');
    expect(abs!.warning).toContain('last resort');
    // 검증 기대치는 이동 델타로 실린다 — 화면이 최종 판정한다
    expect(abs!.expectations[0].expectedStyles.marginLeft).toBe('120px');
    expect(abs!.expectations[0].expectedStyles.marginTop).toBe('48px');
  });

  it('부모 정보가 없으면 own 만 나온다', async () => {
    const change: ComponentChange = {
      componentId: 'c1',
      type: 'move',
      from: { x: 0, y: 0, width: 96, height: 40 },
      to: { x: 24, y: 0, width: 96, height: 40 },
    };
    const out = await buildCandidates({
      change,
      component: comp({ sourceAddress: 'Row.tsx:4:7', sourceFile: 'Row.tsx' }),
      sources,
      viewportWidth: 1024,
    });
    expect(out.candidates.map((c) => c.id)).toEqual(['own']);
  });
});
