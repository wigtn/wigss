/**
 * Pure software component detector — no AI dependency.
 * Takes raw DOM scan results (with CSS layout properties) and produces
 * accurate DetectedComponent[] using structural analysis.
 *
 * Algorithm phases:
 *   1. Semantic boundary detection (nav, header, main, section, footer, form)
 *   2. Layout container analysis (flex/grid parents → meaningful groups)
 *   3. Repeated sibling detection (cards, list items)
 *   4. Component naming & type inference
 *   5. Source file mapping via data-component
 */

import type { ComponentType, DetectedComponent } from '@/types';

// ── Raw element from iframe scan ──
export interface RawScanElement {
  id: string;
  tagName: string;
  className: string;
  boundingBox: { x: number; y: number; width: number; height: number };
  visible: boolean;
  attributes: Record<string, string>;
  textContent: string;
  depth: number;
  childCount?: number;
  parentId?: string;
  computedStyle?: {
    display: string;
    position: string;
    flexDirection: string;
    gridTemplateColumns?: string;
    gap?: string;
    justifyContent?: string;
    alignItems?: string;
  };
}

// ── Semantic tag → ComponentType mapping ──
const SEMANTIC_MAP: Record<string, ComponentType> = {
  nav: 'navbar',
  header: 'header',
  footer: 'footer',
  form: 'form',
  aside: 'sidebar',
  main: 'section',
  article: 'section',
};

// ── Class/attribute patterns → ComponentType ──
const CLASS_PATTERNS: [RegExp, ComponentType][] = [
  [/\b(nav|navbar|navigation)\b/i, 'navbar'],
  [/\b(header|masthead|topbar|app-bar)\b/i, 'header'],
  [/\b(hero|banner|jumbotron)\b/i, 'hero'],
  [/\b(footer|foot)\b/i, 'footer'],
  [/\b(sidebar|side-bar|aside|drawer)\b/i, 'sidebar'],
  [/\b(card|tile|panel)\b/i, 'card'],
  [/\b(grid|gallery|cards-grid|card-grid)\b/i, 'grid'],
  [/\b(form|login|signup|register|search-form)\b/i, 'form'],
  [/\b(modal|dialog|popup|overlay)\b/i, 'modal'],
];

// ── Detect if element is a layout container ──
function isLayoutContainer(el: RawScanElement): 'flex' | 'grid' | null {
  const cs = el.computedStyle;
  if (!cs) return null;
  if (cs.display === 'grid' || cs.display === 'inline-grid') return 'grid';
  if (cs.display === 'flex' || cs.display === 'inline-flex') return 'flex';
  return null;
}

// ── Check if siblings have similar structure (same tag, similar size) ──
function areSimilarSiblings(elements: RawScanElement[], tolerance = 0.3): boolean {
  if (elements.length < 2) return false;
  const tags = new Set(elements.map(e => e.tagName));
  if (tags.size > 1) return false; // Different tags = not similar

  const widths = elements.map(e => e.boundingBox.width);
  const heights = elements.map(e => e.boundingBox.height);
  const avgW = widths.reduce((a, b) => a + b, 0) / widths.length;
  const avgH = heights.reduce((a, b) => a + b, 0) / heights.length;

  // All widths/heights within tolerance of average
  return widths.every(w => Math.abs(w - avgW) / Math.max(avgW, 1) < tolerance)
    && heights.every(h => Math.abs(h - avgH) / Math.max(avgH, 1) < tolerance);
}

// ── Infer component type from element ──
function inferType(el: RawScanElement): ComponentType {
  // 1. data-component attribute
  const dataComp = el.attributes['data-component'] || '';
  if (dataComp) {
    const mapped = Object.entries(SEMANTIC_MAP).find(([k]) => dataComp.includes(k));
    if (mapped) return mapped[1];
    for (const [pattern, type] of CLASS_PATTERNS) {
      if (pattern.test(dataComp)) return type;
    }
  }

  // 2. Semantic HTML tag
  const semantic = SEMANTIC_MAP[el.tagName];
  if (semantic) return semantic;

  // 3. Class name patterns
  const cls = typeof el.className === 'string' ? el.className : '';
  for (const [pattern, type] of CLASS_PATTERNS) {
    if (pattern.test(cls)) return type;
  }

  // 4. Role attribute
  const role = el.attributes['role'] || '';
  if (role === 'navigation') return 'navbar';
  if (role === 'banner') return 'header';
  if (role === 'contentinfo') return 'footer';
  if (role === 'dialog') return 'modal';
  if (role === 'form') return 'form';
  if (role === 'complementary') return 'sidebar';

  // 5. Layout-based inference
  const layout = isLayoutContainer(el);
  if (layout === 'grid') return 'grid';

  // 6. Position-based heuristic
  if (el.boundingBox.y < 100 && el.boundingBox.width > 600) return 'header';
  if (el.boundingBox.height > 300 && el.depth === 0) return 'hero';

  return 'section';
}

// ── Generate readable name ──
function generateName(el: RawScanElement, type: ComponentType, index: number): string {
  // Prefer data-component
  const dataComp = el.attributes['data-component'] || '';
  if (dataComp) {
    return dataComp.charAt(0).toUpperCase() + dataComp.slice(1);
  }

  // Use text content if short enough
  const text = el.textContent.trim();
  if (text && text.length <= 30 && text.length > 0) {
    const label = text.split('\n')[0].trim();
    if (label.length <= 25) return label;
  }

  // Use tag + type
  const typeNames: Record<ComponentType, string> = {
    navbar: 'Navigation',
    header: 'Header',
    hero: 'Hero Section',
    grid: 'Grid Layout',
    card: 'Card',
    sidebar: 'Sidebar',
    footer: 'Footer',
    section: 'Section',
    form: 'Form',
    modal: 'Modal',
  };

  return `${typeNames[type]} ${index + 1}`;
}

