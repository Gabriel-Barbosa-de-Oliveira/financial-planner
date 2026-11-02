import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { z } from 'zod';
import { createServer } from './server.ts';
import { UsedEmailError } from './utils/errors.ts';

describe('error handler do servidor', () => {
  let app: Awaited<ReturnType<typeof createServer>>;

  beforeAll(async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    app = await createServer(false);
    app.get('/test/domain', async () => {
      throw new UsedEmailError();
    });
    app.get('/test/zod', async () => {
      z.object({ email: z.string().email('E-mail inválido') }).parse({ email: 'x' });
    });
    app.get('/test/unexpected', async () => {
      throw new Error('connection to db-host:5432 refused, password=segredo');
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    jest.restoreAllMocks();
  });

  it('traduz DomainError para o status e a mensagem do próprio erro', async () => {
    const response = await app.inject({ method: 'GET', url: '/test/domain' });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: 'USED_EMAIL',
      message: 'E-mail já está em uso',
      statusCode: 409,
    });
  });

  it('traduz ZodError para 400 com os campos inválidos', async () => {
    const response = await app.inject({ method: 'GET', url: '/test/zod' });

    expect(response.statusCode).toBe(400);
    expect(response.json().issues).toEqual([{ field: 'email', message: 'E-mail inválido' }]);
  });

  it('responde 500 genérico sem vazar detalhes do erro inesperado', async () => {
    const response = await app.inject({ method: 'GET', url: '/test/unexpected' });

    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain('segredo');
    expect(response.body).not.toContain('db-host');
    expect(response.json().message).toBe('Algo deu errado no servidor');
  });
});
