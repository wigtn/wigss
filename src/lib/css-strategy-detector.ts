import path from 'path';
import type { DetectedComponent, CssStrategyInfo } from '@/types';

type SourceInput = { path: string; content: string };

// Tailwind utility prefixes that indicate Tailwind usage
const TW_PATTERNS = /(?:^|\s)(?:flex|grid|block|inline|hidden|p-|m-|w-|h-|text-|bg-|border-|rounded|shadow|gap-|space-|items-|justify-|overflow-|z-|opacity-|transition|animate-|font-|leading-|tracking-|absolute|relative|fixed|sticky)/;

export function isTailwindClassName(className: string): boolean {
  if (!className) return false;
  const classes = className.split(/\s+/);
  const twCount = classes.filter(c => TW_PATTERNS.test(c)).length;
  /** Minimum ratio of Tailwind utility classes to total classes for detection */
  const TAILWIND_DETECTION_THRESHOLD = 0.3;
  return twCount / classes.length >= TAILWIND_DETECTION_THRESHOLD;
}

export function findCssModuleImport(sourceContent: string): { binding: string; path: string } | null {
  const match = sourceContent.match(/import\s+(\w+)\s+from\s+['"]([^'"]+\.module\.(?:css|scss|sass))['"]/);
  if (match) return { binding: match[1], path: match[2] };
  return null;
}

/**
 * Extract linked stylesheet hrefs from an HTML document.
 * Matches `<link rel="stylesheet" href="...">` in any order of attributes.
 */
export function findLinkedStylesheets(htmlContent: string): string[] {
  const hrefs: string[] = [];
  const linkRegex = /<link\b[^>]*?>/gi;
  let match: RegExpExecArray | null;
  while ((match = linkRegex.exec(htmlContent))) {
    const tag = match[0];
    if (!/rel\s*=\s*["']stylesheet["']/i.test(tag)) continue;
    const hrefMatch = tag.match(/href\s*=\s*["']([^"']+)["']/i);
    if (hrefMatch) hrefs.push(hrefMatch[1]);
  }
  return hrefs;
}

export function detectCssStrategy(
  component: DetectedComponent,
  sources: SourceInput[],
): CssStrategyInfo {
  const fullClassName = component.fullClassName || '';
  const sourceFile = component.sourceFile || '';
  const isHtmlSource = sourceFile.endsWith('.html') || sourceFile.endsWith('.htm');

  // 0. HTML source: short-circuit to html-css strategy
  if (isHtmlSource) {
    const htmlSrc = sources.find((s) => s.path === sourceFile);
    let stylesheetPath: string | undefined;
    let cssClassName: string | undefined;
    const firstClass = fullClassName.split(/\s+/)[0];
    if (htmlSrc && firstClass) {
      const linked = findLinkedStylesheets(htmlSrc.content);
      for (const href of linked) {
        const match = sources.find(
          (s) => s.path === href || s.path.endsWith(`/${href}`) || s.path.endsWith(href),
        );
        if (match && match.content.includes(`.${firstClass}`)) {
          stylesheetPath = match.path;
          break;
        }
      }
      if (!stylesheetPath) {
        // Fall back to first stylesheet whose content mentions the class
        const candidate = sources.find(
          (s) =>
            (s.path.endsWith('.css') || s.path.endsWith('.scss')) &&
            s.content.includes(`.${firstClass}`),
        );
        if (candidate) stylesheetPath = candidate.path;
      }
      cssClassName = firstClass;
    }
    return {
      strategy: 'html-css',
      stylesheetPath,
      cssClassName,
    };
  }

  // 1. Check Tailwind: className="..." with Tailwind utilities in source
  if (fullClassName && isTailwindClassName(fullClassName)) {
    for (const src of sources) {
      if (src.content.includes(`className="${fullClassName}"`)) {
        return { strategy: 'tailwind' };
      }
    }
  }

  // 2. Check CSS Modules: className={styles.xxx}
  for (const src of sources) {
    if (!src.path.endsWith('.tsx') && !src.path.endsWith('.jsx') && !src.path.endsWith('.ts')) continue;
    const moduleImport = findCssModuleImport(src.content);
    if (!moduleImport) continue;

    // Find which CSS class this component maps to
    // Look for data-component or component name hints
    const compName = component.name.toLowerCase().replace(/\s+/g, '');
    const classNames = src.content.match(new RegExp(`${moduleImport.binding}\\.(\\w+)`, 'g')) || [];

    for (const match of classNames) {
      const cssClassName = match.replace(`${moduleImport.binding}.`, '');
      if (cssClassName.toLowerCase().includes(compName) || compName.includes(cssClassName.toLowerCase())) {
        // Resolve stylesheet path relative to the source file
        const srcDir = path.dirname(src.path);
        const stylesheetPath = path.join(srcDir, moduleImport.path);
        return {
          strategy: 'css-module',
          bindingName: moduleImport.binding,
          stylesheetPath,
          cssClassName,
        };
      }
    }

    // Fallback: if there's a module import, use the first class reference
    if (classNames.length > 0 && classNames[0]) {
      const cssClassName = classNames[0].replace(`${moduleImport.binding}.`, '');
      const srcDir = path.dirname(src.path);
      const stylesheetPath = path.join(srcDir, moduleImport.path);
      return {
        strategy: 'css-module',
        bindingName: moduleImport.binding,
        stylesheetPath,
        cssClassName,
      };
    }
  }

  // 3. Check plain CSS: short className that exists in a .css/.scss file
  if (fullClassName && !isTailwindClassName(fullClassName)) {
    const simpleClass = fullClassName.split(/\s+/)[0];
    for (const src of sources) {
      if (!src.path.endsWith('.css') && !src.path.endsWith('.scss')) continue;
      if (src.content.includes(`.${simpleClass}`)) {
        return {
          strategy: 'plain-css',
          stylesheetPath: src.path,
          cssClassName: simpleClass,
        };
      }
    }
  }

  // 4. Check inline style: look for style={{ in the source near this component
  for (const src of sources) {
    if (!src.path.endsWith('.tsx') && !src.path.endsWith('.jsx')) continue;
    if (fullClassName && src.content.includes(`className="${fullClassName}"`) && src.content.includes('style={{')) {
      return { strategy: 'inline-style' };
    }
  }

  // 5. Fallback: inline style (universal, works for any React component)
  return { strategy: 'inline-style' };
}
