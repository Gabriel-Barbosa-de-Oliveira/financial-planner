import { describe, it, expect, jest } from '@jest/globals';
import { createAccountRepository } from './accountRepository.ts';
import type { Account, Query } from './accountRepository.ts';
import { UsedAccountNameError } from '../utils/errors.ts';

const WORKSPACE = 'familia';
const ID = '6f1d3c1e-0c4b-4f0e-9d1a-2b7a8f3c9e10';

const stored: Account = {
  id: ID,
  name: 'Nubank',
  type: 'BANK',
  balance: '1500.00',
  isActive: true,
  createdAt: new Date('2026-11-02T10:00:00Z'),
  updatedAt: new Date('2026-11-02T10:00:00Z'),
};

const nameViolation = Object.assign(new Error('duplicate key'), {
  code: '23505',
  constraint: 'idx_accounts_name_active',
});

function setup(rows: Account[] = [stored]) {
  const query = jest.fn<Query>().mockResolvedValue({ rows });
  return { query, repository: createAccountRepository(query, WORKSPACE) };
}

describe('createAccountRepository', () => {
  describe('create', () => {
    it('insere com SQL parametrizado, resolvendo o workspace pelo nome, e devolve a conta', async () => {
      const { query, repository } = setup();

      const account = await repository.create({ name: 'Nubank', type: 'BANK', balance: '1500.00' });

      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain('SELECT w.id, $2, $3, $4');
      expect(sql).toContain('w.name = $1');
      expect(sql).not.toContain('Nubank');
      expect(sql).not.toContain('familia');
      expect(params).toEqual([WORKSPACE, 'Nubank', 'BANK', '1500.00']);
      expect(account).toEqual(stored);
    });

    it('devolve o saldo como o banco entrega (texto), sem converter', async () => {
      const { repository } = setup([{ ...stored, balance: '0.10' }]);

      const account = await repository.create({ name: 'Nubank', type: 'BANK', balance: '0.10' });

      expect(account?.balance).toBe('0.10');
    });

    it('não envia id, isActive, datas nem workspace do cliente na inserção', async () => {
      const { query, repository } = setup();

      await repository.create({ name: 'Nubank', type: 'BANK', balance: '0.00' });

      const columns = query.mock.calls[0][0].match(/INSERT INTO accounts \(([^)]*)\)/)?.[1];
      expect(columns?.replace(/\s/g, '')).toBe('workspaceid,name,type,balance');
    });

    it('devolve null quando o workspace padrão não existe (nenhuma linha inserida)', async () => {
      const { repository } = setup([]);

      await expect(repository.create({ name: 'Nubank', type: 'BANK', balance: '0.00' })).resolves.toBeNull();
    });

    it('traduz a violação do índice de nome ativo em UsedAccountNameError', async () => {
      const query = jest.fn<Query>().mockRejectedValue(nameViolation);

      await expect(
        createAccountRepository(query, WORKSPACE).create({ name: 'Nubank', type: 'BANK', balance: '0.00' }),
      ).rejects.toBeInstanceOf(UsedAccountNameError);
    });

    it('repassa outros erros do banco, inclusive outra violação de unicidade', async () => {
      const other = Object.assign(new Error('duplicate'), { code: '23505', constraint: 'accounts_pkey' });
      for (const failure of [new Error('connection refused'), other]) {
        const query = jest.fn<Query>().mockRejectedValue(failure);
        await expect(
          createAccountRepository(query, WORKSPACE).create({ name: 'Nubank', type: 'BANK', balance: '0.00' }),
        ).rejects.toBe(failure);
      }
    });
  });

  describe('findAll', () => {
    it('lista só as ativas do workspace, por ordem de criação', async () => {
      const { query, repository } = setup([stored]);

      const accounts = await repository.findAll();

      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain('isactive = TRUE');
      expect(sql).toContain('workspaceid =');
      expect(sql).toContain('ORDER BY createdat ASC, id ASC');
      expect(params).toEqual([WORKSPACE]);
      expect(accounts).toEqual([stored]);
    });

    it('devolve lista vazia quando não há contas', async () => {
      await expect(setup([]).repository.findAll()).resolves.toEqual([]);
    });
  });

  describe('findById', () => {
    it('consulta só ativa e do workspace, com o id como parâmetro', async () => {
      const { query, repository } = setup();

      const account = await repository.findById(ID);

      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain('id = $2');
      expect(sql).toContain('isactive = TRUE');
      expect(sql).not.toContain(ID);
      expect(params).toEqual([WORKSPACE, ID]);
      expect(account).toEqual(stored);
    });

    it('devolve null quando não encontra', async () => {
      await expect(setup([]).repository.findById(ID)).resolves.toBeNull();
    });
  });

  describe('update', () => {
    it('altera com COALESCE, renova updatedat e filtra por ativa e workspace', async () => {
      const { query, repository } = setup();

      const account = await repository.update(ID, { name: 'Nubank PJ' });

      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain('name = COALESCE($3, name)');
      expect(sql).toContain('type = COALESCE($4, type)');
      expect(sql).toContain('updatedat = NOW()');
      expect(sql).toContain('isactive = TRUE');
      expect(params).toEqual([WORKSPACE, ID, 'Nubank PJ', null]);
      expect(account).toEqual(stored);
    });

    it('passa null para os campos não enviados', async () => {
      const { query, repository } = setup();

      await repository.update(ID, { type: 'SAVINGS' });

      expect(query.mock.calls[0][1]).toEqual([WORKSPACE, ID, null, 'SAVINGS']);
    });

    it('nunca referencia balance nem isactive no SET', async () => {
      const { query, repository } = setup();

      await repository.update(ID, { name: 'X' });

      const setClause = query.mock.calls[0][0].match(/SET([^]*?)WHERE/)?.[1] ?? '';
      expect(setClause).not.toMatch(/balance/i);
      expect(setClause).not.toMatch(/isactive/i);
    });

    it('devolve null quando não há conta ativa com o id', async () => {
      await expect(setup([]).repository.update(ID, { name: 'X' })).resolves.toBeNull();
    });

    it('traduz a violação do índice de nome e repassa outros erros', async () => {
      await expect(
        createAccountRepository(jest.fn<Query>().mockRejectedValue(nameViolation), WORKSPACE).update(ID, { name: 'X' }),
      ).rejects.toBeInstanceOf(UsedAccountNameError);

      const failure = new Error('connection refused');
      await expect(
        createAccountRepository(jest.fn<Query>().mockRejectedValue(failure), WORKSPACE).update(ID, { name: 'X' }),
      ).rejects.toBe(failure);
    });
  });

  describe('deactivate', () => {
    it('faz remoção lógica: isactive = FALSE e updatedat = NOW(), só de ativa', async () => {
      const { query, repository } = setup();

      const result = await repository.deactivate(ID);

      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain('SET isactive = FALSE');
      expect(sql).toContain('updatedat = NOW()');
      expect(sql).toContain('isactive = TRUE');
      expect(params).toEqual([WORKSPACE, ID]);
      expect(result).toBe(true);
    });

    it('devolve false quando não há conta ativa com o id', async () => {
      await expect(setup([]).repository.deactivate(ID)).resolves.toBe(false);
    });
  });

  it('nenhuma instrução do repository faz DELETE físico', async () => {
    const { query, repository } = setup();

    await repository.create({ name: 'A', type: 'CASH', balance: '0.00' });
    await repository.findAll();
    await repository.findById(ID);
    await repository.update(ID, { name: 'B' });
    await repository.deactivate(ID);

    query.mock.calls.forEach(([sql]) => expect(sql).not.toMatch(/\bDELETE\b/i));
  });

  it('nunca seleciona workspaceid nas colunas públicas', async () => {
    const { query, repository } = setup();

    await repository.findAll();

    expect(query.mock.calls[0][0].match(/SELECT([^]*?)FROM/)?.[1]).not.toMatch(/workspaceid/i);
  });
});
