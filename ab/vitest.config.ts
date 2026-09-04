/**
 * A/B 하네스 전용 설정.
 *
 * 기본 스위트(`pnpm test`)와 분리해 둔 이유는 두 가지다.
 *   - 이 테스트들은 결과를 ab/*.md 와 ab/*.json 으로 디스크에 쓴다.
 *     매 단위 테스트 실행마다 작업 트리가 더러워지면 안 된다.
 *   - 실험 3은 실제 프로젝트 전체를 읽어 수집 비용을 재므로 단위 테스트보다 느리고,
 *     측정 대상이 저장소 상태에 따라 달라진다.
 *
 * 실행: pnpm test:ab
 */
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    include: ['ab/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../src'),
    },
  },
});
