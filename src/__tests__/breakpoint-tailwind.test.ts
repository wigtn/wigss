import { describe, it, expect } from 'vitest';
import {
  bpFromWidth,
  snapToScalePx,
  opsFromTargetStyles,
  editClassTokens,
} from '../lib/agent/rewriters/breakpoint-tailwind';

describe('bpFromWidth', () => {
  it('maps widths to breakpoints, defaulting to lg-range 1280', () => {
    expect(bpFromWidth(375)).toBe('base');
    expect(bpFromWidth(640)).toBe('sm');
    expect(bpFromWidth(767)).toBe('sm');
    expect(bpFromWidth(768)).toBe('md');
    expect(bpFromWidth(1024)).toBe('lg');
    expect(bpFromWidth(1280)).toBe('xl');
    expect(bpFromWidth(1600)).toBe('2xl');
    expect(bpFromWidth(undefined)).toBe('xl'); // 미전달 → 1280 가정 (PRD)
  });
});

describe('snapToScalePx', () => {
  it('snaps to the nearest scale step, keeping sign', () => {
    expect(snapToScalePx(12)).toBe(12);
    expect(snapToScalePx(13)).toBe(12);
    expect(snapToScalePx(15)).toBe(14);
    expect(snapToScalePx(-13)).toBe(-12);
    expect(snapToScalePx(1)).toBe(0);
  });
});

describe('opsFromTargetStyles', () => {
  it('maps geometry props and reports the rest as unsupported', () => {
    const { ops, unsupported } = opsFromTargetStyles({
      height: '256px',
      marginTop: '12px',
      color: 'red',
    });
    expect(ops).toEqual([
      { prefix: 'h', px: 256, mode: 'absolute' },
      { prefix: 'mt', px: 12, mode: 'snap' },
    ]);
    expect(unsupported).toEqual(['color']);
  });
});

describe('editClassTokens — 지배 토큰 규칙 (D3)', () => {
  const RESPONSIVE = 'flex flex-col h-32 md:h-48 lg:h-64 w-full rounded-lg p-4';

  it('S6: lg 뷰포트의 편집은 lg 토큰을 교체하고 base/md 를 건드리지 않는다', () => {
    const r = editClassTokens(RESPONSIVE, [{ prefix: 'h', px: 320, mode: 'absolute' }], 1024);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.className).toBe('flex flex-col h-32 md:h-48 lg:h-80 w-full rounded-lg p-4');
  });

  it('모바일(375) 뷰포트의 편집은 base 토큰을 교체한다', () => {
    const r = editClassTokens(RESPONSIVE, [{ prefix: 'h', px: 192, mode: 'absolute' }], 375);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.className).toBe('flex flex-col h-48 md:h-48 lg:h-64 w-full rounded-lg p-4');
  });

  it('md 뷰포트의 편집은 md 토큰을 교체한다 (지배 = 가장 큰 bp ≤ 활성)', () => {
    const r = editClassTokens(RESPONSIVE, [{ prefix: 'h', px: 224, mode: 'absolute' }], 800);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.className).toContain('md:h-56');
    if (r.ok) expect(r.className).toContain('h-32'); // base 불변
    if (r.ok) expect(r.className).toContain('lg:h-64'); // lg 불변
  });

  it('데스크톱에서 base 토큰만 있으면 base 를 교체한다 — 새 bp 를 발명하지 않는다', () => {
    const r = editClassTokens('flex h-48 w-64', [{ prefix: 'h', px: 256, mode: 'absolute' }], 1280);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.className).toBe('flex h-64 w-64');
  });

  it('토큰이 전혀 없으면 base 로 추가한다', () => {
    const r = editClassTokens('flex p-4', [{ prefix: 'h', px: 256, mode: 'absolute' }], 1280);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.className).toBe('flex p-4 h-64');
  });

  it('375 뷰포트에서 lg 토큰만 있으면 지배 토큰이 없으므로 base 로 추가한다', () => {
    const r = editClassTokens('flex lg:h-64', [{ prefix: 'h', px: 192, mode: 'absolute' }], 375);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.className).toBe('flex lg:h-64 h-48');
  });

  it('hover: 등 상태 변형 토큰은 지배 판정에서 제외되고 보존된다', () => {
    const r = editClassTokens('h-48 hover:h-56', [{ prefix: 'h', px: 256, mode: 'absolute' }], 1280);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.className).toBe('h-64 hover:h-56');
  });
});

describe('editClassTokens — 스냅과 컨벤션 (D7 · 린터)', () => {
  it('S8: 12px 이동은 임의값이 아니라 mt-3 프리셋으로 추가된다', () => {
    const r = editClassTokens('block rounded px-3 py-2', [{ prefix: 'mt', px: 12, mode: 'snap' }], 1280);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.className).toBe('block rounded px-3 py-2 mt-3');
      expect(r.className).not.toContain('[');
    }
  });

  it('스케일 밖 델타(13px)도 가장 가까운 프리셋으로 스냅된다', () => {
    const r = editClassTokens('block', [{ prefix: 'mt', px: 13, mode: 'snap' }], 1280);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.className).toBe('block mt-3');
  });

  it('기존 마진에 델타를 더한 뒤 스냅한다 (mt-4 + 12px → mt-7)', () => {
    const r = editClassTokens('mt-4 flex', [{ prefix: 'mt', px: 12, mode: 'snap' }], 1280);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.className).toBe('mt-7 flex');
  });

  it('음수 델타는 음수 마진 토큰이 된다', () => {
    const r = editClassTokens('flex', [{ prefix: 'mt', px: -12, mode: 'snap' }], 1280);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.className).toBe('flex -mt-3');
  });

  it('크기는 ±2px 프리셋, 그 밖에는 임의값을 허용한다 (D7)', () => {
    const near = editClassTokens('h-48', [{ prefix: 'h', px: 254, mode: 'absolute' }], 1280);
    if (near.ok) expect(near.className).toBe('h-64');
    const far = editClassTokens('h-48', [{ prefix: 'h', px: 250, mode: 'absolute' }], 1280);
    if (far.ok) expect(far.className).toBe('h-[250px]');
  });

  it('같은 bp 의 충돌 토큰을 정리한다', () => {
    const r = editClassTokens('h-48 h-[190px] flex', [{ prefix: 'h', px: 256, mode: 'absolute' }], 1280);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.className).toBe('h-64 flex');
  });

  it('변경이 없으면 사유와 함께 거절한다', () => {
    const same = editClassTokens('h-64', [{ prefix: 'h', px: 256, mode: 'absolute' }], 1280);
    expect(same.ok).toBe(false);
    const empty = editClassTokens('h-64', [], 1280);
    expect(empty.ok).toBe(false);
  });
});
