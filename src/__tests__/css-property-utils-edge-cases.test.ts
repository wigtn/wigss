import { describe, it, expect } from 'vitest';
import { changeToCssProperties, changeToCssKebab } from '../lib/css-property-utils';
import type { ComponentChange } from '../types';

describe('changeToCssProperties: edge cases', () => {
  it('no change when delta ≤ 2px', () => {
    const change: ComponentChange = { componentId: 'c1', type: 'resize', from: { width: 200, height: 100 }, to: { width: 201, height: 102 } };
    expect(changeToCssProperties(change)).toEqual({});
  });

  it('negative move values', () => {
    const change: ComponentChange = { componentId: 'c1', type: 'move', from: { x: 50, y: 50 }, to: { x: 30, y: 20 } };
    const props = changeToCssProperties(change);
    expect(props.marginTop).toBe('-30px');
    expect(props.marginLeft).toBe('-20px');
  });

  it('large values (1000+px)', () => {
    const change: ComponentChange = { componentId: 'c1', type: 'resize', from: { width: 500, height: 500 }, to: { width: 1500, height: 1200 } };
    const props = changeToCssProperties(change);
    expect(props.height).toBe('1200px');
    expect(props.width).toBe('1500px');
  });

  it('changeToCssKebab uses kebab-case keys', () => {
    const change: ComponentChange = { componentId: 'c1', type: 'move', from: { x: 0, y: 0 }, to: { x: 50, y: 100 } };
    const props = changeToCssKebab(change);
    expect(props).toHaveProperty('margin-top');
    expect(props).toHaveProperty('margin-left');
    expect(props).not.toHaveProperty('marginTop');
  });

  it('resize with only height change', () => {
    const change: ComponentChange = { componentId: 'c1', type: 'resize', from: { width: 200, height: 100 }, to: { width: 200, height: 300 } };
    const props = changeToCssProperties(change);
    expect(props).toEqual({ height: '300px' });
    expect(props).not.toHaveProperty('width');
  });
});
