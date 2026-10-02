// Vercel serverless function: handles every /api/* request with the DevPulse Express app.
// `npm run build` creates apps/server/dist/app.js (with the shared package bundled in) before
// Vercel packages this function. See vercel.json and docs/DEPLOYMENT.md.
import { createApp } from '../apps/server/dist/app.js';

export default createApp();
