import type { FastifyReply, FastifyRequest, RouteHandlerMethod } from 'fastify';
import type { AccountService } from '../services/accountService.ts';
import { accountIdParamsSchema, createAccountSchema, updateAccountSchema } from './schemas/account/accountSchemas.ts';

export type AccountController = {
  create: RouteHandlerMethod;
  list: RouteHandlerMethod;
  getById: RouteHandlerMethod;
  update: RouteHandlerMethod;
  remove: RouteHandlerMethod;
};

export function createAccountController(service: AccountService): AccountController {
  return {
    async create(request: FastifyRequest, reply: FastifyReply) {
      const input = createAccountSchema.parse(request.body);
      const account = await service.createAccount(input);
      return reply.status(201).send(account);
    },

    async list(_request: FastifyRequest, reply: FastifyReply) {
      const accounts = await service.listAccounts();
      return reply.status(200).send(accounts);
    },

    async getById(request: FastifyRequest, reply: FastifyReply) {
      const { id } = accountIdParamsSchema.parse(request.params);
      const account = await service.getAccount(id);
      return reply.status(200).send(account);
    },

    async update(request: FastifyRequest, reply: FastifyReply) {
      const { id } = accountIdParamsSchema.parse(request.params);
      const changes = updateAccountSchema.parse(request.body);
      const account = await service.updateAccount(id, changes);
      return reply.status(200).send(account);
    },

    async remove(request: FastifyRequest, reply: FastifyReply) {
      const { id } = accountIdParamsSchema.parse(request.params);
      await service.deactivateAccount(id);
      return reply.status(204).send();
    },
  };
}
