import { describe, it, expect, jest } from '@jest/globals';
import { createClassificationRepository } from './classificationRepository.ts';
import type { Classification, Query } from './classificationRepository.ts';
import { UsedClassificationNameError } from '../utils/errors.ts';

const WORKSPACE = 'familia';
const ID = '6f1d3c1e-0c4b-4f0e-9d1a-2b7a8f3c9e10';

const stored: Classification = {
  id: ID,
  name: 'Automóvel',
  isActive: true,
  createdAt: new Date('2026-11-03T10:00:00Z'),
  updatedAt: new Date('2026-11-03T10:00:00Z'),
};

const nameViolation = Object.assign(new Error('duplicate key'), {
  code: '23505',
  constraint: 'idx_classifications_name_active',
});

function setup(rows: Array<Record<string, unknown>> = [stored]) {
  const query = jest.fn<Query>().mockResolvedValue({ rows });
  return { query, repository: createClassificationRepository(query, WORKSPACE) };
}

const sqlOf = (query: jest.Mock<Query>, call = 0) => query.mock.calls[call][0];

describe('createClassificationRepository', () => {
  describe('create', () => {
    it('insere com SQL parametrizado, resolvendo o workspace pelo nome', async () => {
      const { query, repository } = setup();

      const classification = await repository.create({ name: 'Automóvel' });

      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain('SELECT w.id, $2');
      expect(sql).toContain('w.name = $1');
      expect(sql).not.toContain('Automóvel');
      expect(sql).not.toContain('familia');
      expect(params).toEqual([WORKSPACE, 'Automóvel']);
      expect(classification).toEqual(stored);
    });

    it('só informa workspace e nome na inserção (nada vindo do cliente além do nome)', async () => {
      const { query, repository } = setup();

      await repository.create({ name: 'Lazer' });

      const columns = sqlOf(query).match(/INSERT INTO classifications \(([^)]*)\)/)?.[1];
      expect(columns?.replace(/\s/g, '')).toBe('workspaceid,name');
    });

    it('devolve null quando o workspace padrão não existe', async () => {
      const { repository } = setup([]);

      await expect(repository.create({ name: 'Lazer' })).resolves.toBeNull();
    });
  });

  describe('findAll e findById', () => {
    it('listam só ativas do workspace, em ordem de criação', async () => {
      const { query, repository } = setup();

      await expect(repository.findAll()).resolves.toEqual([stored]);

      expect(sqlOf(query)).toContain('isactive = TRUE');
      expect(sqlOf(query)).toContain('workspaceid = (SELECT id FROM workspaces WHERE name = $1');
      expect(sqlOf(query)).toContain('ORDER BY createdat ASC, id ASC');
      expect(query.mock.calls[0][1]).toEqual([WORKSPACE]);
    });

    it('findById filtra por id, ativa e workspace; devolve null quando não há linha', async () => {
      const { query, repository } = setup();
      await expect(repository.findById(ID)).resolves.toEqual(stored);
      expect(sqlOf(query)).toContain('id = $2 AND isactive = TRUE');
      expect(query.mock.calls[0][1]).toEqual([WORKSPACE, ID]);

      await expect(setup([]).repository.findById(ID)).resolves.toBeNull();
    });

    it('não seleciona workspaceid', async () => {
      const { query, repository } = setup();
      await repository.findAll();
      expect(sqlOf(query).match(/SELECT([\s\S]*?)FROM/)?.[1]).not.toContain('workspaceid');
    });
  });

  describe('update', () => {
    it('altera só o nome de uma ativa e renova updatedat', async () => {
      const { query, repository } = setup();

      await expect(repository.update(ID, { name: 'Veículos' })).resolves.toEqual(stored);

      expect(sqlOf(query)).toContain('SET name = $3');
      expect(sqlOf(query)).toContain('updatedat = NOW()');
      expect(sqlOf(query)).toContain('isactive = TRUE');
      expect(query.mock.calls[0][1]).toEqual([WORKSPACE, ID, 'Veículos']);
    });

    it('devolve null quando nenhuma linha é alterada', async () => {
      await expect(setup([]).repository.update(ID, { name: 'X' })).resolves.toBeNull();
    });
  });

  describe('deactivate', () => {
    it('desativa e desvincula as categorias ativas na mesma instrução, sem DELETE', async () => {
      const { query, repository } = setup([{ id: ID }]);

      await expect(repository.deactivate(ID)).resolves.toBe(true);

      expect(query).toHaveBeenCalledTimes(1);
      const sql = sqlOf(query);
      expect(sql).toContain('SET isactive = FALSE');
      expect(sql).toContain('UPDATE categories');
      expect(sql).toContain('classificationid = NULL');
      expect(sql).toMatch(/UPDATE categories[\s\S]*WHERE isactive = TRUE AND classificationid IN \(SELECT id FROM deactivated\)/);
      expect(sql).not.toMatch(/DELETE/i);
      expect(query.mock.calls[0][1]).toEqual([WORKSPACE, ID]);
    });

    it('devolve false quando nenhuma classificação foi desativada', async () => {
      await expect(setup([]).repository.deactivate(ID)).resolves.toBe(false);
    });
  });

  describe('reactivate', () => {
    it('reativa só desativadas e desvincula toda categoria que ainda apontava para ela', async () => {
      const { query, repository } = setup();

      await expect(repository.reactivate(ID)).resolves.toEqual(stored);

      const sql = sqlOf(query);
      expect(sql).toContain('SET isactive = TRUE');
      expect(sql).toContain('isactive = FALSE');
      expect(sql).toMatch(/UPDATE categories[\s\S]*WHERE classificationid IN \(SELECT id FROM reactivated\)/);
      expect(sql).not.toMatch(/UPDATE categories[\s\S]*isactive = TRUE AND classificationid/);
      expect(query.mock.calls[0][1]).toEqual([WORKSPACE, ID]);
    });

    it('devolve null quando nada foi reativado', async () => {
      await expect(setup([]).repository.reactivate(ID)).resolves.toBeNull();
    });

    it('traduz a violação do índice de nome em UsedClassificationNameError', async () => {
      const query = jest.fn<Query>().mockRejectedValue(nameViolation);
      await expect(createClassificationRepository(query, WORKSPACE).reactivate(ID)).rejects.toBeInstanceOf(
        UsedClassificationNameError,
      );
    });
  });

  describe('findActiveState', () => {
    it.each([
      [[{ isActive: true }], true],
      [[{ isActive: false }], false],
      [[], null],
    ])('com linhas %p devolve %p', async (rows, expected) => {
      const { query, repository } = setup(rows as Array<Record<string, unknown>>);

      await expect(repository.findActiveState(ID)).resolves.toBe(expected);

      expect(sqlOf(query)).not.toMatch(/WHERE id = \$2 AND isactive = TRUE/);
      expect(query.mock.calls[0][1]).toEqual([WORKSPACE, ID]);
    });
  });

  describe('erros do banco', () => {
    it('traduz a violação do índice de nome ativo no create e no update', async () => {
      const query = jest.fn<Query>().mockRejectedValue(nameViolation);
      const repository = createClassificationRepository(query, WORKSPACE);

      await expect(repository.create({ name: 'A' })).rejects.toBeInstanceOf(UsedClassificationNameError);
      await expect(repository.update(ID, { name: 'A' })).rejects.toBeInstanceOf(UsedClassificationNameError);
    });

    it('repassa outros erros, inclusive outra violação de unicidade', async () => {
      const other = Object.assign(new Error('duplicate'), { code: '23505', constraint: 'classifications_pkey' });
      for (const failure of [new Error('connection refused'), other]) {
        const query = jest.fn<Query>().mockRejectedValue(failure);
        const repository = createClassificationRepository(query, WORKSPACE);
        await expect(repository.create({ name: 'A' })).rejects.toBe(failure);
        await expect(repository.deactivate(ID)).rejects.toBe(failure);
        await expect(repository.findActiveState(ID)).rejects.toBe(failure);
      }
    });
  });
});
