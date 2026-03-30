import { describe, it, expect } from 'vitest';

// Extract applyDiff logic inline since it's not exported from route.ts
// This mirrors the exact logic in src/app/api/apply/route.ts lines 6-48
function applyDiff(
  content: string,
  diff: { original: string; modified: string; file: string },
): { ok: true; content: string } | { ok: false; reason: string } {
  const original = diff.original ?? '';
  const modified = diff.modified ?? '';

  if (!original || !modified) {
    return { ok: false, reason: 'Rejected: empty original or modified' };
  }

  const origLines = original.split('\n').length;
  const modLines = modified.split('\n').length;
  if (origLines !== modLines) {
    return { ok: false, reason: `Rejected: line count changed (${origLines}→${modLines})` };
  }

  const hasClassName = original.includes('className');
  const hasStyle = original.includes('style');
  if (!hasClassName && !hasStyle) {
    return { ok: false, reason: 'Rejected: diff must modify className or style' };
  }

  const dangerousPatterns = ['function ', 'const ', 'let ', 'var ', 'return ', 'import ', 'export ', '=>'];
  for (const pattern of dangerousPatterns) {
    const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const origCount = (original.match(new RegExp(escaped, 'g')) || []).length;
    const modCount = (modified.match(new RegExp(escaped, 'g')) || []).length;
    if (origCount !== modCount) {
      return { ok: false, reason: `Rejected: JS structure changed (${pattern.trim()})` };
    }
  }

  if (original.length > 0) {
    const foundIndex = content.indexOf(original);
    if (foundIndex !== -1) {
      const nextContent = `${content.slice(0, foundIndex)}${modified}${content.slice(foundIndex + original.length)}`;
      return { ok: true, content: nextContent };
    }
  }

  return { ok: false, reason: `Cannot find original snippet in file "${diff.file}"` };
}

const SAMPLE_FILE = `export function Card() {
  return (
    <div className="flex flex-col p-4 h-48 w-64 mt-4 bg-white rounded-lg shadow">
      <h2 className="text-lg font-bold">Title</h2>
    </div>
  );
}`;

describe('applyDiff: safety checks', () => {
  it('should apply a valid className replacement', () => {
    const result = applyDiff(SAMPLE_FILE, {
      file: 'Card.tsx',
      original: 'className="flex flex-col p-4 h-48 w-64 mt-4 bg-white rounded-lg shadow"',
      modified: 'className="flex flex-col p-4 h-64 w-64 mt-4 bg-white rounded-lg shadow"',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.content).toContain('h-64');
      expect(result.content).not.toContain('h-48');
      // Everything else unchanged
      expect(result.content).toContain('export function Card()');
      expect(result.content).toContain('text-lg font-bold');
    }
  });

  it('should reject empty original', () => {
    const result = applyDiff(SAMPLE_FILE, {
      file: 'Card.tsx',
      original: '',
      modified: 'className="new"',
    });
    expect(result.ok).toBe(false);
  });

  it('should reject empty modified', () => {
    const result = applyDiff(SAMPLE_FILE, {
      file: 'Card.tsx',
      original: 'className="old"',
      modified: '',
    });
    expect(result.ok).toBe(false);
  });

  it('should reject line count mismatch', () => {
    const result = applyDiff(SAMPLE_FILE, {
      file: 'Card.tsx',
      original: 'className="flex"',
      modified: 'className="flex"\nclassName="extra"',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('line count changed');
    }
  });

  it('should reject diffs without className or style', () => {
    const result = applyDiff(SAMPLE_FILE, {
      file: 'Card.tsx',
      original: 'function Card()',
      modified: 'function NewCard()',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('className or style');
    }
  });

  it('should reject JS structure changes (added function)', () => {
    const result = applyDiff(SAMPLE_FILE, {
      file: 'Card.tsx',
      original: 'className="flex"',
      modified: 'className="flex" function hack()',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('JS structure changed');
    }
  });

  it('should reject JS structure changes (added const)', () => {
    const result = applyDiff(SAMPLE_FILE, {
      file: 'Card.tsx',
      original: 'className="flex"',
      modified: 'className="flex" const x',
    });
    expect(result.ok).toBe(false);
  });

  it('should reject JS structure changes (added import)', () => {
    const result = applyDiff(SAMPLE_FILE, {
      file: 'Card.tsx',
      original: 'className="flex"',
      modified: 'className="flex" import evil',
    });
    expect(result.ok).toBe(false);
  });

  it('should reject JS structure changes (added arrow function)', () => {
    const result = applyDiff(SAMPLE_FILE, {
      file: 'Card.tsx',
      original: 'className="flex"',
      modified: 'className="flex" => {}',
    });
    expect(result.ok).toBe(false);
  });

  it('should fail when original snippet not found in file', () => {
    const result = applyDiff(SAMPLE_FILE, {
      file: 'Card.tsx',
      original: 'className="nonexistent-class"',
      modified: 'className="new-class"',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('Cannot find');
    }
  });

  it('should handle style attribute changes', () => {
    const fileWithStyle = `<div style={{ color: 'red' }} className="p-4">content</div>`;
    const result = applyDiff(fileWithStyle, {
      file: 'Styled.tsx',
      original: `style={{ color: 'red' }} className="p-4"`,
      modified: `style={{ color: 'blue' }} className="p-4"`,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.content).toContain("color: 'blue'");
    }
  });
});

describe('applyDiff: end-to-end refactoring pipeline', () => {
  it('should correctly apply a resize diff from refactor-client format', () => {
    const sourceContent = `export function Hero() {
  return (
    <section className="h-96 flex items-center justify-center bg-gradient-to-r from-blue-500 to-purple-600">
      <h1 className="text-5xl font-bold text-white">Welcome</h1>
    </section>
  );
}`;

    // This simulates what refactor-client.ts produces for a resize
    const diff = {
      file: 'src/components/Hero.tsx',
      original: 'className="h-96 flex items-center justify-center bg-gradient-to-r from-blue-500 to-purple-600"',
      modified: 'className="h-64 flex items-center justify-center bg-gradient-to-r from-blue-500 to-purple-600"',
    };

    const result = applyDiff(sourceContent, diff);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.content).toContain('h-64');
      expect(result.content).not.toContain('h-96');
      // JS structure preserved
      expect(result.content).toContain('export function Hero()');
      expect(result.content).toContain('text-5xl font-bold text-white');
    }
  });

  it('should correctly apply a move diff (mt change)', () => {
    const sourceContent = `<div className="mt-4 p-6 bg-white rounded-lg">Card content</div>`;

    const diff = {
      file: 'src/components/Card.tsx',
      original: 'className="mt-4 p-6 bg-white rounded-lg"',
      modified: 'className="mt-12 p-6 bg-white rounded-lg"',
    };

    const result = applyDiff(sourceContent, diff);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.content).toContain('mt-12');
      expect(result.content).not.toContain('mt-4');
      expect(result.content).toContain('Card content');
    }
  });

  it('should correctly apply a class addition diff', () => {
    const sourceContent = `<div className="flex p-4 bg-white">content</div>`;

    const diff = {
      file: 'src/components/Box.tsx',
      original: 'className="flex p-4 bg-white"',
      modified: 'className="flex p-4 bg-white h-[150px]"',
    };

    const result = applyDiff(sourceContent, diff);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.content).toContain('h-[150px]');
      expect(result.content).toContain('flex p-4 bg-white');
    }
  });
});
