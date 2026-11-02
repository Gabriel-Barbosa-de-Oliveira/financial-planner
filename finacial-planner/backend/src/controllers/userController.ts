import type { FastifyReply, FastifyRequest } from 'fastify';
import type { UserService } from '../services/userService.ts';
import { createUserSchema } from './schemas/user/userSchemas.ts';

export function createUserController(service: UserService) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const input = createUserSchema.parse(request.body);
    const user = await service.createUser(input);
    return reply.status(201).send(user);
  };
}
