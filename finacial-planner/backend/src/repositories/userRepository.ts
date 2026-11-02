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

export type UserRepository = {
  create: (newUser: NewUser) => Promise<User>;
};

const UNIQUE_VIOLATION = '23505';
const ACTIVE_EMAIL_INDEX = 'idx_users_email_active';

const INSERT_USER = `
  INSERT INTO users (email, password_hash)
  VALUES ($1, $2)
  RETURNING id, email, isactive AS "isActive", createdat AS "createdAt", updatedat AS "updatedAt"
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
  };
}
