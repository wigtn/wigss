import { describe, it, expect } from 'vitest';
import { detectCssStrategy, isTailwindClassName, findCssModuleImport } from '../lib/css-strategy-detector';
import type { DetectedComponent } from '../types';

function comp(name: string, cls: string): DetectedComponent {
  return { id: 'c1', name, type: 'section', elementIds: ['c1'], boundingBox: { x: 0, y: 0, width: 200, height: 100 }, sourceFile: '', reasoning: '', fullClassName: cls } as any;
}

describe('isTailwindClassName', () => {
  it('pure Tailwind classes', () => {
    expect(isTailwindClassName('flex items-center justify-between px-6 py-4 bg-white')).toBe(true);
  });
  it('mixed Tailwind + custom', () => {
    expect(isTailwindClassName('flex my-custom-class bg-white')).toBe(true); // 2/3 Tailwind
  });
  it('pure custom classes', () => {
    expect(isTailwindClassName('hero-banner main-content sidebar-nav')).toBe(false);
  });
  it('single Tailwind class', () => {
    expect(isTailwindClassName('flex')).toBe(true);
  });
  it('single custom class', () => {
    expect(isTailwindClassName('hero')).toBe(false);
  });
  it('empty string', () => {
    expect(isTailwindClassName('')).toBe(false);
  });
  it('Tailwind with responsive prefixes (below threshold)', () => {
    // sm:hidden etc. have prefixes that don't match base patterns
    // Only 'flex' matches → 1/4 = 25% < 30% threshold → false
    expect(isTailwindClassName('flex sm:hidden md:flex lg:grid')).toBe(false);
    // But with more base classes, it passes
    expect(isTailwindClassName('flex items-center bg-white sm:hidden md:flex')).toBe(true);
  });
  it('Tailwind with arbitrary values', () => {
    expect(isTailwindClassName('w-[300px] h-[200px] bg-white')).toBe(true);
  });
});

describe('findCssModuleImport', () => {
  it('standard import', () => {
    const r = findCssModuleImport(`import styles from './Card.module.css';`);
    expect(r).toEqual({ binding: 'styles', path: './Card.module.css' });
  });
  it('double quotes', () => {
    const r = findCssModuleImport(`import s from "./App.module.scss";`);
    expect(r).toEqual({ binding: 's', path: './App.module.scss' });
  });
  it('no module import', () => {
    expect(findCssModuleImport(`import React from 'react';`)).toBeNull();
  });
  it('regular CSS import (not module)', () => {
    expect(findCssModuleImport(`import './globals.css';`)).toBeNull();
  });
  it('module.sass extension', () => {
    const r = findCssModuleImport(`import classes from '../styles/Button.module.sass';`);
    expect(r).toEqual({ binding: 'classes', path: '../styles/Button.module.sass' });
  });
});

describe('detectCssStrategy: comprehensive', () => {
  it('Tailwind: className in source matches', () => {
    const info = detectCssStrategy(comp('Card', 'flex h-48 bg-white'), [
      { path: 'Card.tsx', content: '<div className="flex h-48 bg-white">x</div>' },
    ]);
    expect(info.strategy).toBe('tailwind');
  });

  it('Tailwind: className not in any source → fallback to inline-style', () => {
    const info = detectCssStrategy(comp('Card', 'flex h-48 bg-white'), [
      { path: 'Other.tsx', content: '<div>no match</div>' },
    ]);
    expect(info.strategy).toBe('inline-style');
  });

  it('CSS Module: import found + class usage', () => {
    const info = detectCssStrategy(comp('card', ''), [
      { path: 'src/Card.tsx', content: `import styles from './Card.module.css';\n<div className={styles.card}>x</div>` },
    ]);
    expect(info.strategy).toBe('css-module');
  });

  it('CSS Module: import found but class name does not match component', () => {
    // Should still detect as css-module with fallback to first class
    const info = detectCssStrategy(comp('unrelated', ''), [
      { path: 'src/Card.tsx', content: `import styles from './Card.module.css';\n<div className={styles.wrapper}>x</div>` },
    ]);
    expect(info.strategy).toBe('css-module');
    expect(info.cssClassName).toBe('wrapper');
  });

  it('Plain CSS: non-Tailwind className found in .css file', () => {
    const info = detectCssStrategy(comp('Hero', 'hero-section'), [
      { path: 'src/Hero.tsx', content: '<div className="hero-section">x</div>' },
      { path: 'src/global.css', content: '.hero-section { height: 400px; }' },
    ]);
    expect(info.strategy).toBe('plain-css');
  });

  it('Inline style: no className match at all', () => {
    const info = detectCssStrategy(comp('Widget', ''), [
      { path: 'src/Widget.tsx', content: '<div>no class</div>' },
    ]);
    expect(info.strategy).toBe('inline-style');
  });

  it('Inline style: className exists but is dynamic expression', () => {
    // className={computedClass} — not static string
    const info = detectCssStrategy(comp('Dynamic', ''), [
      { path: 'src/Dynamic.tsx', content: '<div className={computedClass}>x</div>' },
    ]);
    expect(info.strategy).toBe('inline-style');
  });

  it('priority: Tailwind > CSS Module (if both match)', () => {
    const info = detectCssStrategy(comp('Card', 'flex bg-white rounded'), [
      { path: 'src/Card.tsx', content: `import styles from './Card.module.css';\n<div className="flex bg-white rounded">x</div>` },
      { path: 'src/Card.module.css', content: '.card { }' },
    ]);
    // Tailwind check comes first
    expect(info.strategy).toBe('tailwind');
  });

  it('multiple source files: finds the right one', () => {
    const info = detectCssStrategy(comp('Card', 'card-wrapper'), [
      { path: 'src/Hero.tsx', content: '<div className="hero">x</div>' },
      { path: 'src/Card.tsx', content: '<div className="card-wrapper">x</div>' },
      { path: 'src/styles.css', content: '.card-wrapper { height: 200px; }' },
    ]);
    expect(info.strategy).toBe('plain-css');
    expect(info.cssClassName).toBe('card-wrapper');
  });

  it('CSS Module: resolves ../ relative import path (N1 regression)', () => {
    const info = detectCssStrategy(comp('card', ''), [
      { path: 'src/components/Card.tsx', content: `import styles from '../styles/Card.module.css';\n<div className={styles.card}>x</div>` },
      { path: 'src/styles/Card.module.css', content: '.card { height: 200px; }' },
    ]);
    expect(info.strategy).toBe('css-module');
    expect(info.stylesheetPath).toBe('src/styles/Card.module.css');
  });
});
