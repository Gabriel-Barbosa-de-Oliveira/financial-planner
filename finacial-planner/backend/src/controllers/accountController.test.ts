import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { createServer } from '../server.ts';
import { createAccountController } from './accountController.ts';
import type { AccountService } from '../services/accountService.ts';
import { AccountNotFoundError, UsedAccountNameError, WorkspaceUnavailableError } from '../utils/errors.ts';

const account = {
  id: '6f1d3c1e-0c4b-4f0e-9d1a-2b7a8f3c9e10',
  name: 'Nubank',
  type: 'BANK' as const,
  balance: '1500.00',
  isActive: true,
  createdAt: new Date('2026-11-02T10:00:00Z'),
  updatedAt: new Date('2026-11-02T10:00:00Z'),
};

describe('createAccountController', () => {
  let app: Awaited<ReturnType<typeof createServer>>;
  let service: { [K in keyof AccountService]: jest.Mock<AccountService[K]> };

  beforeEach(async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    service = {
      createAccount: jest.fn<AccountService['createAccount']>().mockResolvedValue(account),
      listAccounts: jest.fn<AccountService['listAccounts']>().mockResolvedValue([account]),
      getAccount: jest.fn<AccountService['getAccount']>().mockResolvedValue(account),
      updateAccount: jest.fn<AccountService['updateAccount']>().mockResolvedValue(account),
      deactivateAccount: jest.fn<AccountService['deactivateAccount']>().mockResolvedValue(undefined),
    };
    const controller = createAccountController(service);
    app = await createServer(false);
    app.post('/accounts', controller.create);
    app.get('/accounts', controller.list);
    app.get('/accounts/:id', controller.getById);
    app.patch('/accounts/:id', controller.update);
    app.delete('/accounts/:id', controller.remove);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    jest.restoreAllMocks();
  });

  const post = (payload: object) => app.inject({ method: 'POST', url: '/accounts', payload });
  const patch = (id: string, payload: object) => app.inject({ method: 'PATCH', url: `/accounts/${id}`, payload });

  describe('create', () => {
    it('cria com nome aparado e saldo informado e responde 201', async () => {
      const response = await post({ name: '  Nubank ', type: 'BANK', balance: '1500.00' });

      expect(response.statusCode).toBe(201);
      expect(service.createAccount).toHaveBeenCalledWith({ name: 'Nubank', type: 'BANK', balance: '1500.00' });
      expect(response.json()).toMatchObject({ id: account.id, name: 'Nubank', balance: '1500.00', isActive: true });
    });

    it('usa saldo 0.00 quando não informado', async () => {
      await post({ name: 'Carteira', type: 'CASH' });

      expect(service.createAccount).toHaveBeenCalledWith({ name: 'Carteira', type: 'CASH', balance: '0.00' });
    });

    it('responde 400 com issues por campo e não chama o service', async () => {
      const response = await post({ name: '', type: 'XYZ', balance: '1,5' });

      expect(response.statusCode).toBe(400);
      expect(response.json().issues.map((issue: { field: string }) => issue.field).sort()).toEqual([
        'balance',
        'name',
        'type',
      ]);
      expect(service.createAccount).not.toHaveBeenCalled();
    });

    it('responde 400 para campos proibidos', async () => {
      expect((await post({ name: 'A', type: 'CASH', isActive: false })).statusCode).toBe(400);
      expect((await post({ name: 'A', type: 'CASH', workspaceId: account.id })).statusCode).toBe(400);
      expect(service.createAccount).not.toHaveBeenCalled();
    });

    it('traduz nome repetido em 409 e workspace ausente em 422', async () => {
      service.createAccount.mockRejectedValueOnce(new UsedAccountNameError());
      const used = await post({ name: 'Nubank', type: 'BANK' });
      expect(used.statusCode).toBe(409);
      expect(used.json().message).toBe('Já existe uma conta com este nome');

      service.createAccount.mockRejectedValueOnce(new WorkspaceUnavailableError());
      const missing = await post({ name: 'Nubank', type: 'BANK' });
      expect(missing.statusCode).toBe(422);
    });

    it('responde 500 genérico em erro inesperado, sem detalhes', async () => {
      service.createAccount.mockRejectedValueOnce(new Error('connection refused to 10.0.0.1'));

      const response = await post({ name: 'Nubank', type: 'BANK' });

      expect(response.statusCode).toBe(500);
      expect(response.body).not.toContain('10.0.0.1');
    });
  });

  describe('list e getById', () => {
    it('lista com 200', async () => {
      const response = await app.inject({ method: 'GET', url: '/accounts' });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toHaveLength(1);
    });

    it('consulta por id com 200', async () => {
      const response = await app.inject({ method: 'GET', url: `/accounts/${account.id}` });

      expect(response.statusCode).toBe(200);
      expect(service.getAccount).toHaveBeenCalledWith(account.id);
    });

    it('responde 400 para id inválido sem chamar o service e 404 para inexistente', async () => {
      const invalid = await app.inject({ method: 'GET', url: '/accounts/abc' });
      expect(invalid.statusCode).toBe(400);
      expect(invalid.json().issues[0].message).toBe('Identificador inválido');
      expect(service.getAccount).not.toHaveBeenCalled();

      service.getAccount.mockRejectedValueOnce(new AccountNotFoundError());
      const missing = await app.inject({ method: 'GET', url: `/accounts/${account.id}` });
      expect(missing.statusCode).toBe(404);
      expect(missing.json().message).toBe('Conta não encontrada');
    });
  });

  describe('update', () => {
    it('altera nome e tipo com 200', async () => {
      const response = await patch(account.id, { name: ' Nubank PJ ', type: 'SAVINGS' });

      expect(response.statusCode).toBe(200);
      expect(service.updateAccount).toHaveBeenCalledWith(account.id, { name: 'Nubank PJ', type: 'SAVINGS' });
    });

    it('responde 400 para corpo vazio, balance e campos proibidos', async () => {
      expect((await patch(account.id, {})).statusCode).toBe(400);
      expect((await patch(account.id, { balance: '10.00' })).statusCode).toBe(400);
      expect((await patch(account.id, { name: 'A', isActive: false })).statusCode).toBe(400);
      expect(service.updateAccount).not.toHaveBeenCalled();
    });

    it('responde 400 para id inválido, 404 para inexistente e 409 para nome em uso', async () => {
      expect((await patch('abc', { name: 'A' })).statusCode).toBe(400);

      service.updateAccount.mockRejectedValueOnce(new AccountNotFoundError());
      expect((await patch(account.id, { name: 'A' })).statusCode).toBe(404);

      service.updateAccount.mockRejectedValueOnce(new UsedAccountNameError());
      expect((await patch(account.id, { name: 'A' })).statusCode).toBe(409);
    });
  });

  describe('remove', () => {
    it('desativa com 204 e sem corpo', async () => {
      const response = await app.inject({ method: 'DELETE', url: `/accounts/${account.id}` });

      expect(response.statusCode).toBe(204);
      expect(response.body).toBe('');
      expect(service.deactivateAccount).toHaveBeenCalledWith(account.id);
    });

    it('responde 400 para id inválido e 404 para inexistente', async () => {
      expect((await app.inject({ method: 'DELETE', url: '/accounts/abc' })).statusCode).toBe(400);
      expect(service.deactivateAccount).not.toHaveBeenCalled();

      service.deactivateAccount.mockRejectedValueOnce(new AccountNotFoundError());
      expect((await app.inject({ method: 'DELETE', url: `/accounts/${account.id}` })).statusCode).toBe(404);
    });
  });
});
