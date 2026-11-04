import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import type { RouteHandlerMethod } from 'fastify';
import { createServer } from '../server.ts';
import { registerRoutes } from './routesIndex.ts';
import type { CategoryController } from '../controllers/categoryController.ts';

const ID = '6f1d3c1e-0c4b-4f0e-9d1a-2b7a8f3c9e10';
const BASE = '/categories';

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

const exposed: Array<[Method, string, keyof CategoryController]> = [
  ['POST', BASE, 'create'],
  ['GET', BASE, 'list'],
  ['GET', `${BASE}/${ID}`, 'getById'],
  ['PATCH', `${BASE}/${ID}`, 'update'],
  ['DELETE', `${BASE}/${ID}`, 'remove'],
  ['POST', `${BASE}/${ID}/reactivate`, 'reactivate'],
];

const notExposed: Array<[Method, string]> = [
  ['PUT', BASE],
  ['PATCH', BASE],
  ['DELETE', BASE],
  ['PUT', `${BASE}/${ID}`],
  ['GET', `${BASE}/${ID}/reactivate`],
  ['PATCH', `${BASE}/${ID}/reactivate`],
  ['DELETE', `${BASE}/${ID}/reactivate`],
];

describe('categoryRoutes', () => {
  let app: Awaited<ReturnType<typeof createServer>>;
  let controller: { [K in keyof CategoryController]: jest.Mock<RouteHandlerMethod> };

  const handler = () => jest.fn<RouteHandlerMethod>(async (_request, reply) => reply.status(200).send({ ok: true }));
  const stub = () => ({ create: handler(), list: handler(), getById: handler(), update: handler(), remove: handler(), reactivate: handler() });

  beforeEach(async () => {
    controller = stub();
    const others = stub();
    app = await createServer(false);
    await app.register(
      async (instance) => registerRoutes(instance, {
        user: { controller: others },
        account: { controller: others },
        classification: { controller: others },
        category: { controller },
      }),
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
