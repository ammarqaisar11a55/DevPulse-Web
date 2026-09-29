import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  // The shared contracts package ships TypeScript source, so it is bundled into the build.
  noExternal: ['@devpulse/shared'],
});
