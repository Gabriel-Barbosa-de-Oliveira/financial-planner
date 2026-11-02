import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import type { RouteHandlerMethod } from 'fastify';
import { createServer } from '../server.ts';
import { registerRoutes } from './routesIndex.ts';

describe('userRoutes', () => {
  let app: Awaited<ReturnType<typeof createServer>>;
  let createUser: jest.Mock<RouteHandlerMethod>;

  beforeEach(async () => {
    createUser = jest.fn<RouteHandlerMethod>(async (_request, reply) => reply.status(201).send({ ok: true }));
    app = await createServer(false);
    await app.register(
      async (instance) => registerRoutes(instance, { user: { createUser } }),
      { prefix: '/financial-control' },
    );
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('encaminha POST /financial-control/users para o handler de cadastro', async () => {
    const response = await app.inject({ method: 'POST', url: '/financial-control/users', payload: {} });

    expect(response.statusCode).toBe(201);
    expect(createUser).toHaveBeenCalledTimes(1);
  });

  it.each(['GET', 'PUT', 'PATCH', 'DELETE'] as const)('não expõe %s em /financial-control/users', async (method) => {
    const response = await app.inject({ method, url: '/financial-control/users' });

    expect(response.statusCode).toBe(404);
    expect(createUser).not.toHaveBeenCalled();
  });
});
