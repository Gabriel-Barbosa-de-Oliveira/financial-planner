import { UsedEmailError } from '../utils/errors.ts';

export type User = {
  id: string;
  email: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type NewUser = {
  email: string;
  passwordHash: string;
};

export type Query = (text: string, params: unknown[]) => Promise<{ rows: User[] }>;

export type UserChanges = {
  email?: string;
  passwordHash?: string;
};

export type UserRepository = {
  create: (newUser: NewUser) => Promise<User>;
  findAll: () => Promise<User[]>;
  findById: (id: string) => Promise<User | null>;
  update: (id: string, changes: UserChanges) => Promise<User | null>;
  deactivate: (id: string) => Promise<boolean>;
};

const UNIQUE_VIOLATION = '23505';
const ACTIVE_EMAIL_INDEX = 'idx_users_email_active';

const PUBLIC_COLUMNS = `id, email, isactive AS "isActive", createdat AS "createdAt", updatedat AS "updatedAt"`;

const INSERT_USER = `
  INSERT INTO users (email, password_hash)
  VALUES ($1, $2)
  RETURNING ${PUBLIC_COLUMNS}
`;

const SELECT_ACTIVE_USERS = `
  SELECT ${PUBLIC_COLUMNS}
  FROM users
  WHERE isactive = TRUE
  ORDER BY createdat ASC, id ASC
`;

const UPDATE_ACTIVE_USER = `
  UPDATE users
  SET email = COALESCE($2, email),
      password_hash = COALESCE($3, password_hash),
      updatedat = NOW()
  WHERE id = $1 AND isactive = TRUE
  RETURNING ${PUBLIC_COLUMNS}
`;

// Remoção é sempre lógica: o registro continua na tabela com isactive = FALSE
const DEACTIVATE_ACTIVE_USER = `
  UPDATE users
  SET isactive = FALSE,
      updatedat = NOW()
  WHERE id = $1 AND isactive = TRUE
  RETURNING ${PUBLIC_COLUMNS}
`;

const SELECT_ACTIVE_USER_BY_ID = `
  SELECT ${PUBLIC_COLUMNS}
  FROM users
  WHERE id = $1 AND isactive = TRUE
`;

function isUsedEmailViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const { code, constraint } = error as { code?: string; constraint?: string };
  return code === UNIQUE_VIOLATION && constraint === ACTIVE_EMAIL_INDEX;
}

export function createUserRepository(query: Query): UserRepository {
  return {
    async create({ email, passwordHash }) {
      try {
        const result = await query(INSERT_USER, [email, passwordHash]);
        return result.rows[0];
      } catch (error) {
        if (isUsedEmailViolation(error)) throw new UsedEmailError();
        throw error;
      }
    },

    async findAll() {
      const result = await query(SELECT_ACTIVE_USERS, []);
      return result.rows;
    },

    async findById(id) {
      const result = await query(SELECT_ACTIVE_USER_BY_ID, [id]);
      return result.rows[0] ?? null;
    },

    async update(id, { email, passwordHash }) {
      try {
        const result = await query(UPDATE_ACTIVE_USER, [id, email ?? null, passwordHash ?? null]);
        return result.rows[0] ?? null;
      } catch (error) {
        if (isUsedEmailViolation(error)) throw new UsedEmailError();
        throw error;
      }
    },

    async deactivate(id) {
      const result = await query(DEACTIVATE_ACTIVE_USER, [id]);
      return result.rows.length > 0;
    },
  };
}
