import { describe, it, expect } from 'vitest';
import { generateRefactorDiffs } from '../lib/agent/refactor-client';
import { detectCssStrategy } from '../lib/css-strategy-detector';
import type { ComponentChange, DetectedComponent } from '../types';

/**
 * E2E Pipeline Tests: simulate the full Save flow
 * change → detectCssStrategy → generateRefactorDiffs → verify diff can be applied
 */

function applyDiff(content: string, original: string, modified: string): string | null {
  const idx = content.indexOf(original);
  if (idx === -1) return null;
  return content.slice(0, idx) + modified + content.slice(idx + original.length);
}

describe('E2E: Tailwind project (like demo-target)', () => {
  const navbarSource = {
    path: 'src/components/Navbar.tsx',
    content: `export function Navbar() {
  return (
    <nav className="flex items-center justify-between px-6 py-4 bg-white shadow-md">
      <span className="text-xl font-bold text-blue-600">Brand</span>
      <div className="flex gap-6">
        <a className="text-gray-600 hover:text-blue-600">Home</a>
        <a className="text-gray-600 hover:text-blue-600">About</a>
      </div>
    </nav>
  );
}`,
  };

  it('resize navbar height: py-4 → py-8', async () => {
    const comp: DetectedComponent = {
      id: 'nav-1', name: 'Navbar', type: 'navbar', elementIds: ['nav-1'],
      boundingBox: { x: 0, y: 0, width: 1200, height: 64 },
      sourceFile: '', reasoning: '',
      fullClassName: 'flex items-center justify-between px-6 py-4 bg-white shadow-md',
    } as any;
    const change: ComponentChange = {
      componentId: 'nav-1', type: 'resize',
      from: { width: 1200, height: 64 }, to: { width: 1200, height: 96 },
    };

    const diffs = await generateRefactorDiffs({
      changes: [change], components: [comp], sources: [navbarSource],
    });

    expect(diffs).toHaveLength(1);
    expect(diffs[0].modified).toContain('py-');
    // Verify diff can be applied to source
    const result = applyDiff(navbarSource.content, diffs[0].original, diffs[0].modified);
    expect(result).not.toBeNull();
    expect(result).not.toContain('py-4'); // old value gone
    // Rest of file intact
    expect(result).toContain('export function Navbar()');
    expect(result).toContain('text-xl font-bold');
  });

  it('move navbar down', async () => {
    const comp: DetectedComponent = {
      id: 'nav-1', name: 'Navbar', type: 'navbar', elementIds: ['nav-1'],
      boundingBox: { x: 0, y: 0, width: 1200, height: 64 },
      sourceFile: '', reasoning: '',
      fullClassName: 'flex items-center justify-between px-6 py-4 bg-white shadow-md',
    } as any;
    const change: ComponentChange = {
      componentId: 'nav-1', type: 'move',
      from: { x: 0, y: 0 }, to: { x: 0, y: 20 },
    };

    const diffs = await generateRefactorDiffs({
      changes: [change], components: [comp], sources: [navbarSource],
    });

    expect(diffs).toHaveLength(1);
    // Should add mt class since no mt exists
    expect(diffs[0].modified).toContain('mt-');
  });
});

describe('E2E: CSS Modules project', () => {
  const cardTsx = {
    path: 'src/components/Card.tsx',
    content: `import styles from './Card.module.css';

export function Card({ title, body }: { title: string; body: string }) {
  return (
    <div className={styles.card}>
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.body}>{body}</p>
    </div>
  );
}`,
  };
  const cardCss = {
    path: 'src/components/Card.module.css',
    content: `.card {
  height: 280px;
  padding: 24px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 8px;
}

.body {
  font-size: 14px;
  color: #666;
}`,
  };

  it('auto-detect CSS Module strategy', () => {
    const comp: DetectedComponent = {
      id: 'card-1', name: 'card', type: 'card', elementIds: ['card-1'],
      boundingBox: { x: 0, y: 0, width: 300, height: 280 },
      sourceFile: '', reasoning: '', fullClassName: '',
    } as any;
    const info = detectCssStrategy(comp, [cardTsx, cardCss]);
    expect(info.strategy).toBe('css-module');
    expect(info.cssClassName).toBe('card');
    expect(info.stylesheetPath).toContain('Card.module.css');
  });

  it('resize card height: modify .module.css', async () => {
    const comp: DetectedComponent = {
      id: 'card-1', name: 'Card', type: 'card', elementIds: ['card-1'],
      boundingBox: { x: 0, y: 0, width: 300, height: 280 },
      sourceFile: '', reasoning: '', fullClassName: '',
      cssInfo: { strategy: 'css-module', cssClassName: 'card', stylesheetPath: 'src/components/Card.module.css' },
    } as any;
    const change: ComponentChange = {
      componentId: 'card-1', type: 'resize',
      from: { width: 300, height: 280 }, to: { width: 300, height: 350 },
    };

    const diffs = await generateRefactorDiffs({
      changes: [change], components: [comp], sources: [cardTsx, cardCss],
    });

    expect(diffs).toHaveLength(1);
    expect(diffs[0].file).toBe('src/components/Card.module.css');
    expect(diffs[0].modified).toContain('height: 350px');
    expect(diffs[0].modified).not.toContain('height: 280px');
    // Verify diff applies cleanly
    const result = applyDiff(cardCss.content, diffs[0].original, diffs[0].modified);
    expect(result).not.toBeNull();
    expect(result).toContain('height: 350px');
    // Other rules untouched
    expect(result).toContain('.title');
    expect(result).toContain('.body');
  });
});