// ── Infer source file from data-component attribute ──
function inferSourceFile(el: RawScanElement): string {
  const dataComp = el.attributes['data-component'] || '';
  if (dataComp) {
    const name = dataComp.charAt(0).toUpperCase() + dataComp.slice(1);
    return `src/components/${name}.tsx`;
  }
  return '';
}

// ── Main detector ──
export function detectComponents(rawElements: RawScanElement[]): DetectedComponent[] {
  const components: DetectedComponent[] = [];
  const usedElementIds = new Set<string>();

  // Build parent→children index for grouping
  const childrenOf = new Map<string, RawScanElement[]>();
  for (const el of rawElements) {
    if (el.parentId) {
      const siblings = childrenOf.get(el.parentId) || [];
      siblings.push(el);
      childrenOf.set(el.parentId, siblings);
    }
  }

  // Phase 1: Find top-level semantic/data-component boundaries
  const topLevel = rawElements.filter(el => {
    // data-component is the strongest signal
    if (el.attributes['data-component']) return true;
    // Semantic HTML at low depth
    if (SEMANTIC_MAP[el.tagName] && el.depth <= 2) return true;
    // Role attributes
    if (el.attributes['role'] && el.depth <= 2) return true;
    return false;
  });

  for (const el of topLevel) {
    if (usedElementIds.has(el.id)) continue;
    usedElementIds.add(el.id);

    const type = inferType(el);
    const name = generateName(el, type, components.length);

    components.push({
      id: `comp-${components.length}-${el.id || el.tagName}`,
      name,
      type,
      elementIds: [el.id],
      boundingBox: { ...el.boundingBox },
      sourceFile: inferSourceFile(el),
      reasoning: `data-component="${el.attributes['data-component'] || ''}" tag=${el.tagName}`,
      depth: el.depth,
      fullClassName: typeof el.className === 'string' ? el.className : '',
    });
  }

  // Phase 2: Find layout containers (flex/grid parents) not yet detected
  const layoutContainers = rawElements.filter(el => {
    if (usedElementIds.has(el.id)) return false;
    const layout = isLayoutContainer(el);
    if (!layout) return false;
    // Must have children and be reasonably sized
    return (el.childCount ?? 0) >= 2 && el.boundingBox.width > 100 && el.boundingBox.height > 50;
  });

  for (const el of layoutContainers) {
    if (usedElementIds.has(el.id)) continue;

    const children = childrenOf.get(el.id) || [];
    const layout = isLayoutContainer(el);

    // Phase 3: Check for repeated siblings (cards pattern)
    if (layout === 'grid' && children.length >= 2 && areSimilarSiblings(children)) {
      // This is a grid of cards → register grid + individual cards
      usedElementIds.add(el.id);
      const gridType = inferType(el);

      components.push({
        id: `comp-${components.length}-${el.id || el.tagName}`,
        name: generateName(el, gridType === 'section' ? 'grid' : gridType, components.length),
        type: 'grid',
        elementIds: [el.id],
        boundingBox: { ...el.boundingBox },
        sourceFile: inferSourceFile(el),
        reasoning: `grid container with ${children.length} similar children`,
        depth: el.depth,
        fullClassName: typeof el.className === 'string' ? el.className : '',
      });

      // Register each child as a card
      for (const child of children) {
        if (usedElementIds.has(child.id)) continue;
        usedElementIds.add(child.id);

        components.push({
          id: `comp-${components.length}-${child.id || child.tagName}`,
          name: generateName(child, 'card', components.length),
          type: 'card',
          elementIds: [child.id],
          boundingBox: { ...child.boundingBox },
          sourceFile: inferSourceFile(child),
          reasoning: `grid child card`,
          depth: child.depth,
          fullClassName: typeof child.className === 'string' ? child.className : '',
        });
      }
    } else if ((el.childCount ?? 0) >= 2) {
      // Regular layout container
      usedElementIds.add(el.id);
      const type = inferType(el);

      components.push({
        id: `comp-${components.length}-${el.id || el.tagName}`,
        name: generateName(el, type, components.length),
        type,
        elementIds: [el.id],
        boundingBox: { ...el.boundingBox },
        sourceFile: inferSourceFile(el),
        reasoning: `${layout} container`,
        depth: el.depth,
        fullClassName: typeof el.className === 'string' ? el.className : '',
      });
    }
  }

  // Phase 4: Remaining meaningful elements (large enough, not yet captured)
  const remaining = rawElements.filter(el => {
    if (usedElementIds.has(el.id)) return false;
    const area = el.boundingBox.width * el.boundingBox.height;
    // Must be substantial: at least 150x60 and top 3 depth levels
    return area > 9000 && el.boundingBox.width > 150 && el.boundingBox.height > 60 && el.depth <= 3;
  });

  for (const el of remaining) {
    if (usedElementIds.has(el.id)) continue;
    usedElementIds.add(el.id);

    const type = inferType(el);
    components.push({
      id: `comp-${components.length}-${el.id || el.tagName}`,
      name: generateName(el, type, components.length),
      type,
      elementIds: [el.id],
      boundingBox: { ...el.boundingBox },
      sourceFile: inferSourceFile(el),
      reasoning: `significant element (${el.boundingBox.width}x${el.boundingBox.height})`,
      depth: el.depth,
      fullClassName: typeof el.className === 'string' ? el.className : '',
    });
  }

  // Sort: top-level first (by y position), then by depth
  components.sort((a, b) => {
    if ((a.depth ?? 0) !== (b.depth ?? 0)) return (a.depth ?? 0) - (b.depth ?? 0);
    return a.boundingBox.y - b.boundingBox.y;
  });

  return components;
}
