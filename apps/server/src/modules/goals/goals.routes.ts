import { Router } from 'express';
import { createGoalSchema, idParamsSchema, updateGoalSchema } from '@devpulse/shared';
import { z } from 'zod';
import { currentUserId, requireUser } from '../../middleware/authenticate';
import { valid, validate } from '../../middleware/validate';
import { goalsService } from './goals.service';

const listQuerySchema = z.object({ archived: z.enum(['true', 'false']).default('false') });
const idOf = (req: Express.Request) => valid<{ id: string }>(req, 'params').id;

export const goalsRouter = Router();

goalsRouter.use(requireUser);
goalsRouter.get('/', validate('query', listQuerySchema), async (req, res) => {
  const { archived } = valid<{ archived: 'true' | 'false' }>(req, 'query');
  res.json({ data: await goalsService.list(currentUserId(req), archived === 'true') });
});
goalsRouter.post('/', validate('body', createGoalSchema), async (req, res) => {
  res.status(201).json({ data: await goalsService.create(currentUserId(req), valid(req, 'body')) });
});
goalsRouter.patch(
  '/:id',
  validate('params', idParamsSchema),
  validate('body', updateGoalSchema),
  async (req, res) => {
    res.json({
      data: await goalsService.update(currentUserId(req), idOf(req), valid(req, 'body')),
    });
  },
);
goalsRouter.delete('/:id', validate('params', idParamsSchema), async (req, res) => {
  await goalsService.remove(currentUserId(req), idOf(req));
  res.status(204).end();
});
