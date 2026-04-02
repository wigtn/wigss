import postcss from 'postcss';
import { BREAKPOINTS, type BreakpointName } from '@/lib/breakpoint-utils';

export interface CssRuleMatch {
  startLine: number;
  endLine: number;
  ruleText: string;
}

/**
 * Find a CSS rule by class selector using postcss AST.
 */
export function findCssRuleAst(cssContent: string, selector: string): CssRuleMatch | null {
  let root;
  try {
    root = postcss.parse(cssContent);
  } catch {
    return null;
  }

  let match: CssRuleMatch | null = null;
  root.walkRules((rule) => {
    if (match) return;
    if (rule.selector === `.${selector}`) {
      match = {
        startLine: rule.source?.start?.line ?? 0,
        endLine: rule.source?.end?.line ?? 0,
        ruleText: rule.toString(),
      };
    }
  });

  return match;
}

/**
 * Modify CSS declarations in a rule, return the original and modified rule text.
 * Uses postcss for precise parsing — handles nested selectors, media queries, comments.
 */
export function modifyCssRuleAst(
  cssContent: string,
  selector: string,
  properties: Record<string, string>,
): { modified: string; ruleOriginal: string; ruleModified: string } | null {
  let root;
  try {
    root = postcss.parse(cssContent);
  } catch {
    return null;
  }

  let targetRule: postcss.Rule | null = null;
  root.walkRules((rule) => {
    if (targetRule) return;
    if (rule.selector === `.${selector}`) {
      targetRule = rule;
    }
  });

  if (!targetRule) return null;

  const ruleOriginal = (targetRule as postcss.Rule).toString();

  // Modify declarations
  for (const [prop, value] of Object.entries(properties)) {
    let found = false;
    (targetRule as postcss.Rule).walkDecls(prop, (decl) => {
      decl.value = value;
      found = true;
    });
    if (!found) {
      (targetRule as postcss.Rule).append(postcss.decl({ prop, value }));
    }
  }

  const ruleModified = (targetRule as postcss.Rule).toString();

  if (ruleOriginal === ruleModified) return null;

  return {
    modified: root.toString(),
    ruleOriginal,
    ruleModified,
  };
}

/**
 * Find or create a @media rule for a given breakpoint and selector, then modify properties.
 *
 * Three cases:
 *   A: Existing @media + existing rule → modify properties
 *   B: Existing @media + no rule → add rule inside @media
 *   C: No @media → create @media block with rule
 *
 * Returns the original and modified full CSS content as snippets for applyDiff.
 */
export function findOrCreateMediaRule(
  cssContent: string,
  selector: string,
  breakpoint: BreakpointName,
  properties: Record<string, string>,
): { original: string; modified: string } | null {
  let root;
  try {
    root = postcss.parse(cssContent);
  } catch {
    return null;
  }

  const minWidth = BREAKPOINTS[breakpoint];
  const mediaQuery = `(min-width: ${minWidth}px)`;

  // Find existing @media rule matching this breakpoint
  let targetAtRule: postcss.AtRule | null = null;
  root.walkAtRules('media', (atRule) => {
    if (targetAtRule) return;
    // Normalize whitespace for comparison
    const normalized = atRule.params.replace(/\s+/g, ' ').trim();
    if (normalized === mediaQuery) {
      targetAtRule = atRule;
    }
  });

  if (targetAtRule) {
    // Case A or B: @media exists
    const atRule = targetAtRule as postcss.AtRule;
    let existingRule: postcss.Rule | null = null;
    atRule.walkRules((rule) => {
      if (existingRule) return;
      if (rule.selector === `.${selector}`) {
        existingRule = rule;
      }
    });

    if (existingRule) {
      // Case A: both @media and rule exist → modify properties
      const originalBlock = atRule.toString();

      for (const [prop, value] of Object.entries(properties)) {
        let found = false;
        (existingRule as postcss.Rule).walkDecls(prop, (decl) => {
          decl.value = value;
          found = true;
        });
        if (!found) {
          (existingRule as postcss.Rule).append(postcss.decl({ prop, value }));
        }
      }

      const modifiedBlock = atRule.toString();
      if (originalBlock === modifiedBlock) return null;

      return { original: originalBlock, modified: modifiedBlock };
    } else {
      // Case B: @media exists but rule doesn't → add rule inside
      const originalBlock = atRule.toString();

      const newRule = postcss.rule({ selector: `.${selector}` });
      for (const [prop, value] of Object.entries(properties)) {
        newRule.append(postcss.decl({ prop, value }));
      }
      atRule.append(newRule);

      const modifiedBlock = atRule.toString();
      return { original: originalBlock, modified: modifiedBlock };
    }
  }

  // Case C: no @media → create entire block
  // We'll append after the last rule in the file
  const propsStr = Object.entries(properties)
    .map(([prop, value]) => `  .${selector} {\n    ${prop}: ${value};\n  }`)
    .join('\n');

  // Find anchor: the last line of the file content
  const trimmed = cssContent.trimEnd();
  const lastLine = trimmed.slice(trimmed.lastIndexOf('\n') + 1);
  const original = lastLine;
  const newMediaBlock = `\n\n@media ${mediaQuery} {\n${propsStr}\n}`;
  const modified = lastLine + newMediaBlock;

  return { original, modified };
}
