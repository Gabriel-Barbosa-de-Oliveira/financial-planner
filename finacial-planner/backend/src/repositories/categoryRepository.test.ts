import { describe, it, expect, jest } from '@jest/globals';
import { createCategoryRepository, toCategory } from './categoryRepository.ts';
import type { Category, CategoryRow, Query } from './categoryRepository.ts';
import { UsedCategoryNameError } from '../utils/errors.ts';

const WORKSPACE = 'familia';
const ID = '6f1d3c1e-0c4b-4f0e-9d1a-2b7a8f3c9e10';
const CLASSIFICATION_ID = '0b9f4f55-6a47-4c53-9d0a-6a1b0f6a2c11';
const created = new Date('2026-11-03T10:00:00Z');

const row: CategoryRow = {
  id: ID,
  name: 'Gasolina',
  type: 'SAIDA',
  isActive: true,
  createdAt: created,
  updatedAt: created,
  classificationId: CLASSIFICATION_ID,
  classificationName: 'Automóvel',
};

const category: Category = {
  id: ID,
  name: 'Gasolina',
  type: 'SAIDA',
  classification: { id: CLASSIFICATION_ID, name: 'Automóvel' },
  isActive: true,
  createdAt: created,
  updatedAt: created,
};

const nameViolation = Object.assign(new Error('duplicate key'), {
  code: '23505',
  constraint: 'idx_categories_name_type_active',
});

function setup(rows: Array<Record<string, unknown>> = [row]) {
  const query = jest.fn<Query>().mockResolvedValue({ rows });
  return { query, repository: createCategoryRepository(query, WORKSPACE) };
}

const sqlOf = (query: jest.Mock<Query>, call = 0) => query.mock.calls[call][0];

describe('toCategory', () => {
  it('aninha a classificação ativa', () => {
    expect(toCategory(row)).toEqual(category);
  });

  it('devolve classification null quando a categoria não tem classificação (ou ela está inativa)', () => {
    const result = toCategory({ ...row, classificationId: null, classificationName: null });

    expect(result.classification).toBeNull();
    expect(result).not.toHaveProperty('classificationId');
    expect(result).not.toHaveProperty('classificationName');
  });
});

