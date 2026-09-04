import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    // 단위 테스트는 src/ 에만 있다. ab/ 의 A/B 하네스는 결과 파일을 디스크에
    // 쓰므로 기본 실행에서 제외하고 `pnpm test:ab` 로 따로 돌린다.
    include: ['src/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    // Ignore worktree directories created by parallel agents; their test
    // files would otherwise be discovered on disk and run against the main
    // workspace's module resolution, colliding with the in-tree copies.
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/.claude/worktrees/**',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
