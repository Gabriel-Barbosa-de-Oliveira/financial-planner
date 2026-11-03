import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import type { RouteHandlerMethod } from 'fastify';
import { createServer } from '../server.ts';
import { registerRoutes } from './routesIndex.ts';
import type { UserController } from '../controllers/userController.ts';

const ID = '6f1d3c1e-0c4b-4f0e-9d1a-2b7a8f3c9e10';

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

const exposed: Array<[Method, string, keyof UserController]> = [
  ['POST', '/users', 'create'],
  ['GET', '/users', 'list'],
  ['GET', `/users/${ID}`, 'getById'],
  ['PATCH', `/users/${ID}`, 'update'],
  ['DELETE', `/users/${ID}`, 'remove'],
];

const notExposed: Array<[Method, string]> = [
  ['PUT', '/users'],
  ['PATCH', '/users'],
  ['DELETE', '/users'],
  ['PUT', `/users/${ID}`],
];

describe('userRoutes', () => {
  let app: Awaited<ReturnType<typeof createServer>>;
  let controller: { [K in keyof UserController]: jest.Mock<RouteHandlerMethod> };

  const handler = () => jest.fn<RouteHandlerMethod>(async (_request, reply) => reply.status(200).send({ ok: true }));

  beforeEach(async () => {
    controller = {
      create: handler(),
      list: handler(),
      getById: handler(),
      update: handler(),
      remove: handler(),
    };
    app = await createServer(false);
    await app.register(
      async (instance) => registerRoutes(instance, { user: { controller } }),
      { prefix: '/financial-control' },
    );
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  const call = (method: Method, url: string) =>
    app.inject({ method, url: `/financial-control${url}`, ...(method === 'POST' ? { payload: {} } : {}) });

  it.each(exposed)('encaminha %s %s para o handler %s', async (method, url, name) => {
    const response = await call(method, url);

    expect(response.statusCode).toBe(200);
    expect(controller[name]).toHaveBeenCalledTimes(1);
  });

  it.each(notExposed)('não expõe %s %s', async (method, url) => {
    const response = await call(method, url);

    expect(response.statusCode).toBe(404);
    Object.values(controller).forEach((fn) => expect(fn).not.toHaveBeenCalled());
  });
});
