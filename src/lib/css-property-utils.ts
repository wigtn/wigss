import type { ComponentChange } from '@/types';

/**
 * Convert a ComponentChange to CSS property/value pairs.
 */
export function changeToCssProperties(change: ComponentChange): Record<string, string> {
  const props: Record<string, string> = {};

  if (change.type === 'resize') {
    const dh = (change.to.height ?? 0) - (change.from.height ?? 0);
    const dw = (change.to.width ?? 0) - (change.from.width ?? 0);
    if (Math.abs(dh) > 2 && change.to.height != null) {
      props['height'] = `${Math.round(change.to.height)}px`;
    }
    if (Math.abs(dw) > 2 && change.to.width != null) {
      props['width'] = `${Math.round(change.to.width)}px`;
    }
  }

  if (change.type === 'move') {
    const dy = (change.to.y ?? 0) - (change.from.y ?? 0);
    const dx = (change.to.x ?? 0) - (change.from.x ?? 0);
    if (Math.abs(dy) > 2) {
      props['marginTop'] = `${Math.round(dy)}px`;
    }
    if (Math.abs(dx) > 2) {
      props['marginLeft'] = `${Math.round(dx)}px`;
    }
  }

  return props;
}

/**
 * Convert a ComponentChange to CSS properties in kebab-case (for .css files).
 */
export function changeToCssKebab(change: ComponentChange): Record<string, string> {
  const props: Record<string, string> = {};

  if (change.type === 'resize') {
    const dh = (change.to.height ?? 0) - (change.from.height ?? 0);
    const dw = (change.to.width ?? 0) - (change.from.width ?? 0);
    if (Math.abs(dh) > 2 && change.to.height != null) {
      props['height'] = `${Math.round(change.to.height)}px`;
    }
    if (Math.abs(dw) > 2 && change.to.width != null) {
      props['width'] = `${Math.round(change.to.width)}px`;
    }
  }

  if (change.type === 'move') {
    const dy = (change.to.y ?? 0) - (change.from.y ?? 0);
    const dx = (change.to.x ?? 0) - (change.from.x ?? 0);
    if (Math.abs(dy) > 2) {
      props['margin-top'] = `${Math.round(dy)}px`;
    }
    if (Math.abs(dx) > 2) {
      props['margin-left'] = `${Math.round(dx)}px`;
    }
  }

  return props;
}

/**
 * Find a CSS rule block in stylesheet content.
 */
export function findCssRule(cssContent: string, selector: string): {
  startLine: number;
  endLine: number;
  ruleText: string;
  indent: string;
} | null {
  const lines = cssContent.split('\n');
  const selectorPattern = new RegExp(`^(\\s*)\\.${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{`);

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(selectorPattern);
    if (match) {
      const indent = match[1] || '';
      let braceCount = 0;
      let endLine = i;

      for (let j = i; j < lines.length; j++) {
        for (const ch of lines[j]) {
          if (ch === '{') braceCount++;
          if (ch === '}') braceCount--;
        }
        if (braceCount === 0) {
          endLine = j;
          break;
        }
      }

      const ruleText = lines.slice(i, endLine + 1).join('\n');
      return { startLine: i + 1, endLine: endLine + 1, ruleText, indent };
    }
  }

  return null;
}

/**
 * Modify or add CSS properties within a rule block.
 */
export function modifyCssRule(ruleText: string, properties: Record<string, string>): string {
  let modified = ruleText;

  for (const [prop, value] of Object.entries(properties)) {
    const propRegex = new RegExp(`(${prop}\\s*:\\s*)([^;]+)(;)`);
    if (propRegex.test(modified)) {
      modified = modified.replace(propRegex, `$1${value}$3`);
    } else {
      // Add property before closing brace
      const closingIndex = modified.lastIndexOf('}');
      if (closingIndex !== -1) {
        const indent = modified.match(/^(\s*)/)?.[1] || '';
        const propLine = `${indent}  ${prop}: ${value};\n`;
        modified = modified.slice(0, closingIndex) + propLine + modified.slice(closingIndex);
      }
    }
  }

  return modified;
}
