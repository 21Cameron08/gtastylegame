import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative base so the build works at any path (e.g. GitHub Pages /gtastylegame/).
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 4000,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
