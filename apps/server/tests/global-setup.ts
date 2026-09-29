import { execSync } from 'node:child_process';
import { loadEnv } from 'vite';

/** Applies migrations to the test database once before the suite runs. */
export default function setup() {
  const url = loadEnv('test', process.cwd(), '').TEST_DATABASE_URL;
  if (!url) {
    throw new Error(
      'TEST_DATABASE_URL is not set. Copy apps/server/.env.test.example to .env.test.',
    );
  }
  if (!/test/i.test(new URL(url).pathname)) {
    throw new Error('Refusing to run tests: TEST_DATABASE_URL database name must contain "test".');
  }
  execSync('npx prisma migrate deploy', {
    stdio: 'pipe',
    env: { ...process.env, DATABASE_URL: url },
  });
}
