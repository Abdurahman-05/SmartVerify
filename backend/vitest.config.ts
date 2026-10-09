import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/tests/**/*.test.ts'],
    globalSetup: ['src/tests/global-setup.ts'],
    setupFiles: ['src/tests/setup-env.ts'],
    // Tests share one database, so run files one after another.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
