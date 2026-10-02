import { defineConfig } from 'tsup';

export default defineConfig({
  // server.js runs a standalone process; app.js exports the Express app for serverless hosts.
  entry: ['src/server.ts', 'src/app.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  // The shared contracts package ships TypeScript source, so it is bundled into the build.
  noExternal: ['@devpulse/shared'],
});
