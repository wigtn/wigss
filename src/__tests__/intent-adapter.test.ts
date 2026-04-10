import { describe, it, expect } from 'vitest';
import {
  changeToIntent,
  changesToIntents,
  toKebabCase,
  targetStylesToKebab,
} from '../lib/agent/intent-adapter';
import type { ComponentChange, DetectedComponent } from '../types';

function mkComponent(partial: Partial<DetectedComponent> = {}): DetectedComponent {
  return {
    id: 'c1',
    name: 'card',
    type: 'card',
    elementIds: ['el-1'],
    boundingBox: { x: 0, y: 0, width: 200, height: 100 },
    sourceFile: 'src/app/page.tsx',
    reasoning: 'test',
    fullClassName: 'flex h-24 w-50',
    ...partial,
  };
}

describe('changeToIntent', () => {
  it('produces targetStyles from a resize change', () => {
    const change: ComponentChange = {
      componentId: 'c1',
      type: 'resize',
      from: { width: 200, height: 100 },
      to: { width: 200, height: 256 },
    };
    const intent = changeToIntent(change, mkComponent());
    expect(intent.componentId).toBe('c1');
    expect(intent.targetStyles.height).toBe('256px');
    expect(intent.targetStyles.width).toBeUndefined();
  });

  it('produces targetStyles from a move change', () => {
    const change: ComponentChange = {
      componentId: 'c1',
      type: 'move',
      from: { x: 0, y: 0 },
      to: { x: 25, y: 40 },
    };
    const intent = changeToIntent(change, mkComponent());
    expect(intent.targetStyles.marginLeft).toBe('25px');
    expect(intent.targetStyles.marginTop).toBe('40px');
  });

  it('populates sourceHint from component metadata', () => {
    const change: ComponentChange = {
      componentId: 'c1',
      type: 'resize',
      from: { width: 200, height: 100 },
      to: { width: 300, height: 100 },
    };
    const intent = changeToIntent(change, mkComponent({ fullClassName: 'flex h-24' }));
    expect(intent.sourceHint?.file).toBe('src/app/page.tsx');
    expect(intent.sourceHint?.className).toBe('flex h-24');
  });

  it('omits sourceHint when component is undefined', () => {
    const change: ComponentChange = {
      componentId: 'c1',
      type: 'resize',
      from: { width: 200, height: 100 },
      to: { width: 300, height: 100 },
    };
    const intent = changeToIntent(change, undefined);
    expect(intent.sourceHint).toBeUndefined();
  });

  it('omits sub-2px deltas from targetStyles', () => {
    const change: ComponentChange = {
      componentId: 'c1',
      type: 'resize',
      from: { width: 200, height: 100 },
      to: { width: 201, height: 101 },
    };
    const intent = changeToIntent(change, mkComponent());
    expect(intent.targetStyles).toEqual({});
  });
});

describe('changesToIntents — merge semantics', () => {
  it('merges resize+move for the same component into one intent', () => {
    const changes: ComponentChange[] = [
      {
        componentId: 'c1',
        type: 'resize',
        from: { x: 0, y: 0, width: 200, height: 100 },
        to: { x: 0, y: 0, width: 200, height: 256 },
      },
      {
        componentId: 'c1',
        type: 'move',
        from: { x: 0, y: 0, width: 200, height: 256 },
        to: { x: 20, y: 40, width: 200, height: 256 },
      },
    ];
    const components = new Map([['c1', mkComponent()]]);
    const intents = changesToIntents(changes, components);

    expect(intents).toHaveLength(1);
    const [intent] = intents;
    expect(intent.targetStyles.height).toBe('256px');
    expect(intent.targetStyles.marginTop).toBe('40px');
    expect(intent.targetStyles.marginLeft).toBe('20px');
  });

  it('emits separate intents per component', () => {
    const changes: ComponentChange[] = [
      { componentId: 'c1', type: 'resize', from: { width: 100, height: 100 }, to: { width: 200, height: 100 } },
      { componentId: 'c2', type: 'resize', from: { width: 100, height: 100 }, to: { width: 100, height: 200 } },
    ];
    const components = new Map([
      ['c1', mkComponent({ id: 'c1' })],
      ['c2', mkComponent({ id: 'c2' })],
    ]);
    const intents = changesToIntents(changes, components);

    expect(intents).toHaveLength(2);
    expect(intents.find((i) => i.componentId === 'c1')?.targetStyles.width).toBe('200px');
    expect(intents.find((i) => i.componentId === 'c2')?.targetStyles.height).toBe('200px');
  });

  it('drops components whose merged intent has empty targetStyles', () => {
    const changes: ComponentChange[] = [
      { componentId: 'c1', type: 'resize', from: { width: 200, height: 100 }, to: { width: 201, height: 101 } },
    ];
    const components = new Map([['c1', mkComponent()]]);
    const intents = changesToIntents(changes, components);
    expect(intents).toHaveLength(0);
  });

  it('tolerates missing component metadata', () => {
    const changes: ComponentChange[] = [
      { componentId: 'c-unknown', type: 'resize', from: { width: 100, height: 100 }, to: { width: 200, height: 100 } },
    ];
    const intents = changesToIntents(changes, new Map());
    expect(intents).toHaveLength(1);
    expect(intents[0].sourceHint).toBeUndefined();
  });
});

describe('kebab-case helpers', () => {
  it('toKebabCase converts simple camelCase', () => {
    expect(toKebabCase('marginTop')).toBe('margin-top');
    expect(toKebabCase('backgroundColor')).toBe('background-color');
    expect(toKebabCase('height')).toBe('height');
  });

  it('targetStylesToKebab rewrites every key', () => {
    expect(targetStylesToKebab({ marginTop: '10px', height: '256px' })).toEqual({
      'margin-top': '10px',
      height: '256px',
    });
  });
});
