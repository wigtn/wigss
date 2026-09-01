export interface WigssScanOptions {
  maxElements?: number;
  maxDepth?: number;
  minWidth?: number;
  minHeight?: number;
}
/** 스캔 런타임 설치. 반환값은 해제 함수. */
export function initWigssScan(options?: WigssScanOptions): () => void;
