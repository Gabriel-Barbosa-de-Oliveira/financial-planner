import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { createServer } from '../server.ts';
import { createUserController } from './userController.ts';
import type { UserService } from '../services/userService.ts';
import { UsedEmailError, UserNotFoundError } from '../utils/errors.ts';

const createdUser = {
  id: '6f1d3c1e-0c4b-4f0e-9d1a-2b7a8f3c9e10',
  email: 'ana@exemplo.com',
  isActive: true,
  createdAt: new Date('2026-11-02T10:00:00Z'),
  updatedAt: new Date('2026-11-02T10:00:00Z'),
};

describe('createUserController', () => {
  let app: Awaited<ReturnType<typeof createServer>>;
  let service: { [K in keyof UserService]: jest.Mock<UserService[K]> };

  beforeEach(async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    service = {
      createUser: jest.fn<UserService['createUser']>().mockResolvedValue(createdUser),
      listUsers: jest.fn<UserService['listUsers']>().mockResolvedValue([createdUser]),
      getUser: jest.fn<UserService['getUser']>().mockResolvedValue(createdUser),
      updateUser: jest.fn<UserService['updateUser']>().mockResolvedValue(createdUser),
      deactivateUser: jest.fn<UserService['deactivateUser']>().mockResolvedValue(undefined),
    };
    const controller = createUserController(service);
    app = await createServer(false);
    app.post('/users', controller.create);
    app.get('/users', controller.list);
    app.get('/users/:id', controller.getById);
    app.patch('/users/:id', controller.update);
    app.delete('/users/:id', controller.remove);
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

  describe('list', () => {
    it('responde 200 com o array de usuários, sem senha', async () => {
      const response = await app.inject({ method: 'GET', url: '/users' });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual([
        { ...createdUser, createdAt: '2026-11-02T10:00:00.000Z', updatedAt: '2026-11-02T10:00:00.000Z' },
      ]);
      expect(response.body).not.toContain('password');
      expect(response.body).not.toContain('hash');
    });

    it('responde 200 com lista vazia quando não há usuários', async () => {
      service.listUsers.mockResolvedValue([]);

      const response = await app.inject({ method: 'GET', url: '/users' });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual([]);
    });
  });

  describe('getById', () => {
    it('responde 200 e consulta o service com o id', async () => {
      const response = await app.inject({ method: 'GET', url: `/users/${createdUser.id}` });

      expect(response.statusCode).toBe(200);
      expect(service.getUser).toHaveBeenCalledWith(createdUser.id);
      expect(response.json().id).toBe(createdUser.id);
      expect(response.body).not.toContain('password');
    });

    it('recusa id malformado com 400, sem chamar o service', async () => {
      const response = await app.inject({ method: 'GET', url: '/users/abc' });

      expect(response.statusCode).toBe(400);
      expect(response.json().issues).toEqual([{ field: 'id', message: 'Identificador inválido' }]);
      expect(service.getUser).not.toHaveBeenCalled();
    });

    it('responde 404 quando o service lança UserNotFoundError', async () => {
      service.getUser.mockRejectedValue(new UserNotFoundError());

      const response = await app.inject({ method: 'GET', url: `/users/${createdUser.id}` });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({
        error: 'USER_NOT_FOUND',
        message: 'Usuário não encontrado',
        statusCode: 404,
      });
    });
  });

  describe('update', () => {
    const patch = (id: string, payload: object) => app.inject({ method: 'PATCH', url: `/users/${id}`, payload });

    it('altera o e-mail normalizado e responde 200 sem senha', async () => {
      const response = await patch(createdUser.id, { email: '  Novo@Exemplo.com ' });

      expect(response.statusCode).toBe(200);
      expect(service.updateUser).toHaveBeenCalledWith(createdUser.id, { email: 'novo@exemplo.com' });
      expect(response.body).not.toContain('password');
      expect(response.body).not.toContain('hash');
    });

    it('altera só a senha e nunca a devolve', async () => {
      const response = await patch(createdUser.id, { password: 'nova-senha-123' });

      expect(response.statusCode).toBe(200);
      expect(service.updateUser).toHaveBeenCalledWith(createdUser.id, { password: 'nova-senha-123' });
      expect(response.body).not.toContain('nova-senha-123');
    });

    it('recusa id malformado com 400, sem chamar o service', async () => {
      const response = await patch('abc', { email: 'novo@exemplo.com' });

      expect(response.statusCode).toBe(400);
      expect(response.json().issues).toEqual([{ field: 'id', message: 'Identificador inválido' }]);
      expect(service.updateUser).not.toHaveBeenCalled();
    });

    it('valida o id antes do corpo', async () => {
      const response = await patch('abc', {});

      expect(response.json().issues).toEqual([{ field: 'id', message: 'Identificador inválido' }]);
    });

    it('recusa corpo vazio pedindo ao menos um campo', async () => {
      const response = await patch(createdUser.id, {});

      expect(response.statusCode).toBe(400);
      expect(response.json().issues).toEqual([
        { field: 'body', message: 'Informe ao menos um campo para alterar (email ou password)' },
      ]);
      expect(service.updateUser).not.toHaveBeenCalled();
    });

    it.each([
      ['id', { id: createdUser.id }],
      ['isActive', { isActive: false }],
      ['createdAt', { createdAt: '2026-01-01' }],
      ['updatedAt', { updatedAt: '2026-01-01' }],
    ])('recusa o campo não permitido %s', async (_name, extra) => {
      const response = await patch(createdUser.id, { email: 'novo@exemplo.com', ...extra });

      expect(response.statusCode).toBe(400);
      expect(service.updateUser).not.toHaveBeenCalled();
    });

    it.each([
      ['e-mail inválido', { email: 'invalido' }, 'email'],
      ['senha com 7 caracteres', { password: '1234567' }, 'password'],
      ['senha com 73 caracteres', { password: 'a'.repeat(73) }, 'password'],
    ])('recusa com 400: %s', async (_name, payload, field) => {
      const response = await patch(createdUser.id, payload);

      expect(response.statusCode).toBe(400);
      expect(response.json().issues.map((issue: { field: string }) => issue.field)).toContain(field);
      expect(service.updateUser).not.toHaveBeenCalled();
    });

    it('responde 404 quando o service lança UserNotFoundError', async () => {
      service.updateUser.mockRejectedValue(new UserNotFoundError());

      const response = await patch(createdUser.id, { email: 'novo@exemplo.com' });

      expect(response.statusCode).toBe(404);
      expect(response.json().error).toBe('USER_NOT_FOUND');
    });

    it('responde 409 quando o service lança UsedEmailError', async () => {
      service.updateUser.mockRejectedValue(new UsedEmailError());

      const response = await patch(createdUser.id, { email: 'outro@exemplo.com' });

      expect(response.statusCode).toBe(409);
      expect(response.json().message).toBe('E-mail já está em uso');
    });
  });

  describe('remove', () => {
    const remove = (id: string) => app.inject({ method: 'DELETE', url: `/users/${id}` });

    it('responde 204 sem corpo e desativa pelo id', async () => {
      const response = await remove(createdUser.id);

      expect(response.statusCode).toBe(204);
      expect(response.body).toBe('');
      expect(service.deactivateUser).toHaveBeenCalledWith(createdUser.id);
    });

    it('recusa id malformado com 400, sem chamar o service', async () => {
      const response = await remove('abc');

      expect(response.statusCode).toBe(400);
      expect(response.json().issues).toEqual([{ field: 'id', message: 'Identificador inválido' }]);
      expect(service.deactivateUser).not.toHaveBeenCalled();
    });

    it('responde 404 quando o service lança UserNotFoundError', async () => {
      service.deactivateUser.mockRejectedValue(new UserNotFoundError());

      const response = await remove(createdUser.id);

      expect(response.statusCode).toBe(404);
      expect(response.json().message).toBe('Usuário não encontrado');
    });
  });
});
