import { describe, it, expect } from 'vitest';
import { generateRefactorDiffs } from '../lib/agent/refactor-client';
import type { ComponentChange, DetectedComponent } from '../types';

function comp(id: string, cls: string): DetectedComponent {
  return { id, name: id, type: 'section', elementIds: [id], boundingBox: { x: 0, y: 0, width: 200, height: 100 }, sourceFile: '', reasoning: '', fullClassName: cls, cssInfo: { strategy: 'inline-style' } } as any;
}

describe('Inline style edge cases', () => {
  it('should add style to element with no existing style', async () => {
    const d = await generateRefactorDiffs({
      changes: [{ componentId: 'c1', type: 'resize', from: { width: 200, height: 100 }, to: { width: 200, height: 250 } }],
      components: [comp('c1', 'card-box')],
      sources: [{ path: 'src/Card.tsx', content: '<div className="card-box">content</div>' }],
    });
    expect(d).toHaveLength(1);
    expect(d[0].modified).toContain("style={{");
    expect(d[0].modified).toContain("height: '250px'");
  });

  it('should handle width-only resize', async () => {
    const d = await generateRefactorDiffs({
      changes: [{ componentId: 'c1', type: 'resize', from: { width: 200, height: 100 }, to: { width: 350, height: 100 } }],
      components: [comp('c1', 'sidebar')],
      sources: [{ path: 'src/Sidebar.tsx', content: '<aside className="sidebar">nav</aside>' }],
    });
    expect(d).toHaveLength(1);
    expect(d[0].modified).toContain("width: '350px'");
  });

  it('should handle both width and height resize', async () => {
    const d = await generateRefactorDiffs({
      changes: [{ componentId: 'c1', type: 'resize', from: { width: 200, height: 100 }, to: { width: 300, height: 200 } }],
      components: [comp('c1', 'box')],
      sources: [{ path: 'src/Box.tsx', content: '<div className="box">x</div>' }],
    });
    expect(d).toHaveLength(1);
    expect(d[0].modified).toContain("height: '200px'");
    expect(d[0].modified).toContain("width: '300px'");
  });

  it('should handle move with marginTop', async () => {
    const d = await generateRefactorDiffs({
      changes: [{ componentId: 'c1', type: 'move', from: { x: 0, y: 0 }, to: { x: 0, y: 40 } }],
      components: [comp('c1', 'header')],
      sources: [{ path: 'src/Header.tsx', content: '<header className="header">title</header>' }],
    });
    expect(d).toHaveLength(1);
    expect(d[0].modified).toContain("marginTop: '40px'");
  });

  it('should handle move with marginLeft', async () => {
    const d = await generateRefactorDiffs({
      changes: [{ componentId: 'c1', type: 'move', from: { x: 0, y: 0 }, to: { x: 25, y: 0 } }],
      components: [comp('c1', 'panel')],
      sources: [{ path: 'src/Panel.tsx', content: '<div className="panel">x</div>' }],
    });
    expect(d).toHaveLength(1);
    expect(d[0].modified).toContain("marginLeft: '25px'");
  });

  it('should handle diagonal move', async () => {
    const d = await generateRefactorDiffs({
      changes: [{ componentId: 'c1', type: 'move', from: { x: 0, y: 0 }, to: { x: 15, y: 30 } }],
      components: [comp('c1', 'widget')],
      sources: [{ path: 'src/Widget.tsx', content: '<div className="widget">x</div>' }],
    });
    expect(d).toHaveLength(1);
    expect(d[0].modified).toContain("marginTop: '30px'");
    expect(d[0].modified).toContain("marginLeft: '15px'");
  });

  it('should update existing style property', async () => {
    const d = await generateRefactorDiffs({
      changes: [{ componentId: 'c1', type: 'resize', from: { width: 200, height: 200 }, to: { width: 200, height: 300 } }],
      components: [comp('c1', 'card')],
      sources: [{ path: 'src/Card.tsx', content: `<div className="card" style={{ height: '200px', color: 'red' }}>x</div>` }],
    });
    expect(d).toHaveLength(1);
    expect(d[0].modified).toContain("height: '300px'");
    expect(d[0].modified).toContain("color: 'red'");
  });

  it('should add new property to existing style', async () => {
    const d = await generateRefactorDiffs({
      changes: [{ componentId: 'c1', type: 'resize', from: { width: 200, height: 100 }, to: { width: 400, height: 100 } }],
      components: [comp('c1', 'box')],
      sources: [{ path: 'src/Box.tsx', content: `<div className="box" style={{ color: 'blue' }}>x</div>` }],
    });
    expect(d).toHaveLength(1);
    expect(d[0].modified).toContain("width: '400px'");
    expect(d[0].modified).toContain("color: 'blue'");
  });

  it('should ignore sub-threshold changes (2px)', async () => {
    const d = await generateRefactorDiffs({
      changes: [{ componentId: 'c1', type: 'resize', from: { width: 200, height: 100 }, to: { width: 201, height: 101 } }],
      components: [comp('c1', 'tiny')],
      sources: [{ path: 'src/Tiny.tsx', content: '<div className="tiny">x</div>' }],
    });
    expect(d).toHaveLength(0);
  });

  it('should produce strategy=inline-style in diff', async () => {
    const d = await generateRefactorDiffs({
      changes: [{ componentId: 'c1', type: 'resize', from: { width: 200, height: 100 }, to: { width: 200, height: 250 } }],
      components: [comp('c1', 'box')],
      sources: [{ path: 'src/Box.tsx', content: '<div className="box">x</div>' }],
    });
    expect(d).toHaveLength(1);
    expect(d[0].strategy).toBe('inline-style');
  });
});
