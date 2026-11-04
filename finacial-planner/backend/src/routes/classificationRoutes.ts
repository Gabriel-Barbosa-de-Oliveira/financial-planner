import type { FastifyInstance } from 'fastify';
import type { ClassificationController } from '../controllers/classificationController.ts';

export type ClassificationRoutesOptions = {
  controller: ClassificationController;
};

export async function classificationRoutes(app: FastifyInstance, options: ClassificationRoutesOptions) {
  app.post('/', options.controller.create);
  app.get('/', options.controller.list);
  app.get('/:id', options.controller.getById);
  app.patch('/:id', options.controller.update);
  app.delete('/:id', options.controller.remove);
  app.post('/:id/reactivate', options.controller.reactivate);
}
