import type { FastifyInstance, RouteHandlerMethod } from 'fastify';

export type UserRoutesOptions = {
  createUser: RouteHandlerMethod;
};

export async function userRoutes(app: FastifyInstance, options: UserRoutesOptions) {
  app.post('/', options.createUser);
}
