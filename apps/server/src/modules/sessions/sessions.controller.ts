import type { RequestHandler } from 'express';
import { currentUserId } from '../../middleware/authenticate';
import { valid } from '../../middleware/validate';
import { sessionsService } from './sessions.service';

const idOf = (req: Parameters<RequestHandler>[0]) => valid<{ id: string }>(req, 'params').id;

/** Web-user endpoints. Editor ingestion uses the same service via the integrations module. */
export const sessionsController = {
  list: (async (req, res) => {
    res.json(await sessionsService.list(currentUserId(req), valid(req, 'query')));
  }) satisfies RequestHandler,

  get: (async (req, res) => {
    res.json({ data: await sessionsService.get({ userId: currentUserId(req) }, idOf(req)) });
  }) satisfies RequestHandler,

  create: (async (req, res) => {
    const { session } = await sessionsService.create(
      { userId: currentUserId(req) },
      valid(req, 'body'),
    );
    res.status(201).json({ data: session });
  }) satisfies RequestHandler,

  update: (async (req, res) => {
    res.json({
      data: await sessionsService.update(
        { userId: currentUserId(req) },
        idOf(req),
        valid(req, 'body'),
      ),
    });
  }) satisfies RequestHandler,

  remove: (async (req, res) => {
    await sessionsService.remove(currentUserId(req), idOf(req));
    res.status(204).end();
  }) satisfies RequestHandler,
};
