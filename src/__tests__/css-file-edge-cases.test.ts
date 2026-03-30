import { describe, it, expect } from 'vitest';
import { generateRefactorDiffs } from '../lib/agent/refactor-client';
import type { ComponentChange, DetectedComponent } from '../types';

function comp(id: string, strategy: 'css-module' | 'plain-css', cssClassName: string, stylesheetPath: string): DetectedComponent {
  return {
    id, name: id, type: 'section', elementIds: [id],
    boundingBox: { x: 0, y: 0, width: 200, height: 100 },
    sourceFile: '', reasoning: '', fullClassName: '',
    cssInfo: { strategy, cssClassName, stylesheetPath },
  } as any;
}

const resize = (fromH: number, toH: number): ComponentChange => ({
  componentId: 'c1', type: 'resize', from: { width: 200, height: fromH }, to: { width: 200, height: toH },
});
const resizeW = (fromW: number, toW: number): ComponentChange => ({
  componentId: 'c1', type: 'resize', from: { width: fromW, height: 100 }, to: { width: toW, height: 100 },
});
const moveY = (fromY: number, toY: number): ComponentChange => ({
  componentId: 'c1', type: 'move', from: { x: 0, y: fromY }, to: { x: 0, y: toY },
});

describe('CSS Module edge cases', () => {
  it('should replace height in .module.css', async () => {
    const d = await generateRefactorDiffs({
      changes: [resize(200, 300)],
      components: [comp('c1', 'css-module', 'card', 'src/Card.module.css')],
      sources: [{ path: 'src/Card.module.css', content: `.card {\n  height: 200px;\n  background: white;\n}` }],
    });
    expect(d).toHaveLength(1);
    expect(d[0].file).toBe('src/Card.module.css');
    expect(d[0].modified).toContain('height: 300px');
    expect(d[0].strategy).toBe('css-module');
  });

  it('should add width when not present', async () => {
    const d = await generateRefactorDiffs({
      changes: [resizeW(200, 400)],
      components: [comp('c1', 'css-module', 'box', 'src/Box.module.css')],
      sources: [{ path: 'src/Box.module.css', content: `.box {\n  background: gray;\n}` }],
    });
    expect(d).toHaveLength(1);
    expect(d[0].modified).toContain('width: 400px');
    expect(d[0].modified).toContain('background: gray');
  });

  it('should replace margin-top on move', async () => {
    const d = await generateRefactorDiffs({
      changes: [moveY(20, 50)],
      components: [comp('c1', 'css-module', 'banner', 'src/Banner.module.css')],
      sources: [{ path: 'src/Banner.module.css', content: `.banner {\n  margin-top: 20px;\n  color: black;\n}` }],
    });
    expect(d).toHaveLength(1);
    expect(d[0].modified).toContain('margin-top: 30px');
  });

  it('should handle rule inside @media query', async () => {
    const css = `@media (max-width: 768px) {\n  .card {\n    height: 150px;\n  }\n}`;
    const d = await generateRefactorDiffs({
      changes: [resize(150, 250)],
      components: [comp('c1', 'css-module', 'card', 'src/Card.module.css')],
      sources: [{ path: 'src/Card.module.css', content: css }],
    });
    expect(d).toHaveLength(1);
    expect(d[0].modified).toContain('height: 250px');
  });

  it('should return empty when stylesheet not found', async () => {
    const d = await generateRefactorDiffs({
      changes: [resize(100, 200)],
      components: [comp('c1', 'css-module', 'card', 'src/Missing.module.css')],
      sources: [{ path: 'src/Other.module.css', content: `.other { color: red; }` }],
    });
    expect(d).toHaveLength(0);
  });

  it('should return empty when rule not found in stylesheet', async () => {
    const d = await generateRefactorDiffs({
      changes: [resize(100, 200)],
      components: [comp('c1', 'css-module', 'missing', 'src/Card.module.css')],
      sources: [{ path: 'src/Card.module.css', content: `.card { height: 200px; }` }],
    });
    expect(d).toHaveLength(0);
  });

  it('should handle multiple properties changed at once', async () => {
    const d = await generateRefactorDiffs({
      changes: [{ componentId: 'c1', type: 'resize', from: { width: 200, height: 100 }, to: { width: 400, height: 300 } }],
      components: [comp('c1', 'css-module', 'hero', 'src/Hero.module.css')],
      sources: [{ path: 'src/Hero.module.css', content: `.hero {\n  width: 200px;\n  height: 100px;\n}` }],
    });
    expect(d).toHaveLength(1);
    expect(d[0].modified).toContain('height: 300px');
    expect(d[0].modified).toContain('width: 400px');
  });

  it('should ignore sub-threshold CSS changes', async () => {
    const d = await generateRefactorDiffs({
      changes: [resize(200, 201)],
      components: [comp('c1', 'css-module', 'card', 'src/Card.module.css')],
      sources: [{ path: 'src/Card.module.css', content: `.card { height: 200px; }` }],
    });
    expect(d).toHaveLength(0);
  });
});

describe('Plain CSS edge cases', () => {
  it('should modify .css rule', async () => {
    const d = await generateRefactorDiffs({
      changes: [resize(400, 300)],
      components: [comp('c1', 'plain-css', 'hero', 'src/styles.css')],
      sources: [{ path: 'src/styles.css', content: `.hero {\n  height: 400px;\n  background: blue;\n}` }],
    });
    expect(d).toHaveLength(1);
    expect(d[0].modified).toContain('height: 300px');
    expect(d[0].strategy).toBe('plain-css');
  });

  it('should search all CSS files when no stylesheetPath', async () => {
    const c: DetectedComponent = {
      id: 'c1', name: 'c1', type: 'section', elementIds: ['c1'],
      boundingBox: { x: 0, y: 0, width: 200, height: 100 },
      sourceFile: '', reasoning: '', fullClassName: '',
      cssInfo: { strategy: 'plain-css', cssClassName: 'sidebar' },
    } as any;
    const d = await generateRefactorDiffs({
      changes: [resizeW(250, 350)],
      components: [c],
      sources: [
        { path: 'src/main.css', content: `.header { color: red; }` },
        { path: 'src/layout.css', content: `.sidebar {\n  width: 250px;\n}` },
      ],
    });
    expect(d).toHaveLength(1);
    expect(d[0].file).toBe('src/layout.css');
    expect(d[0].modified).toContain('width: 350px');
  });

  it('should add margin-top on move', async () => {
    const d = await generateRefactorDiffs({
      changes: [moveY(0, 40)],
      components: [comp('c1', 'plain-css', 'footer', 'src/app.css')],
      sources: [{ path: 'src/app.css', content: `.footer {\n  background: #333;\n}` }],
    });
    expect(d).toHaveLength(1);
    expect(d[0].modified).toContain('margin-top: 40px');
  });

  it('should handle SCSS-style file', async () => {
    const d = await generateRefactorDiffs({
      changes: [resize(200, 150)],
      components: [comp('c1', 'plain-css', 'card', 'src/styles.scss')],
      sources: [{ path: 'src/styles.scss', content: `.card {\n  height: 200px;\n  border-radius: 8px;\n}` }],
    });
    expect(d).toHaveLength(1);
    expect(d[0].modified).toContain('height: 150px');
    expect(d[0].modified).toContain('border-radius: 8px');
  });
});
