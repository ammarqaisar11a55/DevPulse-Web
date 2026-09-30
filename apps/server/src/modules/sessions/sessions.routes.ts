import { Router } from 'express';
import { createSessionSchema, idParamsSchema, listSessionsQuerySchema } from '@devpulse/shared';
import { z } from 'zod';
import { requireUser } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import { sessionsController } from './sessions.controller';

/** Web users may rename a session or move it to another project. */
const editSessionSchema = z.object({
  title: z
    .string()
    .trim()
    .max(120)
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .optional(),
  projectId: z.uuid().nullable().optional(),
});

/** Manual logging requires a finished session. */
const logSessionSchema = createSessionSchema.refine((data) => data.endedAt !== undefined, {
  message: 'Enter when the session ended',
  path: ['endedAt'],
});

export const sessionsRouter = Router();

sessionsRouter.use(requireUser);
sessionsRouter.get('/', validate('query', listSessionsQuerySchema), sessionsController.list);
sessionsRouter.post('/', validate('body', logSessionSchema), sessionsController.create);
sessionsRouter.get('/:id', validate('params', idParamsSchema), sessionsController.get);
sessionsRouter.patch(
  '/:id',
  validate('params', idParamsSchema),
  validate('body', editSessionSchema),
  sessionsController.update,
);
sessionsRouter.delete('/:id', validate('params', idParamsSchema), sessionsController.remove);
