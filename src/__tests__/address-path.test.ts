/**
 * P2·P3 통합: 주소 우선 경로가 refactor-client 에서 range 를 실은 diff 를 만들고,
 * 실패는 사유 있는 포기(skipped)로 떨어지는지. 하네스 실험 1·2 의 실패 모드를
 * 유닛으로 옮긴 것이다.
 */
import { describe, it, expect } from 'vitest';
import type { ComponentChange, DetectedComponent } from '@/types';
import { generateRefactorResult } from '../lib/agent/refactor-client';

const DUP_FILE = `export function CardPair() {
  return (
    <div className="flex gap-4">
      <div className="flex h-48 w-64 p-4">
        <h3 className="text-lg">First</h3>
      </div>
      <div className="flex h-48 w-64 p-4">
        <h3 className="text-lg">Second</h3>
      </div>
    </div>
  );
}
`;

function resize(componentId: string, toHeight: number): ComponentChange {
  return {
    componentId,
    type: 'resize',
    from: { x: 0, y: 0, width: 256, height: 192 },
    to: { x: 0, y: 0, width: 256, height: toHeight },
  };
}

function comp(id: string, address: string | undefined, className: string): DetectedComponent {
  return {
    id,
    name: id,
    type: 'card',
    elementIds: [id],
    boundingBox: { x: 0, y: 0, width: 256, height: 192 },
    sourceFile: '',
    sourceAddress: address,
    reasoning: 'test',
    fullClassName: className,
  };
}

describe('주소 우선 경로 (PROD-632)', () => {
  it('파일 내 동일 형제 둘 중 두 번째를 정확히 편집하고 range 를 싣는다', async () => {
    // 두 번째 카드: Babel 7:6 → SWC 주소 7:7
    const { diffs, skipped } = await generateRefactorResult({
      changes: [resize('c2', 256)],
      components: [comp('c2', 'Cards.tsx:7:7', 'flex h-48 w-64 p-4')],
      sources: [{ path: 'Cards.tsx', content: DUP_FILE }],
      viewportWidth: 1280,
      tailwindProject: true,
    });
    expect(skipped).toEqual([]);
    expect(diffs).toHaveLength(1);
    const d = diffs[0];
    expect(d.range).toBeDefined();
    expect(d.modified).toContain('h-64');
    // range 가 두 번째 카드를 가리킨다 — 첫 번째 일치 위치보다 뒤
    const firstIdx = DUP_FILE.indexOf('className="flex h-48 w-64 p-4"');
    expect(d.range!.start).toBeGreaterThan(firstIdx);
    // 드리프트 검사 계약: range 의 현재 내용 === original
    expect(DUP_FILE.slice(d.range!.start, d.range!.end)).toBe(d.original);
  });

  it('파일 간 중복이 있어도 주소의 파일만 읽고 정확히 편집한다 (실험 2 의 1/N 소멸)', async () => {
    const clone = DUP_FILE.replace('CardPair', 'CardPairB');
    const { diffs, skipped } = await generateRefactorResult({
      changes: [resize('c1', 256)],
      components: [comp('c1', 'B.tsx:4:7', 'flex h-48 w-64 p-4')],
      sources: [
        { path: 'A.tsx', content: DUP_FILE }, // 같은 className 을 가진 다른 파일
        { path: 'B.tsx', content: clone },
      ],
      viewportWidth: 1280,
      tailwindProject: true,
    });
    expect(skipped).toEqual([]);
    expect(diffs[0].file).toBe('B.tsx');
  });

  it('반응형 편집이 viewportWidth 의 지배 토큰에 떨어진다 (실험 1 / S6)', async () => {
    const src = `export function R() {
  return (
    <div className="flex h-32 md:h-48 lg:h-64 w-full p-4">
      <h3>Responsive</h3>
    </div>
  );
}
`;
    const { diffs } = await generateRefactorResult({
      changes: [resize('r', 320)],
      components: [comp('r', 'R.tsx:3:5', 'flex h-32 md:h-48 lg:h-64 w-full p-4')],
      sources: [{ path: 'R.tsx', content: src }],
      viewportWidth: 1024,
      tailwindProject: true,
    });
    expect(diffs).toHaveLength(1);
    expect(diffs[0].modified).toContain('lg:h-80');
    expect(diffs[0].modified).toContain('h-32'); // base 불변
  });

  it('cn() 호출의 첫 문자열 인자를 편집한다', async () => {
    const src =
      "const cn=(...a:unknown[])=>a.join(' ');\n" +
      'export function C({on}:{on:boolean}) {\n' +
      "  return <div className={cn('flex h-48 w-64 p-4', on && 'ring-2')}>x</div>;\n" +
      '}\n';
    const { diffs, skipped } = await generateRefactorResult({
      changes: [resize('c', 256)],
      components: [comp('c', 'C.tsx:3:10', 'flex h-48 w-64 p-4 ring-2')],
      sources: [{ path: 'C.tsx', content: src }],
      viewportWidth: 1280,
      tailwindProject: true,
    });
    expect(skipped).toEqual([]);
    expect(diffs[0].modified).toContain("'flex h-64 w-64 p-4'");
    expect(diffs[0].modified).toContain('ring-2'); // 조건부 인자 보존
  });

  it('Tailwind 프로젝트에서 해석 실패는 인라인 폴백이 아니라 사유 있는 포기다 (D4·D5)', async () => {
    const src = 'export const C = ({c}:{c:string}) => <div className={c}>x</div>;\n';
    const { diffs, skipped } = await generateRefactorResult({
      changes: [resize('x', 256)],
      components: [comp('x', 'X.tsx:1:38', '')],
      sources: [
        { path: 'X.tsx', content: src },
        { path: 'tailwind.config.js', content: 'module.exports = {};' },
      ],
      viewportWidth: 1280,
      tailwindProject: true,
    });
    expect(diffs).toHaveLength(0);
    expect(skipped).toHaveLength(1);
    expect(skipped[0].reason).toContain('수정 불가');
    // 인라인 스타일이 새로 생기지 않았다는 것이 핵심
  });

  it('비-Tailwind 프로젝트에서는 기존 경로로 저하 동작한다 (D6)', async () => {
    const src = 'export const C = () => <div className="card-a" style={{ height: \'10px\' }}>x</div>;\n';
    const { diffs } = await generateRefactorResult({
      changes: [resize('y', 256)],
      // 주소는 있지만 문자열이 아닌 케이스를 만들기 위해 없는 좌표를 준다 → 해석 실패 → 저하
      components: [comp('y', 'Y.tsx:9:9', 'card-a')],
      sources: [{ path: 'Y.tsx', content: src }],
      viewportWidth: 1280,
      tailwindProject: false,
    });
    // 저하 경로(인라인 리라이터)가 처리한다
    expect(diffs).toHaveLength(1);
    expect(diffs[0].strategy).toBe('inline-style');
  });

  it('주소가 없으면 기존 경로 그대로다', async () => {
    const src = '<div className="flex h-48 w-64 p-4">x</div>;\n';
    const { diffs } = await generateRefactorResult({
      changes: [resize('z', 256)],
      components: [comp('z', undefined, 'flex h-48 w-64 p-4')],
      sources: [{ path: 'Z.tsx', content: src }],
    });
    expect(diffs).toHaveLength(1);
    expect(diffs[0].range).toBeUndefined(); // 레거시 경로는 range 를 만들지 않는다
  });
});
