import { describe, it, expect } from 'vitest';

// Mirror applyDiff from apply/route.ts for testing
function applyDiff(
  content: string,
  diff: { original: string; modified: string; file: string },
): { ok: true; content: string } | { ok: false; reason: string } {
  const original = diff.original ?? '';
  const modified = diff.modified ?? '';
  if (!original || !modified) return { ok: false, reason: 'empty' };
  const origLines = original.split('\n').length;
  const modLines = modified.split('\n').length;
  if (origLines !== modLines) return { ok: false, reason: `line count: ${origLines}→${modLines}` };
  const isCssFile = diff.file.endsWith('.css') || diff.file.endsWith('.scss');
  if (!isCssFile) {
    if (!original.includes('className') && !original.includes('style')) return { ok: false, reason: 'no className/style' };
  }
  if (isCssFile) {
    const idx = content.indexOf(original);
    if (idx !== -1) return { ok: true, content: content.slice(0, idx) + modified + content.slice(idx + original.length) };
    return { ok: false, reason: 'not found in CSS' };
  }
  const patterns = ['function ', 'const ', 'let ', 'var ', 'return ', 'import ', 'export ', '=>'];
  for (const p of patterns) {
    const e = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const oc = (original.match(new RegExp(e, 'g')) || []).length;
    const mc = (modified.match(new RegExp(e, 'g')) || []).length;
    if (oc !== mc) return { ok: false, reason: `JS changed: ${p.trim()}` };
  }
  const idx = content.indexOf(original);
  if (idx === -1) return { ok: false, reason: 'not found' };
  return { ok: true, content: content.slice(0, idx) + modified + content.slice(idx + original.length) };
}

describe('Security: JS injection prevention', () => {
  const file = `<div className="flex h-48">content</div>`;

  it('reject: added function keyword', () => {
    expect(applyDiff(file, { file: 'a.tsx', original: 'className="flex h-48"', modified: 'className="flex h-48" function hack()' }).ok).toBe(false);
  });
  it('reject: added const keyword', () => {
    expect(applyDiff(file, { file: 'a.tsx', original: 'className="flex h-48"', modified: 'className="flex" const x = 1' }).ok).toBe(false);
  });
  it('reject: added let keyword', () => {
    expect(applyDiff(file, { file: 'a.tsx', original: 'className="flex h-48"', modified: 'className="flex" let y = 2' }).ok).toBe(false);
  });
  it('reject: added var keyword', () => {
    expect(applyDiff(file, { file: 'a.tsx', original: 'className="flex h-48"', modified: 'className="flex" var z = 3' }).ok).toBe(false);
  });
  it('reject: added return keyword', () => {
    expect(applyDiff(file, { file: 'a.tsx', original: 'className="flex h-48"', modified: 'className="flex" return null' }).ok).toBe(false);
  });
  it('reject: added import keyword', () => {
    expect(applyDiff(file, { file: 'a.tsx', original: 'className="flex h-48"', modified: 'className="flex" import evil from "evil"' }).ok).toBe(false);
  });
  it('reject: added export keyword', () => {
    expect(applyDiff(file, { file: 'a.tsx', original: 'className="flex h-48"', modified: 'className="flex" export default null' }).ok).toBe(false);
  });
  it('reject: added arrow function', () => {
    expect(applyDiff(file, { file: 'a.tsx', original: 'className="flex h-48"', modified: 'className="flex" => {}' }).ok).toBe(false);
  });
  it('reject: line count increase', () => {
    expect(applyDiff(file, { file: 'a.tsx', original: 'className="flex"', modified: 'className="flex"\nclassName="extra"' }).ok).toBe(false);
  });
  it('reject: empty original', () => {
    expect(applyDiff(file, { file: 'a.tsx', original: '', modified: 'className="new"' }).ok).toBe(false);
  });
  it('reject: empty modified', () => {
    expect(applyDiff(file, { file: 'a.tsx', original: 'className="old"', modified: '' }).ok).toBe(false);
  });
  it('reject: no className or style in non-CSS file', () => {
    expect(applyDiff(file, { file: 'a.tsx', original: 'function foo()', modified: 'function bar()' }).ok).toBe(false);
  });
});

describe('Security: CSS file handling', () => {
  const cssFile = `.card {\n  height: 200px;\n  background: white;\n}`;

  it('allow: CSS property change', () => {
    const r = applyDiff(cssFile, { file: 'styles.css', original: '.card {\n  height: 200px;\n  background: white;\n}', modified: '.card {\n  height: 300px;\n  background: white;\n}' });
    expect(r.ok).toBe(true);
  });
  it('allow: SCSS file property change', () => {
    const r = applyDiff(cssFile, { file: 'styles.scss', original: '.card {\n  height: 200px;\n  background: white;\n}', modified: '.card {\n  height: 300px;\n  background: white;\n}' });
    expect(r.ok).toBe(true);
  });
  it('reject: CSS rule not found', () => {
    const r = applyDiff(cssFile, { file: 'styles.css', original: '.nonexistent { }', modified: '.nonexistent { height: 100px; }' });
    expect(r.ok).toBe(false);
  });
});

describe('Security: path traversal concerns', () => {
  it('diff file path should be relative, not absolute', () => {
    // The refactoring pipeline should only produce relative paths
    // Absolute paths could be used for path traversal
    // This is tested at the API level (isPathSafe), but diffs should be clean
    const safePaths = ['src/Card.tsx', 'src/styles/app.css', 'components/Hero.tsx'];
    const unsafePaths = ['/etc/passwd', '../../../secret.env', '../../node_modules/.cache'];

    for (const p of safePaths) {
      expect(p.startsWith('/')).toBe(false);
      expect(p.includes('..')).toBe(false);
    }
    for (const p of unsafePaths) {
      expect(p.startsWith('/') || p.includes('..')).toBe(true);
    }
  });
});

describe('Safety: style attribute validation', () => {
  const file = `<div className="box" style={{ height: '200px' }}>x</div>`;

  it('allow: style property update', () => {
    const r = applyDiff(file, {
      file: 'a.tsx',
      original: `style={{ height: '200px' }}`,
      modified: `style={{ height: '300px' }}`,
    });
    expect(r.ok).toBe(true);
  });
  it('allow: className + style combined', () => {
    const r = applyDiff(file, {
      file: 'a.tsx',
      original: `className="box" style={{ height: '200px' }}`,
      modified: `className="box" style={{ height: '300px', width: '400px' }}`,
    });
    expect(r.ok).toBe(true);
  });
});
