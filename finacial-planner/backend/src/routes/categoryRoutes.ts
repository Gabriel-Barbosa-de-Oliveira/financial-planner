import type { FastifyInstance } from 'fastify';
import type { CategoryController } from '../controllers/categoryController.ts';

export type CategoryRoutesOptions = {
  controller: CategoryController;
};

export async function categoryRoutes(app: FastifyInstance, options: CategoryRoutesOptions) {
  app.post('/', options.controller.create);
  app.get('/', options.controller.list);
  app.get('/:id', options.controller.getById);
  app.patch('/:id', options.controller.update);
  app.delete('/:id', options.controller.remove);
  app.post('/:id/reactivate', options.controller.reactivate);
}
