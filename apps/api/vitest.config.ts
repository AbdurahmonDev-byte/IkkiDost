import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';

export default defineConfig({
  // SWC is required so TypeScript decorator metadata is emitted (NestJS DI depends on it).
  plugins: [swc.vite()],
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts', 'test/**/*.test.ts'],
    testTimeout: 120_000,
    hookTimeout: 120_000,
    // Integration tests share one embedded PostgreSQL — run sequentially.
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
  resolve: {
    alias: {
      '@ikki-dost/shared-types': new URL('../../packages/shared-types/src/index.ts', import.meta.url).pathname,
      '@ikki-dost/utils': new URL('../../packages/utils/src/index.ts', import.meta.url).pathname,
      '@ikki-dost/validation': new URL('../../packages/validation/src/index.ts', import.meta.url).pathname,
    },
  },
});
