// ── Tailwind px↔class mapping ──
// Shared between tailwind-rewriter and tailwind-cleanup.
const TW_MAP: Record<number, string> = {
  0:'0', 2:'0.5', 4:'1', 6:'1.5', 8:'2', 10:'2.5', 12:'3', 14:'3.5',
  16:'4', 20:'5', 24:'6', 28:'7', 32:'8', 36:'9', 40:'10', 44:'11',
  48:'12', 56:'14', 64:'16', 80:'20', 96:'24', 112:'28', 128:'32',
  160:'40', 192:'48', 224:'56', 256:'64', 288:'72', 320:'80', 384:'96',
};

export function pxToTw(px: number, prefix: string): string {
  const closest = Object.keys(TW_MAP).map(Number)
    .reduce((prev, curr) => Math.abs(curr - px) < Math.abs(prev - px) ? curr : prev, 0);
  if (Math.abs(closest - px) <= 2) return `${prefix}-${TW_MAP[closest]}`;
  return `${prefix}-[${Math.round(px)}px]`;
}

const TW_REVERSE = new Map(Object.entries(TW_MAP).map(([px, tw]) => [tw, Number(px)]));

export function parseTwPx(twClass: string, prefix: string): number {
  const bracketMatch = twClass.match(/\[(\d+)px\]/);
  if (bracketMatch) return parseInt(bracketMatch[1]);
  const twNum = twClass.replace(new RegExp(`^-?${prefix}-`), '');
  return TW_REVERSE.get(twNum) ?? parseInt(twNum) * 4;
}

export function findTwClass(className: string, prefix: string): string | null {
  const escaped = prefix.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const regex = new RegExp(`(?:^|\\s)-?${escaped}-(?:\\[\\d+px\\]|\\d+\\.?\\d*)(?=\\s|$)`);
  const match = className.match(regex);
  return match ? match[0].trim() : null;
}
