import { describe, it, expect } from 'vitest';
import { findJsxAttributes, findClassNameAttribute, spliceString } from '../lib/ast-utils';

describe('ast-utils: findJsxAttributes', () => {
  it('should find single-line className="..."', () => {
    const source = `<div className="flex h-48 bg-white">content</div>`;
    const attrs = findJsxAttributes(source, 'className');
    expect(attrs).toHaveLength(1);
    expect(attrs[0].type).toBe('string-literal');
    expect(attrs[0].valueText).toBe('"flex h-48 bg-white"');
  });

  it('should find multi-line className', () => {
    const source = `<div
  className="flex h-48
    bg-white rounded-lg
    shadow-md"
>content</div>`;
    const attrs = findJsxAttributes(source, 'className');
    expect(attrs).toHaveLength(1);
    expect(attrs[0].valueText).toContain('flex h-48');
    expect(attrs[0].valueText).toContain('shadow-md');
  });

  it('should find template literal className', () => {
    const source = '<div className={`flex ${size} bg-white`}>content</div>';
    const attrs = findJsxAttributes(source, 'className');
    expect(attrs).toHaveLength(1);
    expect(attrs[0].type).toBe('template-literal');
  });

  it('should find expression className (e.g., styles.card)', () => {
    const source = `<div className={styles.card}>content</div>`;
    const attrs = findJsxAttributes(source, 'className');
    expect(attrs).toHaveLength(1);
    expect(attrs[0].type).toBe('expression');
    expect(attrs[0].valueText).toContain('styles.card');
  });

  it('should find style={{...}} attribute', () => {
    const source = `<div style={{ height: '200px', color: 'red' }}>content</div>`;
    const attrs = findJsxAttributes(source, 'style');
    expect(attrs).toHaveLength(1);
    expect(attrs[0].type).toBe('expression');
  });

  it('should find multi-line style attribute', () => {
    const source = `<div
  style={{
    height: '200px',
    width: '300px',
    color: 'red',
  }}
>content</div>`;
    const attrs = findJsxAttributes(source, 'style');
    expect(attrs).toHaveLength(1);
    expect(attrs[0].valueText).toContain("height: '200px'");
    expect(attrs[0].valueText).toContain("width: '300px'");
  });

  it('should find multiple className attributes in one file', () => {
    const source = `export function App() {
  return (
    <div className="container">
      <h1 className="title text-xl">Hello</h1>
      <p className="body text-sm">World</p>
    </div>
  );
}`;
    const attrs = findJsxAttributes(source, 'className');
    expect(attrs).toHaveLength(3);
  });

  it('should handle TypeScript generics without confusion', () => {
    const source = `<Component<Props> className="flex">content</Component>`;
    const attrs = findJsxAttributes(source, 'className');
    expect(attrs).toHaveLength(1);
    expect(attrs[0].valueText).toBe('"flex"');
  });

  it('should return empty for unparseable content', () => {
    const source = `this is not valid JSX at all {{{`;
    const attrs = findJsxAttributes(source, 'className');
    expect(attrs).toHaveLength(0);
  });
});

describe('ast-utils: findClassNameAttribute', () => {
  it('should find exact className match', () => {
    const source = `<div className="flex h-48 bg-white">x</div>`;
    const attr = findClassNameAttribute(source, 'flex h-48 bg-white');
    expect(attr).not.toBeNull();
    expect(attr!.type).toBe('string-literal');
  });

  it('should return null for non-matching className', () => {
    const source = `<div className="flex h-48">x</div>`;
    const attr = findClassNameAttribute(source, 'not-this-class');
    expect(attr).toBeNull();
  });

  it('should match className in multi-line JSX', () => {
    const source = `<section
  className="hero flex items-center"
  data-component="Hero"
>content</section>`;
    const attr = findClassNameAttribute(source, 'hero flex items-center');
    expect(attr).not.toBeNull();
  });
});

describe('ast-utils: spliceString', () => {
  it('should replace at exact positions', () => {
    const source = 'Hello, World!';
    const result = spliceString(source, 7, 12, 'Vitest');
    expect(result).toBe('Hello, Vitest!');
  });

  it('should handle shorter replacement', () => {
    const source = 'abcdef';
    const result = spliceString(source, 2, 5, 'X');
    expect(result).toBe('abXf');
  });

  it('should handle longer replacement', () => {
    const source = 'ab';
    const result = spliceString(source, 1, 1, 'XYZ');
    expect(result).toBe('aXYZb');
  });
});
