import type { FastifyInstance } from 'fastify';
import type { AccountController } from '../controllers/accountController.ts';

export type AccountRoutesOptions = {
  controller: AccountController;
};

export async function accountRoutes(app: FastifyInstance, options: AccountRoutesOptions) {
  app.post('/', options.controller.create);
  app.get('/', options.controller.list);
  app.get('/:id', options.controller.getById);
  app.patch('/:id', options.controller.update);
  app.delete('/:id', options.controller.remove);
}
