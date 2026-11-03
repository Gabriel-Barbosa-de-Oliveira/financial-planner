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

  describe('findAll', () => {
    it('lista só ativos, em ordem de criação, sem o hash', async () => {
      const query = jest.fn<Query>().mockResolvedValue({ rows: [storedUser] });

      const users = await createUserRepository(query).findAll();

      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain('isactive = TRUE');
      expect(sql).toContain('ORDER BY createdat ASC, id ASC');
      expect(sql).not.toContain('password_hash');
      expect(params).toEqual([]);
      expect(users).toEqual([storedUser]);
    });

    it('devolve lista vazia quando não há ativos', async () => {
      const query = jest.fn<Query>().mockResolvedValue({ rows: [] });

      await expect(createUserRepository(query).findAll()).resolves.toEqual([]);
    });

    it('repassa erros do banco', async () => {
      const failure = new Error('connection refused');
      const query = jest.fn<Query>().mockRejectedValue(failure);

      await expect(createUserRepository(query).findAll()).rejects.toBe(failure);
    });
  });

  describe('findById', () => {
    it('consulta com o id parametrizado e filtra ativos', async () => {
      const query = jest.fn<Query>().mockResolvedValue({ rows: [storedUser] });

      const user = await createUserRepository(query).findById(storedUser.id);

      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain('id = $1');
      expect(sql).toContain('isactive = TRUE');
      expect(sql).not.toContain(storedUser.id);
      expect(sql).not.toContain('password_hash');
      expect(params).toEqual([storedUser.id]);
      expect(user).toEqual(storedUser);
    });

    it('devolve null quando nenhuma linha casa', async () => {
      const query = jest.fn<Query>().mockResolvedValue({ rows: [] });

      await expect(createUserRepository(query).findById(storedUser.id)).resolves.toBeNull();
    });

    it('repassa erros do banco', async () => {
      const failure = new Error('connection refused');
      const query = jest.fn<Query>().mockRejectedValue(failure);

      await expect(createUserRepository(query).findById(storedUser.id)).rejects.toBe(failure);
    });
  });

  describe('update', () => {
    const updatedUser: User = { ...storedUser, email: 'novo@exemplo.com', updatedAt: new Date('2026-11-03T10:00:00Z') };

    it('usa SQL estático e parametrizado, filtra ativos e renova updatedat', async () => {
      const query = jest.fn<Query>().mockResolvedValue({ rows: [updatedUser] });

      const user = await createUserRepository(query).update(storedUser.id, {
        email: 'novo@exemplo.com',
        passwordHash: 'scrypt$novo',
      });

      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain('WHERE id = $1 AND isactive = TRUE');
      expect(sql).toContain('updatedat = NOW()');
      expect(sql).not.toContain('novo@exemplo.com');
      expect(sql).not.toContain('scrypt$novo');
      expect(sql).not.toMatch(/RETURNING[^]*password_hash/);
      expect(params).toEqual([storedUser.id, 'novo@exemplo.com', 'scrypt$novo']);
      expect(user).toEqual(updatedUser);
      expect(user).not.toHaveProperty('password_hash');
    });

    it('envia null para o campo não informado', async () => {
      const query = jest.fn<Query>().mockResolvedValue({ rows: [updatedUser] });
      const repository = createUserRepository(query);

      await repository.update(storedUser.id, { email: 'novo@exemplo.com' });
      await repository.update(storedUser.id, { passwordHash: 'scrypt$novo' });

      expect(query.mock.calls[0][1]).toEqual([storedUser.id, 'novo@exemplo.com', null]);
      expect(query.mock.calls[1][1]).toEqual([storedUser.id, null, 'scrypt$novo']);
    });

    it('devolve null quando nenhuma linha é afetada (inexistente ou desativado)', async () => {
      const query = jest.fn<Query>().mockResolvedValue({ rows: [] });

      await expect(
        createUserRepository(query).update(storedUser.id, { email: 'novo@exemplo.com' }),
      ).resolves.toBeNull();
    });

    it('traduz a violação do índice de e-mail ativo em UsedEmailError', async () => {
      const violation = Object.assign(new Error('duplicate key'), {
        code: '23505',
        constraint: 'idx_users_email_active',
      });
      const query = jest.fn<Query>().mockRejectedValue(violation);

      await expect(
        createUserRepository(query).update(storedUser.id, { email: 'outro@exemplo.com' }),
      ).rejects.toBeInstanceOf(UsedEmailError);
    });

    it('repassa violações de outras constraints e outros erros sem traduzir', async () => {
      const other = Object.assign(new Error('duplicate key'), { code: '23505', constraint: 'users_pkey' });
      const failure = new Error('connection refused');
      const repository = (error: Error) => createUserRepository(jest.fn<Query>().mockRejectedValue(error));

      await expect(repository(other).update(storedUser.id, { email: 'a@exemplo.com' })).rejects.toBe(other);
      await expect(repository(failure).update(storedUser.id, { email: 'a@exemplo.com' })).rejects.toBe(failure);
    });
  });

  describe('deactivate', () => {
    it('desativa logicamente, filtra ativos e renova updatedat', async () => {
      const query = jest.fn<Query>().mockResolvedValue({ rows: [{ ...storedUser, isActive: false }] });

      const deactivated = await createUserRepository(query).deactivate(storedUser.id);

      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain('isactive = FALSE');
      expect(sql).toContain('updatedat = NOW()');
      expect(sql).toContain('WHERE id = $1 AND isactive = TRUE');
      expect(sql).not.toContain(storedUser.id);
      expect(sql).not.toMatch(/RETURNING[^]*password_hash/);
      expect(params).toEqual([storedUser.id]);
      expect(deactivated).toBe(true);
    });

    it('devolve false quando nenhuma linha é afetada (inexistente ou já desativado)', async () => {
      const query = jest.fn<Query>().mockResolvedValue({ rows: [] });

      await expect(createUserRepository(query).deactivate(storedUser.id)).resolves.toBe(false);
    });

    it('repassa erros do banco', async () => {
      const failure = new Error('connection refused');
      const query = jest.fn<Query>().mockRejectedValue(failure);

      await expect(createUserRepository(query).deactivate(storedUser.id)).rejects.toBe(failure);
    });
  });

  it('nenhum método do repository emite DELETE (exclusão é sempre lógica)', async () => {
    const query = jest.fn<Query>().mockResolvedValue({ rows: [storedUser] });
    const repository = createUserRepository(query);

    await repository.create({ email: 'ana@exemplo.com', passwordHash: 'h' });
    await repository.findAll();
    await repository.findById(storedUser.id);
    await repository.update(storedUser.id, { email: 'novo@exemplo.com' });
    await repository.deactivate(storedUser.id);

    expect(query.mock.calls).toHaveLength(5);
    query.mock.calls.forEach(([sql]) => expect(sql).not.toMatch(/\bDELETE\b/i));
  });
});
