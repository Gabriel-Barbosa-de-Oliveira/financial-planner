import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { createServer } from '../server.ts';
import { createUserController } from './userController.ts';
import type { UserService } from '../services/userService.ts';
import { UsedEmailError } from '../utils/errors.ts';

const createdUser = {
  id: '6f1d3c1e-0c4b-4f0e-9d1a-2b7a8f3c9e10',
  email: 'ana@exemplo.com',
  isActive: true,
  createdAt: new Date('2026-11-02T10:00:00Z'),
  updatedAt: new Date('2026-11-02T10:00:00Z'),
};

describe('createUserController', () => {
  let app: Awaited<ReturnType<typeof createServer>>;
  let service: { createUser: jest.Mock<UserService['createUser']> };

  beforeEach(async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    service = { createUser: jest.fn<UserService['createUser']>().mockResolvedValue(createdUser) };
    app = await createServer(false);
    app.post('/users', createUserController(service));
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    jest.restoreAllMocks();
  });

  const post = (payload: object) => app.inject({ method: 'POST', url: '/users', payload });

  it('cria o usuário com e-mail normalizado e responde 201 sem senha', async () => {
    const response = await post({ email: '  Ana@Exemplo.com ', password: 'senha-segura-123' });

    expect(response.statusCode).toBe(201);
    expect(service.createUser).toHaveBeenCalledWith({ email: 'ana@exemplo.com', password: 'senha-segura-123' });
    expect(response.json()).toEqual({
      ...createdUser,
      createdAt: '2026-11-02T10:00:00.000Z',
      updatedAt: '2026-11-02T10:00:00.000Z',
    });
    expect(response.body).not.toContain('password');
    expect(response.body).not.toContain('senha-segura-123');
  });

  it.each([
    ['e-mail inválido', { email: 'invalido', password: 'senha-segura-123' }, 'email'],
    ['e-mail ausente', { password: 'senha-segura-123' }, 'email'],
    ['e-mail acima de 255 caracteres', { email: `${'a'.repeat(250)}@x.com`, password: 'senha-segura-123' }, 'email'],
    ['senha com 7 caracteres', { email: 'ana@exemplo.com', password: '1234567' }, 'password'],
    ['senha com 73 caracteres', { email: 'ana@exemplo.com', password: 'a'.repeat(73) }, 'password'],
    ['senha ausente', { email: 'ana@exemplo.com' }, 'password'],
    ['senha que não é texto', { email: 'ana@exemplo.com', password: 12345678 }, 'password'],
  ])('recusa com 400: %s', async (_name, payload, field) => {
    const response = await post(payload);

    expect(response.statusCode).toBe(400);
    expect(response.json().issues.map((issue: { field: string }) => issue.field)).toContain(field);
    expect(service.createUser).not.toHaveBeenCalled();
  });

  it('aceita senha com exatamente 8 e 72 caracteres', async () => {
    expect((await post({ email: 'a@exemplo.com', password: 'a'.repeat(8) })).statusCode).toBe(201);
    expect((await post({ email: 'b@exemplo.com', password: 'a'.repeat(72) })).statusCode).toBe(201);
  });

  it.each(['isActive', 'id', 'createdAt', 'updatedAt'])('recusa o campo não permitido %s', async (field) => {
    const response = await post({ email: 'ana@exemplo.com', password: 'senha-segura-123', [field]: 'x' });

    expect(response.statusCode).toBe(400);
    expect(service.createUser).not.toHaveBeenCalled();
  });

  it('informa o campo e a mensagem em português por campo inválido', async () => {
    const response = await post({ email: 'invalido', password: '123' });

    expect(response.json().issues).toEqual([
      { field: 'email', message: 'E-mail inválido' },
      { field: 'password', message: 'Senha deve ter no mínimo 8 caracteres' },
    ]);
  });

  it('responde 409 quando o service lança UsedEmailError', async () => {
    service.createUser.mockRejectedValue(new UsedEmailError());

    const response = await post({ email: 'ana@exemplo.com', password: 'senha-segura-123' });

    expect(response.statusCode).toBe(409);
    expect(response.json().message).toBe('E-mail já está em uso');
  });

  it('responde 500 genérico, sem a senha, quando o service falha', async () => {
    service.createUser.mockRejectedValue(new Error('falha interna com senha-segura-123'));

    const response = await post({ email: 'ana@exemplo.com', password: 'senha-segura-123' });

    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain('senha-segura-123');
  });
});
