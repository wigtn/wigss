import { describe, it, expect } from 'vitest';
import { findCssRuleAst, modifyCssRuleAst } from '../lib/postcss-utils';

describe('postcss-utils: findCssRuleAst', () => {
  it('should find a simple .card rule', () => {
    const css = `.card {\n  height: 200px;\n  background: white;\n}`;
    const rule = findCssRuleAst(css, 'card');
    expect(rule).not.toBeNull();
    expect(rule!.ruleText).toContain('height: 200px');
    expect(rule!.startLine).toBe(1);
  });

  it('should find rule inside media query', () => {
    const css = `@media (max-width: 768px) {\n  .card {\n    height: 150px;\n  }\n}`;
    const rule = findCssRuleAst(css, 'card');
    expect(rule).not.toBeNull();
    expect(rule!.ruleText).toContain('height: 150px');
  });

  it('should return null for missing rule', () => {
    const css = `.other { color: red; }`;
    expect(findCssRuleAst(css, 'card')).toBeNull();
  });

  it('should match compound selectors containing the class', () => {
    const css = `.card:hover {\n  opacity: 0.8;\n}`;
    const rule = findCssRuleAst(css, 'card');
    expect(rule).not.toBeNull();
    expect(rule!.ruleText).toContain('opacity: 0.8');
  });

  it('should match class in multi-class selector', () => {
    const css = `.card.active {\n  border: 1px solid blue;\n}`;
    const rule = findCssRuleAst(css, 'card');
    expect(rule).not.toBeNull();
    expect(rule!.ruleText).toContain('border: 1px solid blue');
  });

  it('should NOT match class as prefix of another class', () => {
    const css = `.card-wrapper {\n  padding: 10px;\n}`;
    expect(findCssRuleAst(css, 'card')).toBeNull();
  });
});

describe('postcss-utils: modifyCssRuleAst', () => {
  it('should replace existing property', () => {
    const css = `.card {\n  height: 200px;\n  background: white;\n}`;
    const result = modifyCssRuleAst(css, 'card', { height: '300px' });
    expect(result).not.toBeNull();
    expect(result!.ruleModified).toContain('height: 300px');
    expect(result!.ruleModified).not.toContain('height: 200px');
    expect(result!.ruleModified).toContain('background: white');
  });

  it('should add new property', () => {
    const css = `.box {\n  background: gray;\n}`;
    const result = modifyCssRuleAst(css, 'box', { width: '400px' });
    expect(result).not.toBeNull();
    expect(result!.ruleModified).toContain('width: 400px');
    expect(result!.ruleModified).toContain('background: gray');
  });

  it('should modify rule inside media query', () => {
    const css = `@media (max-width: 768px) {\n  .card {\n    height: 150px;\n  }\n}`;
    const result = modifyCssRuleAst(css, 'card', { height: '200px' });
    expect(result).not.toBeNull();
    expect(result!.ruleModified).toContain('height: 200px');
  });

  it('should return null when rule not found', () => {
    const css = `.other { color: red; }`;
    expect(modifyCssRuleAst(css, 'card', { height: '100px' })).toBeNull();
  });

  it('should return null when no actual change', () => {
    const css = `.card {\n  height: 200px;\n}`;
    expect(modifyCssRuleAst(css, 'card', { height: '200px' })).toBeNull();
  });

  it('should handle multiple properties at once', () => {
    const css = `.hero {\n  height: 400px;\n  width: 100%;\n}`;
    const result = modifyCssRuleAst(css, 'hero', { height: '300px', width: '80%' });
    expect(result).not.toBeNull();
    expect(result!.ruleModified).toContain('height: 300px');
    expect(result!.ruleModified).toContain('width: 80%');
  });
});
