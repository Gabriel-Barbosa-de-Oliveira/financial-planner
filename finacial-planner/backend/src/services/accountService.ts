import type { Account, AccountRepository } from '../repositories/accountRepository.ts';
import type { AccountType } from '../config/account.ts';
import { AccountNotFoundError, WorkspaceUnavailableError } from '../utils/errors.ts';

export type CreateAccountInput = {
  name: string;
  type: AccountType;
  balance: string;
};

export type UpdateAccountInput = {
  name?: string;
  type?: AccountType;
};

export type AccountService = {
  createAccount: (input: CreateAccountInput) => Promise<Account>;
  listAccounts: () => Promise<Account[]>;
  getAccount: (id: string) => Promise<Account>;
  updateAccount: (id: string, input: UpdateAccountInput) => Promise<Account>;
  deactivateAccount: (id: string) => Promise<void>;
};

export type AccountServiceDependencies = {
  repository: AccountRepository;
};

export function createAccountService({ repository }: AccountServiceDependencies): AccountService {
  return {
    async createAccount(input) {
      const account = await repository.create(input);
      if (!account) throw new WorkspaceUnavailableError();
      return account;
    },

    listAccounts() {
      return repository.findAll();
    },

    async getAccount(id) {
      const account = await repository.findById(id);
      if (!account) throw new AccountNotFoundError();
      return account;
    },

    async updateAccount(id, input) {
      const account = await repository.update(id, input);
      if (!account) throw new AccountNotFoundError();
      return account;
    },

    async deactivateAccount(id) {
      const deactivated = await repository.deactivate(id);
      if (!deactivated) throw new AccountNotFoundError();
    },
  };
}
