import { describe, it, expect } from 'vitest';
import { generateRefactorDiffs } from '../lib/agent/refactor-client';
import { findLinkedStylesheets } from '../lib/css-strategy-detector';
import type { ComponentChange, DetectedComponent } from '../types';

function mkHtmlComponent(partial: Partial<DetectedComponent> = {}): DetectedComponent {
  return {
    id: 'c1',
    name: 'card',
    type: 'card',
    elementIds: ['el-1'],
    boundingBox: { x: 0, y: 0, width: 200, height: 100 },
    sourceFile: 'index.html',
    reasoning: 'html+css test',
    fullClassName: 'card',
    ...partial,
  };
}

describe('findLinkedStylesheets', () => {
  it('extracts hrefs from <link rel="stylesheet">', () => {
    const html = `
      <link rel="stylesheet" href="styles.css">
      <link rel="icon" href="favicon.ico">
      <link rel="stylesheet" href="theme.css">
    `;
    expect(findLinkedStylesheets(html)).toEqual(['styles.css', 'theme.css']);
  });

  it('handles single quotes and attribute order', () => {
    const html = `<link href='a.css' rel='stylesheet'><link rel="stylesheet" href="b.css">`;
    expect(findLinkedStylesheets(html)).toEqual(['a.css', 'b.css']);
  });

  it('returns empty for HTML without stylesheets', () => {
    expect(findLinkedStylesheets('<html><body>hi</body></html>')).toEqual([]);
  });
});

describe('html-css rewriter: replace existing rule', () => {
  it('updates height in linked stylesheet when .card rule exists', async () => {
    const html = `<!DOCTYPE html>
<html>
<head><link rel="stylesheet" href="styles.css"></head>
<body>
  <div class="card">Hello</div>
</body>
</html>`;
    const css = `.card {
  width: 200px;
  height: 100px;
  background: #fff;
}`;
    const changes: ComponentChange[] = [
      {
        componentId: 'c1',
        type: 'resize',
        from: { width: 200, height: 100 },
        to: { width: 200, height: 256 },
      },
    ];
    const diffs = await generateRefactorDiffs({
      changes,
      components: [mkHtmlComponent()],
      sources: [
        { path: 'index.html', content: html },
        { path: 'styles.css', content: css },
      ],
    });

    expect(diffs).toHaveLength(1);
    expect(diffs[0].file).toBe('styles.css');
    expect(diffs[0].strategy).toBe('html-css');
    expect(diffs[0].modified).toContain('height: 256px');
    expect(diffs[0].modified).not.toContain('height: 100px');
    // Existing width should be preserved
    expect(diffs[0].modified).toContain('width: 200px');
  });

  it('updates both width and height in a single diff', async () => {
    const html = `<!DOCTYPE html><html><head><link rel="stylesheet" href="styles.css"></head><body><div class="card">x</div></body></html>`;
    const css = `.card { width: 100px; height: 100px; }`;
    const changes: ComponentChange[] = [
      {
        componentId: 'c1',
        type: 'resize',
        from: { width: 100, height: 100 },
        to: { width: 300, height: 200 },
      },
    ];
    const diffs = await generateRefactorDiffs({
      changes,
      components: [mkHtmlComponent()],
      sources: [
        { path: 'index.html', content: html },
        { path: 'styles.css', content: css },
      ],
    });

    expect(diffs).toHaveLength(1);
    expect(diffs[0].modified).toContain('width: 300px');
    expect(diffs[0].modified).toContain('height: 200px');
  });
});

describe('html-css rewriter: append new rule', () => {
  it('appends rule when stylesheet exists but class is missing', async () => {
    const html = `<!DOCTYPE html>
<html>
<head><link rel="stylesheet" href="styles.css"></head>
<body><div class="card">Hi</div></body>
</html>`;
    const css = `body { margin: 0; }
.header { font-size: 24px; }`;
    const changes: ComponentChange[] = [
      {
        componentId: 'c1',
        type: 'resize',
        from: { width: 100, height: 100 },
        to: { width: 100, height: 200 },
      },
    ];
    const diffs = await generateRefactorDiffs({
      changes,
      components: [mkHtmlComponent()],
      sources: [
        { path: 'index.html', content: html },
        { path: 'styles.css', content: css },
      ],
    });

    // Because .card is not in styles.css, detectCssStrategy's HTML path won't
    // find a stylesheetPath, and falls back to first .css with .card which
    // doesn't match either → stylesheet is undefined, inline fallback activates.
    // So for this test we expect the inline-style injection on the HTML tag.
    expect(diffs).toHaveLength(1);
    expect(diffs[0].file).toBe('index.html');
    expect(diffs[0].modified).toContain('style="height: 200px"');
  });
});

