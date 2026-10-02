import type { RequestHandler } from 'express';
import { currentUserId } from '../../middleware/authenticate';
import { valid } from '../../middleware/validate';
import type { ListProjectsFilters } from './projects.repository';
import { projectsService } from './projects.service';

const idOf = (req: Parameters<RequestHandler>[0]) => valid<{ id: string }>(req, 'params').id;

export const projectsController = {
  list: (async (req, res) => {
    res.json(
      await projectsService.list(currentUserId(req), valid<ListProjectsFilters>(req, 'query')),
    );
  }) satisfies RequestHandler,

  get: (async (req, res) => {
    res.json({ data: await projectsService.get(currentUserId(req), idOf(req)) });
  }) satisfies RequestHandler,

  history: (async (req, res) => {
    res.json({ data: await projectsService.history(currentUserId(req), idOf(req)) });
  }) satisfies RequestHandler,

  create: (async (req, res) => {
    res
      .status(201)
      .json({ data: await projectsService.create(currentUserId(req), valid(req, 'body')) });
  }) satisfies RequestHandler,

  update: (async (req, res) => {
    res.json({
      data: await projectsService.update(currentUserId(req), idOf(req), valid(req, 'body')),
    });
  }) satisfies RequestHandler,

  remove: (async (req, res) => {
    await projectsService.remove(currentUserId(req), idOf(req));
    res.status(204).end();
  }) satisfies RequestHandler,
};
