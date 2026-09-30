import { sessionsService } from '../modules/sessions/sessions.service';
import { logger } from '../utils/logger';

const STALE_SESSION_SWEEP_MS = 5 * 60 * 1000;

/**
 * Lightweight in-process scheduler. Suitable for a single API instance; with several
 * instances, move these to a dedicated worker or a job queue with locking.
 */
export function startBackgroundJobs() {
  const timers = [
    setInterval(() => {
      sessionsService
        .closeStaleSessions()
        .then((count) => count > 0 && logger.info({ count }, 'Closed stale coding sessions'))
        .catch((error: unknown) => logger.error({ err: error }, 'Stale session sweep failed'));
    }, STALE_SESSION_SWEEP_MS),
  ];
  for (const timer of timers) timer.unref();
  return () => timers.forEach(clearInterval);
}
