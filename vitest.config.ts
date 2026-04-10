import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
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
