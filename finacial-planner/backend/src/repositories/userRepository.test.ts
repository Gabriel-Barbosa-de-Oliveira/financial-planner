import { describe, it, expect, jest } from '@jest/globals';
import { createUserRepository } from './userRepository.ts';
import type { Query, User } from './userRepository.ts';
import { UsedEmailError } from '../utils/errors.ts';

const storedUser: User = {
  id: '6f1d3c1e-0c4b-4f0e-9d1a-2b7a8f3c9e10',
  email: 'ana@exemplo.com',
  isActive: true,
  createdAt: new Date('2026-11-02T10:00:00Z'),
  updatedAt: new Date('2026-11-02T10:00:00Z'),
};

describe('createUserRepository', () => {
  it('insere com SQL parametrizado e devolve o usuário sem o hash', async () => {
    const query = jest.fn<Query>().mockResolvedValue({ rows: [storedUser] });
    const repository = createUserRepository(query);

    const user = await repository.create({ email: 'ana@exemplo.com', passwordHash: 'scrypt$hash' });

    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('VALUES ($1, $2)');
    expect(sql).not.toContain('ana@exemplo.com');
    expect(sql).not.toContain('scrypt$hash');
    expect(sql).not.toMatch(/RETURNING[^]*password_hash/);
    expect(params).toEqual(['ana@exemplo.com', 'scrypt$hash']);
    expect(user).toEqual(storedUser);
    expect(user).not.toHaveProperty('password_hash');
  });

  it('não envia id, isActive nem datas na inserção', async () => {
    const query = jest.fn<Query>().mockResolvedValue({ rows: [storedUser] });

    await createUserRepository(query).create({ email: 'ana@exemplo.com', passwordHash: 'h' });

    const insertColumns = query.mock.calls[0][0].match(/INSERT INTO users \(([^)]*)\)/)?.[1];
    expect(insertColumns?.replace(/\s/g, '')).toBe('email,password_hash');
  });

  it('traduz a violação do índice de e-mail ativo em UsedEmailError', async () => {
    const violation = Object.assign(new Error('duplicate key'), {
      code: '23505',
      constraint: 'idx_users_email_active',
    });
    const query = jest.fn<Query>().mockRejectedValue(violation);

    await expect(
      createUserRepository(query).create({ email: 'ana@exemplo.com', passwordHash: 'h' }),
    ).rejects.toBeInstanceOf(UsedEmailError);
  });

  it('repassa outros erros do banco sem traduzir', async () => {
    const failure = new Error('connection refused');
    const query = jest.fn<Query>().mockRejectedValue(failure);

    await expect(
      createUserRepository(query).create({ email: 'ana@exemplo.com', passwordHash: 'h' }),
    ).rejects.toBe(failure);
  });

  it('repassa violações de unicidade de outras constraints', async () => {
    const other = Object.assign(new Error('duplicate key'), { code: '23505', constraint: 'users_pkey' });
    const query = jest.fn<Query>().mockRejectedValue(other);

    await expect(
      createUserRepository(query).create({ email: 'ana@exemplo.com', passwordHash: 'h' }),
    ).rejects.toBe(other);
  });
});
