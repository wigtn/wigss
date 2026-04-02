import { describe, it, expect } from 'vitest';
import { generateRefactorDiffs } from '../lib/agent/refactor-client';
import { detectCssStrategy, isTailwindClassName } from '../lib/css-strategy-detector';
import { changeToCssProperties, changeToCssKebab } from '../lib/css-property-utils';
import type { ComponentChange, DetectedComponent } from '../types';

function makeComp(id: string, fullClassName: string, overrides: Partial<DetectedComponent> = {}): DetectedComponent {
  return {
    id, name: `Comp ${id}`, type: 'section', elementIds: [id],
    boundingBox: { x: 0, y: 0, width: 200, height: 100 },
    sourceFile: '', reasoning: '', fullClassName, ...overrides,
  } as DetectedComponent & { fullClassName: string };
}

// ── CSS Strategy Detector ──

describe('css-strategy-detector', () => {
  it('should detect Tailwind strategy', () => {
    const comp = makeComp('c1', 'flex h-48 w-64 bg-white');
    const sources = [{ path: 'Card.tsx', content: '<div className="flex h-48 w-64 bg-white">x</div>' }];
    const info = detectCssStrategy(comp, sources);
    expect(info.strategy).toBe('tailwind');
  });

  it('should detect CSS Module strategy', () => {
    const comp = makeComp('c1', '', { name: 'card' });
    const sources = [
      { path: 'src/Card.tsx', content: `import styles from './Card.module.css';\n<div className={styles.card}>x</div>` },
      { path: 'src/Card.module.css', content: '.card { height: 200px; }' },
    ];
    const info = detectCssStrategy(comp, sources);
    expect(info.strategy).toBe('css-module');
    expect(info.cssClassName).toBe('card');
    expect(info.stylesheetPath).toContain('Card.module.css');
  });

  it('should detect plain CSS strategy', () => {
    const comp = makeComp('c1', 'hero-banner');
    const sources = [
      { path: 'src/Hero.tsx', content: '<section className="hero-banner">x</section>' },
      { path: 'src/styles.css', content: '.hero-banner { height: 400px; background: blue; }' },
    ];
    const info = detectCssStrategy(comp, sources);
    expect(info.strategy).toBe('plain-css');
    expect(info.cssClassName).toBe('hero-banner');
  });

  it('should fallback to inline-style when nothing matches', () => {
    const comp = makeComp('c1', '');
    const sources = [{ path: 'Unknown.tsx', content: '<div>no class</div>' }];
    const info = detectCssStrategy(comp, sources);
    expect(info.strategy).toBe('inline-style');
  });

  it('isTailwindClassName: should identify Tailwind classes', () => {
    expect(isTailwindClassName('flex h-48 w-64 bg-white rounded-lg')).toBe(true);
    expect(isTailwindClassName('hero-banner')).toBe(false);
    expect(isTailwindClassName('card-container main-section')).toBe(false);
    expect(isTailwindClassName('')).toBe(false);
  });
});

// ── CSS Property Utils ──

describe('css-property-utils', () => {
  it('changeToCssProperties: resize → height/width', () => {
    const change: ComponentChange = {
      componentId: 'c1', type: 'resize',
      from: { width: 200, height: 100 }, to: { width: 300, height: 150 },
    };
    const props = changeToCssProperties(change);
    expect(props).toEqual({ height: '150px', width: '300px' });
  });

  it('changeToCssProperties: move → marginTop/marginLeft', () => {
    const change: ComponentChange = {
      componentId: 'c1', type: 'move',
      from: { x: 0, y: 0 }, to: { x: 20, y: 30 },
    };
    const props = changeToCssProperties(change);
    expect(props).toEqual({ marginTop: '30px', marginLeft: '20px' });
  });

  it('changeToCssKebab: resize → height/width in kebab-case', () => {
    const change: ComponentChange = {
      componentId: 'c1', type: 'move',
      from: { x: 0, y: 0 }, to: { x: 10, y: 20 },
    };
    const props = changeToCssKebab(change);
    expect(props).toEqual({ 'margin-top': '20px', 'margin-left': '10px' });
  });

});

// ── Inline Style Strategy ──

