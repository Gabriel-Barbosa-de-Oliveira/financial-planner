import type { FastifyReply, FastifyRequest, RouteHandlerMethod } from 'fastify';
import type { UserService } from '../services/userService.ts';
import { createUserSchema, updateUserSchema, userIdParamsSchema } from './schemas/user/userSchemas.ts';

export type UserController = {
  create: RouteHandlerMethod;
  list: RouteHandlerMethod;
  getById: RouteHandlerMethod;
  update: RouteHandlerMethod;
  remove: RouteHandlerMethod;
};

export function createUserController(service: UserService): UserController {
  return {
    async create(request: FastifyRequest, reply: FastifyReply) {
      const input = createUserSchema.parse(request.body);
      const user = await service.createUser(input);
      return reply.status(201).send(user);
    },

    async list(_request: FastifyRequest, reply: FastifyReply) {
      const users = await service.listUsers();
      return reply.status(200).send(users);
    },

    async getById(request: FastifyRequest, reply: FastifyReply) {
      const { id } = userIdParamsSchema.parse(request.params);
      const user = await service.getUser(id);
      return reply.status(200).send(user);
    },

    async update(request: FastifyRequest, reply: FastifyReply) {
      const { id } = userIdParamsSchema.parse(request.params);
      const changes = updateUserSchema.parse(request.body);
      const user = await service.updateUser(id, changes);
      return reply.status(200).send(user);
    },

    async remove(request: FastifyRequest, reply: FastifyReply) {
      const { id } = userIdParamsSchema.parse(request.params);
      await service.deactivateUser(id);
      return reply.status(204).send();
    },
  };
}