describe('E2E: Plain CSS project', () => {
  const heroTsx = {
    path: 'src/pages/Home.tsx',
    content: `export function Home() {
  return (
    <div className="home-page">
      <section className="hero-banner">
        <h1>Welcome to our site</h1>
        <p>Build something amazing</p>
      </section>
      <div className="features-grid">
        <div className="feature-card">Feature 1</div>
        <div className="feature-card">Feature 2</div>
      </div>
    </div>
  );
}`,
  };
  const globalCss = {
    path: 'src/styles/global.css',
    content: `.hero-banner {
  height: 500px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
  padding: 48px;
}

.feature-card {
  height: 200px;
  padding: 24px;
  background: white;
  border-radius: 8px;
}`,
  };

  it('auto-detect plain CSS strategy for hero', () => {
    const comp: DetectedComponent = {
      id: 'hero-1', name: 'Hero', type: 'hero', elementIds: ['hero-1'],
      boundingBox: { x: 0, y: 0, width: 1200, height: 500 },
      sourceFile: '', reasoning: '', fullClassName: 'hero-banner',
    } as any;
    const info = detectCssStrategy(comp, [heroTsx, globalCss]);
    expect(info.strategy).toBe('plain-css');
    expect(info.cssClassName).toBe('hero-banner');
  });

  it('resize hero banner: modify global.css', async () => {
    const comp: DetectedComponent = {
      id: 'hero-1', name: 'Hero', type: 'hero', elementIds: ['hero-1'],
      boundingBox: { x: 0, y: 0, width: 1200, height: 500 },
      sourceFile: '', reasoning: '', fullClassName: 'hero-banner',
      cssInfo: { strategy: 'plain-css', cssClassName: 'hero-banner', stylesheetPath: 'src/styles/global.css' },
    } as any;
    const change: ComponentChange = {
      componentId: 'hero-1', type: 'resize',
      from: { width: 1200, height: 500 }, to: { width: 1200, height: 400 },
    };

    const diffs = await generateRefactorDiffs({
      changes: [change], components: [comp], sources: [heroTsx, globalCss],
    });

    expect(diffs).toHaveLength(1);
    expect(diffs[0].file).toBe('src/styles/global.css');
    expect(diffs[0].modified).toContain('height: 400px');
    // Verify clean application
    const result = applyDiff(globalCss.content, diffs[0].original, diffs[0].modified);
    expect(result).not.toBeNull();
    expect(result).toContain('height: 400px');
    // Other rules intact
    expect(result).toContain('.features-grid');
    expect(result).toContain('.feature-card');
  });

  it('resize feature-card height: modify correct rule', async () => {
    const comp: DetectedComponent = {
      id: 'fc-1', name: 'FeatureCard', type: 'card', elementIds: ['fc-1'],
      boundingBox: { x: 48, y: 548, width: 364, height: 200 },
      sourceFile: '', reasoning: '', fullClassName: 'feature-card',
      cssInfo: { strategy: 'plain-css', cssClassName: 'feature-card', stylesheetPath: 'src/styles/global.css' },
    } as any;
    const change: ComponentChange = {
      componentId: 'fc-1', type: 'resize',
      from: { width: 364, height: 200 }, to: { width: 364, height: 250 },
    };

    const diffs = await generateRefactorDiffs({
      changes: [change], components: [comp], sources: [heroTsx, globalCss],
    });

    expect(diffs).toHaveLength(1);
    expect(diffs[0].modified).toContain('height: 250px');
    // Must modify .feature-card, not .hero-banner
    const result = applyDiff(globalCss.content, diffs[0].original, diffs[0].modified);
    expect(result).not.toBeNull();
    // hero-banner should still have 500px
    expect(result).toContain('height: 500px');
  });
});

describe('E2E: Mixed strategy project', () => {
  it('should handle multiple components with different strategies', async () => {
    const sources = [
      { path: 'src/App.tsx', content: `<div className="flex h-48 bg-white">tailwind</div>\n<div className="legacy-box">legacy</div>` },
      { path: 'src/app.css', content: `.legacy-box {\n  height: 200px;\n  border: 1px solid;\n}` },
    ];

    const twComp: DetectedComponent = {
      id: 'tw-1', name: 'TW', type: 'section', elementIds: ['tw-1'],
      boundingBox: { x: 0, y: 0, width: 200, height: 192 },
      sourceFile: '', reasoning: '',
      fullClassName: 'flex h-48 bg-white',
    } as any;

    const cssComp: DetectedComponent = {
      id: 'css-1', name: 'Legacy', type: 'section', elementIds: ['css-1'],
      boundingBox: { x: 0, y: 200, width: 200, height: 200 },
      sourceFile: '', reasoning: '', fullClassName: 'legacy-box',
      cssInfo: { strategy: 'plain-css', cssClassName: 'legacy-box', stylesheetPath: 'src/app.css' },
    } as any;

    const diffs = await generateRefactorDiffs({
      changes: [
        { componentId: 'tw-1', type: 'resize', from: { width: 200, height: 192 }, to: { width: 200, height: 256 } },
        { componentId: 'css-1', type: 'resize', from: { width: 200, height: 200 }, to: { width: 200, height: 300 } },
      ],
      components: [twComp, cssComp],
      sources,
    });

    expect(diffs).toHaveLength(2);
    // One Tailwind diff targeting .tsx
    const twDiff = diffs.find(d => d.file.endsWith('.tsx'));
    expect(twDiff).toBeDefined();
    expect(twDiff!.modified).toContain('h-64');
    // One CSS diff targeting .css
    const cssDiff = diffs.find(d => d.file.endsWith('.css'));
    expect(cssDiff).toBeDefined();
    expect(cssDiff!.modified).toContain('height: 300px');
  });
});
