import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Loads .env and .env.test (the latter wins). Tests must point at a disposable database.
  const env = loadEnv(mode === 'development' ? 'test' : mode, process.cwd(), '');

  return {
    test: {
      environment: 'node',
      env: { ...env, NODE_ENV: 'test', DATABASE_URL: env.TEST_DATABASE_URL ?? '' },
      globalSetup: ['./tests/global-setup.ts'],
      include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
      // Integration tests share one database, so files run sequentially.
      fileParallelism: false,
      hookTimeout: 30_000,
      testTimeout: 20_000,
    },
  };
});
