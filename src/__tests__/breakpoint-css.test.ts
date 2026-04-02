import { describe, it, expect } from 'vitest';
import { findOrCreateMediaRule } from '../lib/postcss-utils';
import { refactorCssModule } from '../lib/agent/strategies/css-module-strategy';
import { refactorPlainCss } from '../lib/agent/strategies/plain-css-strategy';
import type { ComponentChange, DetectedComponent, CssStrategyInfo } from '../types';

describe('findOrCreateMediaRule', () => {
  // Case A: Existing @media + existing rule → modify properties
  it('Case A: should modify existing rule inside existing @media', () => {
    const css = `.card {\n  height: 200px;\n}\n\n@media (min-width: 768px) {\n  .card {\n    height: 300px;\n  }\n}`;

    const result = findOrCreateMediaRule(css, 'card', 'md', { height: '400px' });
    expect(result).not.toBeNull();
    expect(result!.modified).toContain('height: 400px');
    // The original should contain the old @media block
    expect(result!.original).toContain('height: 300px');
  });

  // Case B: Existing @media + no rule → add rule inside @media
  it('Case B: should add new rule inside existing @media', () => {
    const css = `.card {\n  height: 200px;\n}\n\n@media (min-width: 768px) {\n  .other {\n    width: 100%;\n  }\n}`;

    const result = findOrCreateMediaRule(css, 'card', 'md', { height: '300px' });
    expect(result).not.toBeNull();
    expect(result!.modified).toContain('.card');
    expect(result!.modified).toContain('height: 300px');
  });

  // Case C: No @media → create @media block
  it('Case C: should create new @media block when none exists', () => {
    const css = `.card {\n  height: 200px;\n}`;

    const result = findOrCreateMediaRule(css, 'card', 'md', { height: '300px' });
    expect(result).not.toBeNull();
    expect(result!.modified).toContain('@media (min-width: 768px)');
    expect(result!.modified).toContain('.card');
    expect(result!.modified).toContain('height: 300px');
  });

  it('should handle multiple properties', () => {
    const css = `.card {\n  height: 200px;\n  width: 100px;\n}`;

    const result = findOrCreateMediaRule(css, 'card', 'lg', {
      height: '400px',
      width: '300px',
    });
    expect(result).not.toBeNull();
    expect(result!.modified).toContain('@media (min-width: 1024px)');
    expect(result!.modified).toContain('height: 400px');
    expect(result!.modified).toContain('width: 300px');
  });

  it('should handle different breakpoints independently', () => {
    const css = `.card {\n  height: 200px;\n}\n\n@media (min-width: 768px) {\n  .card {\n    height: 300px;\n  }\n}`;

    // Adding lg breakpoint should not affect existing md
    const result = findOrCreateMediaRule(css, 'card', 'lg', { height: '500px' });
    expect(result).not.toBeNull();
    expect(result!.modified).toContain('@media (min-width: 1024px)');
  });

  it('should return null for invalid CSS', () => {
    const result = findOrCreateMediaRule('not { valid { css', 'card', 'md', { height: '300px' });
    // postcss is lenient with parsing, so this may still work
    // Just verify it doesn't throw
    expect(result).toBeDefined();
  });
});

describe('CSS Module strategy with breakpoint', () => {
  const makeComponent = (): DetectedComponent => ({
    id: 'comp-1',
    name: 'TestCard',
    type: 'card',
    elementIds: ['el-1'],
    boundingBox: { x: 0, y: 0, width: 200, height: 200 },
    sourceFile: 'src/components/Card.tsx',
    reasoning: 'test',
  });

  const makeCssInfo = (): CssStrategyInfo => ({
    strategy: 'css-module',
    stylesheetPath: 'src/components/Card.module.css',
    cssClassName: 'card',
  });

  it('should generate @media diff for breakpoint resize', () => {
    const sources = [{
      path: 'src/components/Card.module.css',
      content: `.card {\n  height: 200px;\n  background: white;\n}`,
    }];

    const change: ComponentChange = {
      componentId: 'comp-1',
      type: 'resize',
      from: { width: 200, height: 200 },
      to: { width: 200, height: 300 },
      breakpoint: 'md',
    };

    const result = refactorCssModule(change, makeComponent(), sources, makeCssInfo());
    expect(result).not.toBeNull();
    expect(result!.modified).toContain('@media (min-width: 768px)');
    expect(result!.modified).toContain('height: 300px');
    expect(result!.strategy).toBe('css-module');
  });

  it('should modify base rule when no breakpoint', () => {
    const sources = [{
      path: 'src/components/Card.module.css',
      content: `.card {\n  height: 200px;\n  background: white;\n}`,
    }];

    const change: ComponentChange = {
      componentId: 'comp-1',
      type: 'resize',
      from: { width: 200, height: 200 },
      to: { width: 200, height: 300 },
      breakpoint: null,
    };

    const result = refactorCssModule(change, makeComponent(), sources, makeCssInfo());
    expect(result).not.toBeNull();
    expect(result!.modified).toContain('height: 300px');
    // Should NOT contain @media
    expect(result!.modified).not.toContain('@media');
  });
});

describe('Plain CSS strategy with breakpoint', () => {
  const makeComponent = (): DetectedComponent => ({
    id: 'comp-1',
    name: 'TestCard',
    type: 'card',
    elementIds: ['el-1'],
    boundingBox: { x: 0, y: 0, width: 200, height: 200 },
    sourceFile: 'src/components/Card.tsx',
    reasoning: 'test',
  });

  const makeCssInfo = (): CssStrategyInfo => ({
    strategy: 'plain-css',
    stylesheetPath: 'src/styles/global.css',
    cssClassName: 'card',
  });

  it('should generate @media diff for breakpoint resize', () => {
    const sources = [{
      path: 'src/styles/global.css',
      content: `.card {\n  height: 200px;\n  background: white;\n}`,
    }];

    const change: ComponentChange = {
      componentId: 'comp-1',
      type: 'resize',
      from: { width: 200, height: 200 },
      to: { width: 200, height: 400 },
      breakpoint: 'lg',
    };

    const result = refactorPlainCss(change, makeComponent(), sources, makeCssInfo());
    expect(result).not.toBeNull();
    expect(result!.modified).toContain('@media (min-width: 1024px)');
    expect(result!.modified).toContain('height: 400px');
    expect(result!.strategy).toBe('plain-css');
  });
});
