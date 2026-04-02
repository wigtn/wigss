/**
 * Tailwind CSS breakpoint utilities.
 * Maps viewport widths to breakpoint names and vice versa.
 */

export type BreakpointName = 'sm' | 'md' | 'lg' | 'xl' | '2xl';

export const BREAKPOINTS: Record<BreakpointName, number> = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
};

const BREAKPOINT_ORDER: BreakpointName[] = ['sm', 'md', 'lg', 'xl', '2xl'];

/**
 * Resolve a viewport width to the largest breakpoint it satisfies.
 * Uses Tailwind's mobile-first logic: min-width matching.
 *
 * @example
 *   resolveBreakpoint(800) → 'md'   (>= 768, < 1024)
 *   resolveBreakpoint(1400) → 'xl'  (>= 1280, < 1536)
 *   resolveBreakpoint(400) → null    (< 640, base/mobile)
 */
export function resolveBreakpoint(viewportWidth: number): BreakpointName | null {
  let resolved: BreakpointName | null = null;
  for (const bp of BREAKPOINT_ORDER) {
    if (viewportWidth >= BREAKPOINTS[bp]) {
      resolved = bp;
    } else {
      break;
    }
  }
  return resolved;
}

/**
 * Get the pixel width for a breakpoint name.
 */
export function getBreakpointWidth(breakpoint: BreakpointName): number {
  return BREAKPOINTS[breakpoint];
}

/**
 * Get the CSS @media query string for a breakpoint.
 *
 * @example
 *   getMediaQuery('md') → '@media (min-width: 768px)'
 */
export function getMediaQuery(breakpoint: BreakpointName): string {
  return `@media (min-width: ${BREAKPOINTS[breakpoint]}px)`;
}

/**
 * Check if a string is a valid breakpoint name.
 */
export function isBreakpointName(value: string): value is BreakpointName {
  return value in BREAKPOINTS;
}

/**
 * Get ordered list of breakpoint names.
 */
export function getBreakpointOrder(): BreakpointName[] {
  return [...BREAKPOINT_ORDER];
}