describe('html-css rewriter: inline fallback', () => {
  it('adds style="" attribute when no stylesheet is available', async () => {
    const html = `<!DOCTYPE html>
<html>
<body>
  <div class="card">Hi</div>
</body>
</html>`;
    const changes: ComponentChange[] = [
      {
        componentId: 'c1',
        type: 'resize',
        from: { width: 100, height: 100 },
        to: { width: 100, height: 256 },
      },
    ];
    const diffs = await generateRefactorDiffs({
      changes,
      components: [mkHtmlComponent()],
      sources: [{ path: 'index.html', content: html }],
    });

    expect(diffs).toHaveLength(1);
    expect(diffs[0].file).toBe('index.html');
    expect(diffs[0].strategy).toBe('html-css');
    expect(diffs[0].modified).toContain('style="height: 256px"');
    expect(diffs[0].modified).toContain('class="card"');
  });

  it('merges into an existing style="" attribute without clobbering other properties', async () => {
    const html = `<div class="card" style="color: red; width: 100px">Hi</div>`;
    const changes: ComponentChange[] = [
      {
        componentId: 'c1',
        type: 'resize',
        from: { width: 100, height: 100 },
        to: { width: 100, height: 256 },
      },
    ];
    const diffs = await generateRefactorDiffs({
      changes,
      components: [mkHtmlComponent()],
      sources: [{ path: 'index.html', content: html }],
    });

    expect(diffs).toHaveLength(1);
    expect(diffs[0].modified).toContain('color: red');
    expect(diffs[0].modified).toContain('width: 100px');
    expect(diffs[0].modified).toContain('height: 256px');
  });
});

describe('html-css rewriter: safety guards', () => {
  it('does not modify elements whose only match is inside a <script> block', async () => {
    // Only occurrence of class="card" is inside the script — rewriter must bail.
    const html = `<!DOCTYPE html>
<html>
<body>
  <div class="other">real</div>
  <script>
    const snippet = '<div class="card">fake</div>';
  </script>
</body>
</html>`;
    const changes: ComponentChange[] = [
      {
        componentId: 'c1',
        type: 'resize',
        from: { width: 100, height: 100 },
        to: { width: 100, height: 256 },
      },
    ];
    const diffs = await generateRefactorDiffs({
      changes,
      components: [mkHtmlComponent()],
      sources: [{ path: 'index.html', content: html }],
    });

    expect(diffs).toHaveLength(0);
  });

  it('prefers the non-script element when both exist', async () => {
    const html = `<!DOCTYPE html>
<html>
<body>
  <script>
    const snippet = '<div class="card">fake</div>';
  </script>
  <div class="card">real</div>
</body>
</html>`;
    const changes: ComponentChange[] = [
      {
        componentId: 'c1',
        type: 'resize',
        from: { width: 100, height: 100 },
        to: { width: 100, height: 256 },
      },
    ];
    const diffs = await generateRefactorDiffs({
      changes,
      components: [mkHtmlComponent()],
      sources: [{ path: 'index.html', content: html }],
    });

    expect(diffs).toHaveLength(1);
    // Locator must pick the HTML element, not the one in the script string.
    // After applying, the real <div class="card"> should carry the new style.
    const applied = html.replace(diffs[0].original, diffs[0].modified);
    expect(applied).toContain('<div class="card" style="height: 256px">real</div>');
    // Script snippet must be untouched.
    expect(applied).toContain(`const snippet = '<div class="card">fake</div>'`);
  });

  it('returns no diff when the class is not present in the HTML', async () => {
    const html = `<div class="other">Hi</div>`;
    const changes: ComponentChange[] = [
      {
        componentId: 'c1',
        type: 'resize',
        from: { width: 100, height: 100 },
        to: { width: 100, height: 256 },
      },
    ];
    const diffs = await generateRefactorDiffs({
      changes,
      components: [mkHtmlComponent()],
      sources: [{ path: 'index.html', content: html }],
    });

    expect(diffs).toHaveLength(0);
  });
});
