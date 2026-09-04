import { describe, it, expect } from 'vitest';
import { reorderSibling, isCharPermutation } from '../lib/agent/structure-editor';

const GRID = `export function Grid() {
  return (
    <div className="grid grid-cols-3 gap-4">
      <section id="a" className="p-2">
        <h3>Alpha</h3>
      </section>
      <section id="b" className="p-4">B</section>
      <section id="c" className="p-6">C</section>
    </div>
  );
}
`;

describe('reorderSibling (PROD-637)', () => {
  it('3번째 형제를 1번째로 옮기고 구분자(들여쓰기)를 보존한다', () => {
    // <section id="c"> — Babel 8:6 → 주소 8:7
    const r = reorderSibling(GRID, 'Grid.tsx', 8, 7, 0);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.fromIndex).toBe(2);
    expect(r.toIndex).toBe(0);

    const next =
      GRID.slice(0, r.diff.range!.start) + r.diff.modified + GRID.slice(r.diff.range!.end);
    const idxC = next.indexOf('id="c"');
    const idxA = next.indexOf('id="a"');
    const idxB = next.indexOf('id="b"');
    expect(idxC).toBeLessThan(idxA);
    expect(idxA).toBeLessThan(idxB);
    // 들여쓰기 보존: 각 줄 앞의 6칸 들여쓰기가 유지된다
    expect(next).toContain('\n      <section id="c"');
    expect(next).toContain('\n      <section id="a"');
    // 파일 전체 재구성이 여전히 유효한 구조(여닫는 태그 수 일치)
    expect((next.match(/<section/g) || []).length).toBe(3);
    expect((next.match(/<\/section>/g) || []).length).toBe(3);
  });

  it('순수 이동 불변식: original 과 modified 는 애너그램이다', () => {
    const r = reorderSibling(GRID, 'Grid.tsx', 8, 7, 0);
    expect(r.ok).toBe(true);
    if (r.ok) expect(isCharPermutation(r.diff.original, r.diff.modified)).toBe(true);
  });

  it('멀티라인 요소(자식 있는 section)도 통째로 이동한다', () => {
    // <section id="a"> (멀티라인) 를 맨 뒤로 — Babel 4:6 → 주소 4:7
    const r = reorderSibling(GRID, 'Grid.tsx', 4, 7, 2);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const next =
      GRID.slice(0, r.diff.range!.start) + r.diff.modified + GRID.slice(r.diff.range!.end);
    expect(next.indexOf('id="b"')).toBeLessThan(next.indexOf('id="a"'));
    expect(next).toContain('<h3>Alpha</h3>'); // 내부 자식 보존
  });

  it('toIndex 는 클램프된다', () => {
    const r = reorderSibling(GRID, 'Grid.tsx', 4, 7, 99);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.toIndex).toBe(2);
  });

  it('같은 자리면 사유와 함께 거절한다', () => {
    const r = reorderSibling(GRID, 'Grid.tsx', 4, 7, 0);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('이미');
  });

  it('.map() 안의 항목은 사유 있는 포기다', () => {
    const src = `export function List({ items }: { items: string[] }) {
  return (
    <ul className="list">
      {items.map((t) => (
        <li key={t} className="row">{t}</li>
      ))}
    </ul>
  );
}
`;
    // <li> — Babel 5:8 → 주소 5:9
    const r = reorderSibling(src, 'List.tsx', 5, 9, 0);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('.map()');
  });

  it('형제가 하나뿐이면 거절한다', () => {
    const src = `export const One = () => (
  <div className="wrap">
    <span className="only">x</span>
  </div>
);
`;
    const r = reorderSibling(src, 'One.tsx', 3, 5, 0);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('형제');
  });

  it('컴포넌트 최상위 요소는 부모 없음으로 거절한다 (컴포넌트 함수를 .map 으로 오검출하지 않음)', () => {
    const src = `export function Top() {
  return <div className="root">x</div>;
}
`;
    const r = reorderSibling(src, 'Top.tsx', 2, 10, 0);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('최상위');
  });

  it('Fragment 부모 안의 형제도 이동한다', () => {
    const src = `export const F = () => (
  <>
    <p id="p1">one</p>
    <p id="p2">two</p>
  </>
);
`;
    const r = reorderSibling(src, 'F.tsx', 4, 5, 0);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const next = src.slice(0, r.diff.range!.start) + r.diff.modified + src.slice(r.diff.range!.end);
    expect(next.indexOf('id="p2"')).toBeLessThan(next.indexOf('id="p1"'));
  });

  it('컴포넌트 요소(<Card />, className 없음)도 이동한다 — 구조 diff 는 className 가드를 요구하지 않는다', () => {
    const src = `import Card from './Card';
export function Row() {
  return (
    <div className="flex">
      <Card id={1} />
      <Card id={2} />
      <Card id={3} />
    </div>
  );
}
`;
    const r = reorderSibling(src, 'Row.tsx', 7, 7, 0); // 3번째 Card → 맨 앞
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const next = src.slice(0, r.diff.range!.start) + r.diff.modified + src.slice(r.diff.range!.end);
    expect(next.indexOf('id={3}')).toBeLessThan(next.indexOf('id={1}'));
  });
});
