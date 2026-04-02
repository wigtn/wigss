import { describe, it, expect } from 'vitest';
import {
  resolveBreakpoint,
  getBreakpointWidth,
  getMediaQuery,
  isBreakpointName,
  getBreakpointOrder,
  BREAKPOINTS,
} from '../lib/breakpoint-utils';

describe('breakpoint-utils', () => {
  describe('resolveBreakpoint', () => {
    it('should return null for widths below sm (< 640px)', () => {
      expect(resolveBreakpoint(375)).toBeNull();
      expect(resolveBreakpoint(639)).toBeNull();
      expect(resolveBreakpoint(0)).toBeNull();
    });

    it('should return sm for widths >= 640 and < 768', () => {
      expect(resolveBreakpoint(640)).toBe('sm');
      expect(resolveBreakpoint(700)).toBe('sm');
      expect(resolveBreakpoint(767)).toBe('sm');
    });

    it('should return md for widths >= 768 and < 1024', () => {
      expect(resolveBreakpoint(768)).toBe('md');
      expect(resolveBreakpoint(900)).toBe('md');
      expect(resolveBreakpoint(1023)).toBe('md');
    });

    it('should return lg for widths >= 1024 and < 1280', () => {
      expect(resolveBreakpoint(1024)).toBe('lg');
      expect(resolveBreakpoint(1200)).toBe('lg');
      expect(resolveBreakpoint(1279)).toBe('lg');
    });

    it('should return xl for widths >= 1280 and < 1536', () => {
      expect(resolveBreakpoint(1280)).toBe('xl');
      expect(resolveBreakpoint(1400)).toBe('xl');
      expect(resolveBreakpoint(1535)).toBe('xl');
    });

    it('should return 2xl for widths >= 1536', () => {
      expect(resolveBreakpoint(1536)).toBe('2xl');
      expect(resolveBreakpoint(1920)).toBe('2xl');
      expect(resolveBreakpoint(3840)).toBe('2xl');
    });

    it('should handle exact boundary values', () => {
      expect(resolveBreakpoint(640)).toBe('sm');
      expect(resolveBreakpoint(768)).toBe('md');
      expect(resolveBreakpoint(1024)).toBe('lg');
      expect(resolveBreakpoint(1280)).toBe('xl');
      expect(resolveBreakpoint(1536)).toBe('2xl');
    });
  });

  describe('getBreakpointWidth', () => {
    it('should return correct widths', () => {
      expect(getBreakpointWidth('sm')).toBe(640);
      expect(getBreakpointWidth('md')).toBe(768);
      expect(getBreakpointWidth('lg')).toBe(1024);
      expect(getBreakpointWidth('xl')).toBe(1280);
      expect(getBreakpointWidth('2xl')).toBe(1536);
    });
  });

  describe('getMediaQuery', () => {
    it('should return correct CSS media query strings', () => {
      expect(getMediaQuery('sm')).toBe('@media (min-width: 640px)');
      expect(getMediaQuery('md')).toBe('@media (min-width: 768px)');
      expect(getMediaQuery('lg')).toBe('@media (min-width: 1024px)');
      expect(getMediaQuery('xl')).toBe('@media (min-width: 1280px)');
      expect(getMediaQuery('2xl')).toBe('@media (min-width: 1536px)');
    });
  });

  describe('isBreakpointName', () => {
    it('should validate correct breakpoint names', () => {
      expect(isBreakpointName('sm')).toBe(true);
      expect(isBreakpointName('md')).toBe(true);
      expect(isBreakpointName('lg')).toBe(true);
      expect(isBreakpointName('xl')).toBe(true);
      expect(isBreakpointName('2xl')).toBe(true);
    });

    it('should reject invalid names', () => {
      expect(isBreakpointName('xs')).toBe(false);
      expect(isBreakpointName('3xl')).toBe(false);
      expect(isBreakpointName('mobile')).toBe(false);
      expect(isBreakpointName('')).toBe(false);
    });
  });

  describe('getBreakpointOrder', () => {
    it('should return ordered list', () => {
      const order = getBreakpointOrder();
      expect(order).toEqual(['sm', 'md', 'lg', 'xl', '2xl']);
    });

    it('should return a copy (not a reference)', () => {
      const a = getBreakpointOrder();
      const b = getBreakpointOrder();
      expect(a).not.toBe(b);
    });
  });

  describe('BREAKPOINTS constant', () => {
    it('should be in ascending order', () => {
      const values = Object.values(BREAKPOINTS);
      for (let i = 1; i < values.length; i++) {
        expect(values[i]).toBeGreaterThan(values[i - 1]);
      }
    });
  });
});
