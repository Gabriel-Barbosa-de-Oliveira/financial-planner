import type { FastifyInstance } from 'fastify';
import type { UserController } from '../controllers/userController.ts';

export type UserRoutesOptions = {
  controller: UserController;
};

export async function userRoutes(app: FastifyInstance, options: UserRoutesOptions) {
  app.post('/', options.controller.create);
  app.get('/', options.controller.list);
  app.get('/:id', options.controller.getById);
  app.patch('/:id', options.controller.update);
  app.delete('/:id', options.controller.remove);
}
