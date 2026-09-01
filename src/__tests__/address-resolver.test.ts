import { describe, it, expect } from 'vitest';
import {
  parseAddress,
  resolveAddressInSource,
  isResolveFailure,
} from '../lib/agent/address-resolver';

const SRC = `export function CardPair() {
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

describe('parseAddress', () => {
  it('splits file:line:col from the right, keeping colons in the path', () => {
    expect(parseAddress('src/a.tsx:14:6')).toEqual({ file: 'src/a.tsx', line: 14, column: 6 });
    expect(parseAddress('/abs/path/b.tsx:3:1')).toEqual({ file: '/abs/path/b.tsx', line: 3, column: 1 });
    expect(parseAddress('C:/win/c.tsx:7:2')).toEqual({ file: 'C:/win/c.tsx', line: 7, column: 2 });
  });

  it('rejects malformed addresses', () => {
    expect(parseAddress('no-coords')).toBeNull();
    expect(parseAddress('a.tsx:xx:1')).toBeNull();
    expect(parseAddress('a.tsx:0:1')).toBeNull();
  });
});

describe('resolveAddressInSource', () => {
  it('resolves a 1-based (SWC) column — Babel column + 1', () => {
    // 두 번째 카드 <div> 는 Babel 좌표 7:6 → SWC 주소는 7:7
    const r = resolveAddressInSource(SRC, 7, 7);
    expect(isResolveFailure(r)).toBe(false);
    if (!isResolveFailure(r)) {
      expect(r.kind).toBe('string');
      expect(r.staticClass).toBe('flex h-48 w-64 p-4');
      // 파일 내 동일 className 이 둘이어도 주소는 두 번째를 정확히 가리킨다
      const firstIdx = SRC.indexOf('className="flex h-48 w-64 p-4"');
      expect(r.attrStart).toBeGreaterThan(firstIdx);
    }
  });

  it('falls back to a 0-based (Babel) column', () => {
    const r = resolveAddressInSource(SRC, 7, 6);
    expect(isResolveFailure(r)).toBe(false);
  });

  it('reports a rescan-worthy error when nothing sits at the address', () => {
    const r = resolveAddressInSource(SRC, 99, 1);
    expect(isResolveFailure(r)).toBe(true);
    if (isResolveFailure(r)) expect(r.error).toContain('재스캔');
  });

  it('resolves the static part of a template literal', () => {
    const src = 'const C = ({v}:{v:string}) => (\n  <div className={`flex h-48 ${v}`}>x</div>\n);\n';
    const r = resolveAddressInSource(src, 2, 3);
    expect(isResolveFailure(r)).toBe(false);
    if (!isResolveFailure(r)) {
      expect(r.kind).toBe('template');
      expect(r.staticClass).toBe('flex h-48 ');
    }
  });

  it('resolves the first string argument of a cn() call', () => {
    const src =
      "const cn=(...a:unknown[])=>a.join(' ');\n" +
      "const C=({on}:{on:boolean})=>(\n" +
      "  <div className={cn('flex h-48', on && 'ring-2')}>x</div>\n" +
      ');\n';
    const r = resolveAddressInSource(src, 3, 3);
    expect(isResolveFailure(r)).toBe(false);
    if (!isResolveFailure(r)) {
      expect(r.kind).toBe('call');
      expect(r.staticClass).toBe('flex h-48');
      expect(src.slice(r.valueRange.start, r.valueRange.end)).toBe('flex h-48');
    }
  });

  it('abandons with a reason on a className-less element (D8)', () => {
    const src = '<main>\n  <div id="x">no class</div>\n</main>;\n';
    const r = resolveAddressInSource(src, 2, 3);
    expect(isResolveFailure(r)).toBe(true);
    if (isResolveFailure(r)) expect(r.error).toContain('className');
  });

  it('abandons with a reason on a non-editable expression', () => {
    const src = 'const C=({c}:{c:string})=>(\n  <div className={c}>x</div>\n);\n';
    const r = resolveAddressInSource(src, 2, 3);
    expect(isResolveFailure(r)).toBe(true);
  });
});
