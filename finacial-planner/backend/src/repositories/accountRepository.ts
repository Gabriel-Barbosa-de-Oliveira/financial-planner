import type { AccountType } from '../config/account.ts';
import { UsedAccountNameError } from '../utils/errors.ts';

export type Account = {
  id: string;
  name: string;
  type: AccountType;
  balance: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type NewAccount = {
  name: string;
  type: AccountType;
  balance: string;
};

export type AccountChanges = {
  name?: string;
  type?: AccountType;
};

export type Query = (text: string, params: unknown[]) => Promise<{ rows: Account[] }>;

export type AccountRepository = {
  create: (newAccount: NewAccount) => Promise<Account | null>;
  findAll: () => Promise<Account[]>;
  findById: (id: string) => Promise<Account | null>;
  update: (id: string, changes: AccountChanges) => Promise<Account | null>;
  deactivate: (id: string) => Promise<boolean>;
};

const UNIQUE_VIOLATION = '23505';
const ACTIVE_NAME_INDEX = 'idx_accounts_name_active';

const PUBLIC_COLUMNS = `id, name, type, balance, isactive AS "isActive", createdat AS "createdAt", updatedat AS "updatedAt"`;

// $1 é sempre o nome do workspace padrão; o id é resolvido no próprio SQL
const DEFAULT_WORKSPACE_ID = `(SELECT id FROM workspaces WHERE name = $1 AND isactive = TRUE ORDER BY createdat ASC, id ASC LIMIT 1)`;

const INSERT_ACCOUNT = `
  INSERT INTO accounts (workspaceid, name, type, balance)
  SELECT w.id, $2, $3, $4
  FROM workspaces w
  WHERE w.name = $1 AND w.isactive = TRUE
  ORDER BY w.createdat ASC, w.id ASC
  LIMIT 1
  RETURNING ${PUBLIC_COLUMNS}
`;

const SELECT_ACTIVE_ACCOUNTS = `
  SELECT ${PUBLIC_COLUMNS}
  FROM accounts
  WHERE isactive = TRUE AND workspaceid = ${DEFAULT_WORKSPACE_ID}
  ORDER BY createdat ASC, id ASC
`;

const SELECT_ACTIVE_ACCOUNT_BY_ID = `
  SELECT ${PUBLIC_COLUMNS}
  FROM accounts
  WHERE id = $2 AND isactive = TRUE AND workspaceid = ${DEFAULT_WORKSPACE_ID}
`;

// Não referencia balance: o saldo não muda por alteração de cadastro
const UPDATE_ACTIVE_ACCOUNT = `
  UPDATE accounts
  SET name = COALESCE($3, name),
      type = COALESCE($4, type),
      updatedat = NOW()
  WHERE id = $2 AND isactive = TRUE AND workspaceid = ${DEFAULT_WORKSPACE_ID}
  RETURNING ${PUBLIC_COLUMNS}
`;

// Remoção é sempre lógica: o registro continua na tabela com isactive = FALSE
const DEACTIVATE_ACTIVE_ACCOUNT = `
  UPDATE accounts
  SET isactive = FALSE,
      updatedat = NOW()
  WHERE id = $2 AND isactive = TRUE AND workspaceid = ${DEFAULT_WORKSPACE_ID}
  RETURNING ${PUBLIC_COLUMNS}
`;

function isUsedNameViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const { code, constraint } = error as { code?: string; constraint?: string };
  return code === UNIQUE_VIOLATION && constraint === ACTIVE_NAME_INDEX;
}

export function createAccountRepository(query: Query, workspaceName: string): AccountRepository {
  return {
    async create({ name, type, balance }) {
      try {
        const result = await query(INSERT_ACCOUNT, [workspaceName, name, type, balance]);
        return result.rows[0] ?? null;
      } catch (error) {
        if (isUsedNameViolation(error)) throw new UsedAccountNameError();
        throw error;
      }
    },

    async findAll() {
      const result = await query(SELECT_ACTIVE_ACCOUNTS, [workspaceName]);
      return result.rows;
    },

    async findById(id) {
      const result = await query(SELECT_ACTIVE_ACCOUNT_BY_ID, [workspaceName, id]);
      return result.rows[0] ?? null;
    },

    async update(id, { name, type }) {
      try {
        const result = await query(UPDATE_ACTIVE_ACCOUNT, [workspaceName, id, name ?? null, type ?? null]);
        return result.rows[0] ?? null;
      } catch (error) {
        if (isUsedNameViolation(error)) throw new UsedAccountNameError();
        throw error;
      }
    },

    async deactivate(id) {
      const result = await query(DEACTIVATE_ACTIVE_ACCOUNT, [workspaceName, id]);
      return result.rows.length > 0;
    },
  };
}
