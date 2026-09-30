import { logger } from './logger';

/**
 * In-process domain events. Modules react to each other's changes (e.g. goals checking
 * progress when a session is recorded) without direct coupling. Handlers run after the
 * triggering write has committed; failures are logged and never fail the original request.
 * A durable queue can replace this later without changing emitters.
 */
export interface DomainEvents {
  'session.recorded': {
    userId: string;
    sessionId: string;
    projectId: string | null;
    activeSeconds: number;
    endedAt: Date;
  };
  'device.connected': { userId: string; deviceId: string; name: string };
  'device.revoked': { userId: string; deviceId: string; name: string };
  'security.password_changed': { userId: string };
}

type Handler<K extends keyof DomainEvents> = (payload: DomainEvents[K]) => Promise<void> | void;
type StoredHandler = (payload: unknown) => Promise<void> | void;

const handlers = new Map<keyof DomainEvents, StoredHandler[]>();

export function onDomainEvent<K extends keyof DomainEvents>(event: K, handler: Handler<K>) {
  handlers.set(event, [...(handlers.get(event) ?? []), handler as StoredHandler]);
}

export async function emitDomainEvent<K extends keyof DomainEvents>(
  event: K,
  payload: DomainEvents[K],
) {
  for (const handler of handlers.get(event) ?? []) {
    try {
      await handler(payload);
    } catch (error) {
      logger.error({ err: error, event }, 'Domain event handler failed');
    }
  }
}
