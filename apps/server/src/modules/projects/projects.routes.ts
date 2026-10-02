import { Router } from 'express';
import {
  createProjectSchema,
  idParamsSchema,
  listProjectsQuerySchema,
  updateProjectSchema,
} from '@devpulse/shared';
import { requireUser } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import { projectsController } from './projects.controller';

export const projectsRouter = Router();

projectsRouter.use(requireUser);
projectsRouter.get('/', validate('query', listProjectsQuerySchema), projectsController.list);
projectsRouter.post('/', validate('body', createProjectSchema), projectsController.create);
projectsRouter.get('/:id', validate('params', idParamsSchema), projectsController.get);
projectsRouter.get('/:id/history', validate('params', idParamsSchema), projectsController.history);
projectsRouter.patch(
  '/:id',
  validate('params', idParamsSchema),
  validate('body', updateProjectSchema),
  projectsController.update,
);
projectsRouter.delete('/:id', validate('params', idParamsSchema), projectsController.remove);
