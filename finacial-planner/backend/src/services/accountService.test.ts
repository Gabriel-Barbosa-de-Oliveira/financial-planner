import { describe, it, expect, jest } from '@jest/globals';
import { createAccountService } from './accountService.ts';
import type { Account, AccountRepository } from '../repositories/accountRepository.ts';
import { AccountNotFoundError, UsedAccountNameError, WorkspaceUnavailableError } from '../utils/errors.ts';

const account: Account = {
  id: '6f1d3c1e-0c4b-4f0e-9d1a-2b7a8f3c9e10',
  name: 'Nubank',
  type: 'BANK',
  balance: '1500.00',
  isActive: true,
  createdAt: new Date('2026-11-02T10:00:00Z'),
  updatedAt: new Date('2026-11-02T10:00:00Z'),
};

function setup() {
  const repository = {
    create: jest.fn<AccountRepository['create']>().mockResolvedValue(account),
    findAll: jest.fn<AccountRepository['findAll']>().mockResolvedValue([account]),
    findById: jest.fn<AccountRepository['findById']>().mockResolvedValue(account),
    update: jest.fn<AccountRepository['update']>().mockResolvedValue(account),
    deactivate: jest.fn<AccountRepository['deactivate']>().mockResolvedValue(true),
  };
  return { repository, service: createAccountService({ repository }) };
}

describe('createAccountService', () => {
  describe('createAccount', () => {
    it('repassa os dados ao repository e devolve a conta', async () => {
      const { repository, service } = setup();
      const input = { name: 'Nubank', type: 'BANK' as const, balance: '1500.00' };

      await expect(service.createAccount(input)).resolves.toEqual(account);
      expect(repository.create).toHaveBeenCalledWith(input);
    });

    it('lança WorkspaceUnavailableError quando o repository não insere nada', async () => {
      const { repository, service } = setup();
      repository.create.mockResolvedValue(null);

      await expect(service.createAccount({ name: 'A', type: 'CASH', balance: '0.00' })).rejects.toBeInstanceOf(
        WorkspaceUnavailableError,
      );
    });

    it('propaga UsedAccountNameError', async () => {
      const { repository, service } = setup();
      repository.create.mockRejectedValue(new UsedAccountNameError());

      await expect(service.createAccount({ name: 'A', type: 'CASH', balance: '0.00' })).rejects.toBeInstanceOf(
        UsedAccountNameError,
      );
    });
  });

  describe('listAccounts', () => {
    it('devolve as contas do repository, inclusive lista vazia', async () => {
      const { repository, service } = setup();

      await expect(service.listAccounts()).resolves.toEqual([account]);
      repository.findAll.mockResolvedValue([]);
      await expect(service.listAccounts()).resolves.toEqual([]);
    });
  });

  describe('getAccount', () => {
    it('devolve a conta encontrada', async () => {
      const { repository, service } = setup();

      await expect(service.getAccount(account.id)).resolves.toEqual(account);
      expect(repository.findById).toHaveBeenCalledWith(account.id);
    });

    it('lança AccountNotFoundError quando não encontra', async () => {
      const { repository, service } = setup();
      repository.findById.mockResolvedValue(null);

      await expect(service.getAccount(account.id)).rejects.toBeInstanceOf(AccountNotFoundError);
    });
  });

  describe('updateAccount', () => {
    it('repassa só os campos informados e devolve a conta', async () => {
      const { repository, service } = setup();

      await expect(service.updateAccount(account.id, { name: 'Nubank PJ' })).resolves.toEqual(account);
      expect(repository.update).toHaveBeenCalledWith(account.id, { name: 'Nubank PJ' });
    });

    it('lança AccountNotFoundError quando não há conta ativa', async () => {
      const { repository, service } = setup();
      repository.update.mockResolvedValue(null);

      await expect(service.updateAccount(account.id, { type: 'CASH' })).rejects.toBeInstanceOf(AccountNotFoundError);
    });

    it('propaga UsedAccountNameError', async () => {
      const { repository, service } = setup();
      repository.update.mockRejectedValue(new UsedAccountNameError());

      await expect(service.updateAccount(account.id, { name: 'X' })).rejects.toBeInstanceOf(UsedAccountNameError);
    });
  });

  describe('deactivateAccount', () => {
    it('desativa e não devolve nada', async () => {
      const { repository, service } = setup();

      await expect(service.deactivateAccount(account.id)).resolves.toBeUndefined();
      expect(repository.deactivate).toHaveBeenCalledWith(account.id);
    });

    it('lança AccountNotFoundError quando não há conta ativa', async () => {
      const { repository, service } = setup();
      repository.deactivate.mockResolvedValue(false);

      await expect(service.deactivateAccount(account.id)).rejects.toBeInstanceOf(AccountNotFoundError);
    });
  });
});
