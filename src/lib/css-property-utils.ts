import type { ComponentChange } from '@/types';

/**
 * Convert a ComponentChange to CSS property/value pairs.
 */
export function changeToCssProperties(change: ComponentChange): Record<string, string> {
  const props: Record<string, string> = {};

  const dh = (change.to.height ?? 0) - (change.from.height ?? 0);
  const dw = (change.to.width ?? 0) - (change.from.width ?? 0);
  if (Math.abs(dh) > 2 && change.to.height != null) {
    props['height'] = `${Math.round(change.to.height)}px`;
  }
  if (Math.abs(dw) > 2 && change.to.width != null) {
    props['width'] = `${Math.round(change.to.width)}px`;
  }

  const dy = (change.to.y ?? 0) - (change.from.y ?? 0);
  const dx = (change.to.x ?? 0) - (change.from.x ?? 0);
  if (Math.abs(dy) > 2) {
    props['marginTop'] = `${Math.round(dy)}px`;
  }
  if (Math.abs(dx) > 2) {
    props['marginLeft'] = `${Math.round(dx)}px`;
  }

  return props;
}

/**
 * Convert a ComponentChange to CSS properties in kebab-case (for .css files).
 */
export function changeToCssKebab(change: ComponentChange): Record<string, string> {
  const props: Record<string, string> = {};

  const dh = (change.to.height ?? 0) - (change.from.height ?? 0);
  const dw = (change.to.width ?? 0) - (change.from.width ?? 0);
  if (Math.abs(dh) > 2 && change.to.height != null) {
    props['height'] = `${Math.round(change.to.height)}px`;
  }
  if (Math.abs(dw) > 2 && change.to.width != null) {
    props['width'] = `${Math.round(change.to.width)}px`;
  }

  const dy = (change.to.y ?? 0) - (change.from.y ?? 0);
  const dx = (change.to.x ?? 0) - (change.from.x ?? 0);
  if (Math.abs(dy) > 2) {
    props['margin-top'] = `${Math.round(dy)}px`;
  }
  if (Math.abs(dx) > 2) {
    props['margin-left'] = `${Math.round(dx)}px`;
  }

  return props;
}