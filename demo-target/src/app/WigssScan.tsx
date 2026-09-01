'use client';

/**
 * wigss 스캔 런타임 장착 (P1 · PROD-631).
 * 이전에는 layout.tsx 의 인라인 <script> 였다 — 패키지 모듈로 승격되어
 * 어떤 React 앱이든 이 한 줄로 wigss 에디터에 참여한다.
 */
import { useEffect } from 'react';
import { initWigssScan } from 'wigss/scan';

export default function WigssScan() {
  useEffect(() => initWigssScan(), []);
  return null;
}