describe('inline-style-strategy: via generateRefactorDiffs', () => {
  it('should add style={{}} when no Tailwind class found', async () => {
    const comp = makeComp('c1', 'hero-section', { cssInfo: { strategy: 'inline-style' } });
    const source = {
      path: 'src/Hero.tsx',
      content: `<section className="hero-section">Welcome</section>`,
    };
    const change: ComponentChange = {
      componentId: 'c1', type: 'resize',
      from: { width: 800, height: 400 }, to: { width: 800, height: 300 },
    };

    const diffs = await generateRefactorDiffs({
      changes: [change], components: [comp], sources: [source],
    });

    expect(diffs).toHaveLength(1);
    expect(diffs[0].modified).toContain("style={{");
    expect(diffs[0].modified).toContain("height: '300px'");
    expect(diffs[0].strategy).toBe('inline-style');
  });

  it('should modify existing style attribute', async () => {
    const comp = makeComp('c1', 'card', { cssInfo: { strategy: 'inline-style' } });
    const source = {
      path: 'src/Card.tsx',
      content: `<div className="card" style={{ height: '200px', color: 'red' }}>content</div>`,
    };
    const change: ComponentChange = {
      componentId: 'c1', type: 'resize',
      from: { width: 300, height: 200 }, to: { width: 300, height: 150 },
    };

    const diffs = await generateRefactorDiffs({
      changes: [change], components: [comp], sources: [source],
    });

    expect(diffs).toHaveLength(1);
    expect(diffs[0].modified).toContain("height: '150px'");
    expect(diffs[0].modified).toContain("color: 'red'");
  });
});

// ── CSS Module Strategy ──

describe('css-module-strategy: via generateRefactorDiffs', () => {
  it('should modify .module.css rule', async () => {
    const comp = makeComp('c1', '', {
      cssInfo: {
        strategy: 'css-module',
        bindingName: 'styles',
        stylesheetPath: 'src/Card.module.css',
        cssClassName: 'card',
      },
    });
    const sources = [
      { path: 'src/Card.tsx', content: `import styles from './Card.module.css';\n<div className={styles.card}>x</div>` },
      { path: 'src/Card.module.css', content: `.card {\n  height: 200px;\n  background: white;\n}` },
    ];
    const change: ComponentChange = {
      componentId: 'c1', type: 'resize',
      from: { width: 300, height: 200 }, to: { width: 300, height: 150 },
    };

    const diffs = await generateRefactorDiffs({
      changes: [change], components: [comp], sources,
    });

    expect(diffs).toHaveLength(1);
    expect(diffs[0].file).toBe('src/Card.module.css');
    expect(diffs[0].modified).toContain('height: 150px');
    expect(diffs[0].modified).not.toContain('height: 200px');
    expect(diffs[0].strategy).toBe('css-module');
  });

  it('should add property if not exists in CSS module', async () => {
    const comp = makeComp('c1', '', {
      cssInfo: {
        strategy: 'css-module',
        stylesheetPath: 'src/Box.module.css',
        cssClassName: 'box',
      },
    });
    const sources = [
      { path: 'src/Box.module.css', content: `.box {\n  background: gray;\n}` },
    ];
    const change: ComponentChange = {
      componentId: 'c1', type: 'resize',
      from: { width: 200, height: 100 }, to: { width: 400, height: 100 },
    };

    const diffs = await generateRefactorDiffs({
      changes: [change], components: [comp], sources,
    });

    expect(diffs).toHaveLength(1);
    expect(diffs[0].modified).toContain('width: 400px');
    expect(diffs[0].modified).toContain('background: gray');
  });
});

// ── Plain CSS Strategy ──

describe('plain-css-strategy: via generateRefactorDiffs', () => {
  it('should modify .css rule', async () => {
    const comp = makeComp('c1', 'hero', {
      cssInfo: {
        strategy: 'plain-css',
        stylesheetPath: 'src/styles.css',
        cssClassName: 'hero',
      },
    });
    const sources = [
      { path: 'src/Hero.tsx', content: `<div className="hero">x</div>` },
      { path: 'src/styles.css', content: `.hero {\n  height: 400px;\n  background: blue;\n}` },
    ];
    const change: ComponentChange = {
      componentId: 'c1', type: 'resize',
      from: { width: 1200, height: 400 }, to: { width: 1200, height: 300 },
    };

    const diffs = await generateRefactorDiffs({
      changes: [change], components: [comp], sources,
    });

    expect(diffs).toHaveLength(1);
    expect(diffs[0].file).toBe('src/styles.css');
    expect(diffs[0].modified).toContain('height: 300px');
    expect(diffs[0].strategy).toBe('plain-css');
  });

  it('should handle move with margin-top in plain CSS', async () => {
    const comp = makeComp('c1', 'sidebar', {
      cssInfo: {
        strategy: 'plain-css',
        stylesheetPath: 'src/layout.css',
        cssClassName: 'sidebar',
      },
    });
    const sources = [
      { path: 'src/layout.css', content: `.sidebar {\n  width: 250px;\n  margin-top: 20px;\n}` },
    ];
    const change: ComponentChange = {
      componentId: 'c1', type: 'move',
      from: { x: 0, y: 20 }, to: { x: 0, y: 50 },
    };

    const diffs = await generateRefactorDiffs({
      changes: [change], components: [comp], sources,
    });

    expect(diffs).toHaveLength(1);
    expect(diffs[0].modified).toContain('margin-top: 30px');
  });
});