describe('createCategoryRepository', () => {
  describe('create', () => {
    it('insere com SQL parametrizado e devolve a categoria com a classificação', async () => {
      const { query, repository } = setup();

      const result = await repository.create({ name: 'Gasolina', type: 'SAIDA', classificationId: CLASSIFICATION_ID });

      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain('SELECT w.id, $2, $3, $4');
      expect(sql).toContain('w.name = $1');
      expect(sql).not.toContain('Gasolina');
      expect(sql).not.toContain('familia');
      expect(params).toEqual([WORKSPACE, 'Gasolina', 'SAIDA', CLASSIFICATION_ID]);
      expect(result).toEqual(category);
    });

    it('só informa workspace, nome, tipo e classificação na inserção', async () => {
      const { query, repository } = setup();

      await repository.create({ name: 'Salário', type: 'ENTRADA', classificationId: null });

      const columns = sqlOf(query).match(/INSERT INTO categories \(([^)]*)\)/)?.[1];
      expect(columns?.replace(/\s/g, '')).toBe('workspaceid,name,type,classificationid');
      expect(query.mock.calls[0][1]).toEqual([WORKSPACE, 'Salário', 'ENTRADA', null]);
    });

    it('devolve null quando o workspace padrão não existe', async () => {
      await expect(setup([]).repository.create({ name: 'A', type: 'SAIDA', classificationId: null })).resolves.toBeNull();
    });
  });

  describe('findAll', () => {
    it('lista ativas do workspace, em ordem de criação, usando só classificações ativas no join', async () => {
      const { query, repository } = setup();

      await expect(repository.findAll()).resolves.toEqual([category]);

      const sql = sqlOf(query);
      expect(sql).toContain('cat.isactive = TRUE');
      expect(sql).toContain('cat.workspaceid = (SELECT id FROM workspaces WHERE name = $1');
      expect(sql).toContain('LEFT JOIN classifications cls ON cls.id = cat.classificationid AND cls.isactive = TRUE');
      expect(sql).toContain('ORDER BY cat.createdat ASC, cat.id ASC');
      expect(query.mock.calls[0][1]).toEqual([WORKSPACE, null, null]);
    });

    it('envia os filtros como parâmetros e filtra pela classificação do join', async () => {
      const { query, repository } = setup();

      await repository.findAll({ classificationId: CLASSIFICATION_ID, type: 'ENTRADA' });

      expect(sqlOf(query)).toContain('$2::uuid IS NULL OR cls.id = $2');
      expect(sqlOf(query)).toContain('$3::text IS NULL OR cat.type = $3');
      expect(query.mock.calls[0][1]).toEqual([WORKSPACE, CLASSIFICATION_ID, 'ENTRADA']);
    });

    it('mapeia linhas sem classificação', async () => {
      const { repository } = setup([{ ...row, classificationId: null, classificationName: null }]);

      const [result] = await repository.findAll();

      expect(result.classification).toBeNull();
    });
  });

  describe('findById', () => {
    it('filtra por id, ativa e workspace; devolve null quando não há linha', async () => {
      const { query, repository } = setup();
      await expect(repository.findById(ID)).resolves.toEqual(category);
      expect(sqlOf(query)).toContain('cat.id = $2 AND cat.isactive = TRUE');
      expect(query.mock.calls[0][1]).toEqual([WORKSPACE, ID]);

      await expect(setup([]).repository.findById(ID)).resolves.toBeNull();
    });

    it('não seleciona workspaceid', async () => {
      const { query, repository } = setup();
      await repository.findById(ID);
      expect(sqlOf(query).match(/SELECT\s+cat\.id([\s\S]*?)FROM/)?.[1]).not.toContain('workspaceid');
    });
  });

  describe('update', () => {
    it('altera nome e classificação sem referenciar o tipo', async () => {
      const { query, repository } = setup();

      await expect(repository.update(ID, { name: 'Combustível', classificationId: CLASSIFICATION_ID })).resolves.toEqual(category);

      const sql = sqlOf(query);
      expect(sql).toContain('name = COALESCE($3, name)');
      expect(sql).toContain('CASE WHEN $5::boolean THEN $4::uuid ELSE classificationid END');
      expect(sql).toContain('updatedat = NOW()');
      expect(sql).not.toMatch(/SET[\s\S]*\btype\s*=/);
      expect(query.mock.calls[0][1]).toEqual([WORKSPACE, ID, 'Combustível', CLASSIFICATION_ID, true]);
    });

    it('só nome: não mexe na classificação (flag falso)', async () => {
      const { query, repository } = setup();

      await repository.update(ID, { name: 'Combustível' });

      expect(query.mock.calls[0][1]).toEqual([WORKSPACE, ID, 'Combustível', null, false]);
    });

    it('classificationId null remove o vínculo (flag verdadeiro)', async () => {
      const { query, repository } = setup();

      await repository.update(ID, { classificationId: null });

      expect(query.mock.calls[0][1]).toEqual([WORKSPACE, ID, null, null, true]);
    });

    it('devolve null quando nenhuma linha é alterada', async () => {
      await expect(setup([]).repository.update(ID, { name: 'X' })).resolves.toBeNull();
    });
  });

  describe('deactivate', () => {
    it('desativa só ativas, sem DELETE e sem tocar em lançamentos', async () => {
      const { query, repository } = setup([{ id: ID }]);

      await expect(repository.deactivate(ID)).resolves.toBe(true);

      const sql = sqlOf(query);
      expect(sql).toContain('SET isactive = FALSE');
      expect(sql).toContain('isactive = TRUE');
      expect(sql).not.toMatch(/DELETE/i);
      expect(sql).not.toContain('transactions');
      expect(query.mock.calls[0][1]).toEqual([WORKSPACE, ID]);
    });

    it('devolve false quando nada foi desativado', async () => {
      await expect(setup([]).repository.deactivate(ID)).resolves.toBe(false);
    });
  });

  describe('reactivate', () => {
    it('reativa só desativadas e mantém a classificação somente se ainda estiver ativa', async () => {
      const { query, repository } = setup();

      await expect(repository.reactivate(ID)).resolves.toEqual(category);

      const sql = sqlOf(query);
      expect(sql).toContain('SET isactive = TRUE');
      expect(sql).toContain('isactive = FALSE');
      expect(sql).toMatch(/EXISTS \(SELECT 1 FROM classifications k WHERE k\.id = categories\.classificationid AND k\.isactive = TRUE\)/);
      expect(query.mock.calls[0][1]).toEqual([WORKSPACE, ID]);
    });

    it('devolve null quando nada foi reativado', async () => {
      await expect(setup([]).repository.reactivate(ID)).resolves.toBeNull();
    });

    it('traduz a violação do índice de nome em UsedCategoryNameError', async () => {
      const query = jest.fn<Query>().mockRejectedValue(nameViolation);
      await expect(createCategoryRepository(query, WORKSPACE).reactivate(ID)).rejects.toBeInstanceOf(UsedCategoryNameError);
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
    });
  });

  describe('erros do banco', () => {
    it('traduz a violação do índice de nome ativo no create e no update', async () => {
      const query = jest.fn<Query>().mockRejectedValue(nameViolation);
      const repository = createCategoryRepository(query, WORKSPACE);

      await expect(repository.create({ name: 'A', type: 'SAIDA', classificationId: null })).rejects.toBeInstanceOf(UsedCategoryNameError);
      await expect(repository.update(ID, { name: 'A' })).rejects.toBeInstanceOf(UsedCategoryNameError);
    });

    it('repassa outros erros, inclusive outra violação de unicidade', async () => {
      const other = Object.assign(new Error('duplicate'), { code: '23505', constraint: 'categories_pkey' });
      for (const failure of [new Error('connection refused'), other]) {
        const query = jest.fn<Query>().mockRejectedValue(failure);
        const repository = createCategoryRepository(query, WORKSPACE);
        await expect(repository.create({ name: 'A', type: 'SAIDA', classificationId: null })).rejects.toBe(failure);
        await expect(repository.findAll()).rejects.toBe(failure);
        await expect(repository.deactivate(ID)).rejects.toBe(failure);
      }
    });
  });
});
