import type { ComponentChange, DetectedComponent, StyleIntent } from '@/types';

/**
 * Reconstruct a synthetic ComponentChange + DetectedComponent from a StyleIntent.
 *
 * Rewriters that delegate to the legacy ComponentChange-based strategy functions
 * use this helper to bridge the intent boundary. The reconstruction is lossless
 * for the delta/absolute semantics the existing strategies expect:
 *
 *   intent.targetStyles.width  (absolute, from changeToCssProperties) →
 *     synthetic `to.width`, `from.width = 0`
 *   intent.targetStyles.height (absolute) → synthetic `to.height`, `from.height = 0`
 *   intent.targetStyles.marginLeft (delta) → synthetic `to.x = delta`, `from.x = 0`
 *   intent.targetStyles.marginTop  (delta) → synthetic `to.y = delta`, `from.y = 0`
 *
 * Since `changeToCssProperties` itself emits width/height as absolute and
 * marginTop/Left as delta, round-tripping through this helper produces
 * behaviourally identical output for all four existing strategies.
 */
export function synthFromIntent(intent: StyleIntent): {
  change: ComponentChange;
  component: DetectedComponent;
} {
  const from = { x: 0, y: 0, width: 0, height: 0 };
  const to = { x: 0, y: 0, width: 0, height: 0 };

  const ts = intent.targetStyles;
  if (ts.width != null) to.width = parseFloat(ts.width) || 0;
  if (ts.height != null) to.height = parseFloat(ts.height) || 0;
  if (ts.marginLeft != null) to.x = parseFloat(ts.marginLeft) || 0;
  if (ts.marginTop != null) to.y = parseFloat(ts.marginTop) || 0;

  const change: ComponentChange = {
    componentId: intent.componentId,
    type: 'resize',
    from,
    to,
  };

  const hint = intent.sourceHint;
  const component: DetectedComponent = {
    id: intent.componentId,
    name: hint?.componentName ?? intent.componentId,
    type: 'section',
    elementIds: [],
    boundingBox: { x: 0, y: 0, width: 0, height: 0 },
    sourceFile: hint?.file ?? '',
    reasoning: '',
    fullClassName: hint?.className,
    cssInfo: hint?.cssStrategy,
  };

  return { change, component };
}
