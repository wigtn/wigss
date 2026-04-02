import postcss from 'postcss';

export interface CssRuleMatch {
  startLine: number;
  endLine: number;
  ruleText: string;
}

/**
 * Check if a CSS selector targets the given class name.
 * Matches `.card` in `.card`, `.card.active`, `.card:hover`, `.card > .inner`
 * but NOT `.card-wrapper` or `.my-card`.
 */
function selectorMatchesClass(ruleSelector: string, className: string): boolean {
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\.${escaped}(?=[.:#\\s,>+~\\[)]|$)`).test(ruleSelector);
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
    if (selectorMatchesClass(rule.selector, selector)) {
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
    if (selectorMatchesClass(rule.selector, selector)) {
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
