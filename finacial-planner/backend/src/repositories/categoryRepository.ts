import type { CategoryType } from '../config/category.ts';
import { UsedCategoryNameError } from '../utils/errors.ts';

export type Category = {
  id: string;
  name: string;
  type: CategoryType;
  classification: { id: string; name: string } | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type NewCategory = {
  name: string;
  type: CategoryType;
  classificationId: string | null;
};

// classificationId: null remove o vínculo; ausente mantém
export type CategoryChanges = {
  name?: string;
  classificationId?: string | null;
};

export type CategoryFilters = {
  classificationId?: string;
  type?: CategoryType;
};

export type CategoryRow = {
  id: string;
  name: string;
  type: CategoryType;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  classificationId: string | null;
  classificationName: string | null;
};

export type Query = (text: string, params: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;

export type CategoryRepository = {
  create: (newCategory: NewCategory) => Promise<Category | null>;
  findAll: (filters?: CategoryFilters) => Promise<Category[]>;
  findById: (id: string) => Promise<Category | null>;
  update: (id: string, changes: CategoryChanges) => Promise<Category | null>;
  deactivate: (id: string) => Promise<boolean>;
  reactivate: (id: string) => Promise<Category | null>;
  // true = ativa, false = desativada, null = não existe
  findActiveState: (id: string) => Promise<boolean | null>;
};

const UNIQUE_VIOLATION = '23505';
const ACTIVE_NAME_INDEX = 'idx_categories_name_type_active';

// $1 é sempre o nome do workspace padrão; o id é resolvido no próprio SQL
const DEFAULT_WORKSPACE_ID = `(SELECT id FROM workspaces WHERE name = $1 AND isactive = TRUE ORDER BY createdat ASC, id ASC LIMIT 1)`;

// A classificação só aparece se estiver ativa
const PUBLIC_COLUMNS = `cat.id, cat.name, cat.type, cat.isactive AS "isActive", cat.createdat AS "createdAt", cat.updatedat AS "updatedAt", cls.id AS "classificationId", cls.name AS "classificationName"`;
const JOIN_CLASSIFICATION = `LEFT JOIN classifications cls ON cls.id = cat.classificationid AND cls.isactive = TRUE`;

const INSERT_CATEGORY = `
  WITH changed AS (
    INSERT INTO categories (workspaceid, name, type, classificationid)
    SELECT w.id, $2, $3, $4
    FROM workspaces w
    WHERE w.name = $1 AND w.isactive = TRUE
    ORDER BY w.createdat ASC, w.id ASC
    LIMIT 1
    RETURNING *
  )
  SELECT ${PUBLIC_COLUMNS} FROM changed cat ${JOIN_CLASSIFICATION}
`;

const SELECT_ACTIVE_CATEGORIES = `
  SELECT ${PUBLIC_COLUMNS}
  FROM categories cat ${JOIN_CLASSIFICATION}
  WHERE cat.isactive = TRUE AND cat.workspaceid = ${DEFAULT_WORKSPACE_ID}
    AND ($2::uuid IS NULL OR cls.id = $2)
    AND ($3::text IS NULL OR cat.type = $3)
  ORDER BY cat.createdat ASC, cat.id ASC
`;

const SELECT_ACTIVE_CATEGORY_BY_ID = `
  SELECT ${PUBLIC_COLUMNS}
  FROM categories cat ${JOIN_CLASSIFICATION}
  WHERE cat.id = $2 AND cat.isactive = TRUE AND cat.workspaceid = ${DEFAULT_WORKSPACE_ID}
`;

// $5 indica se classificationId foi enviado (permite limpar com null). Não referencia type: o tipo é imutável
const UPDATE_ACTIVE_CATEGORY = `
  WITH changed AS (
    UPDATE categories
    SET name = COALESCE($3, name),
        classificationid = CASE WHEN $5::boolean THEN $4::uuid ELSE classificationid END,
        updatedat = NOW()
    WHERE id = $2 AND isactive = TRUE AND workspaceid = ${DEFAULT_WORKSPACE_ID}
    RETURNING *
  )
  SELECT ${PUBLIC_COLUMNS} FROM changed cat ${JOIN_CLASSIFICATION}
`;

// Remoção é sempre lógica: o registro continua na tabela com isactive = FALSE
const DEACTIVATE_ACTIVE_CATEGORY = `
  UPDATE categories
  SET isactive = FALSE,
      updatedat = NOW()
  WHERE id = $2 AND isactive = TRUE AND workspaceid = ${DEFAULT_WORKSPACE_ID}
  RETURNING id
`;

// Mantém a classificação só se ela ainda estiver ativa
const REACTIVATE_CATEGORY = `
  WITH changed AS (
    UPDATE categories
    SET isactive = TRUE,
        classificationid = CASE
          WHEN EXISTS (SELECT 1 FROM classifications k WHERE k.id = categories.classificationid AND k.isactive = TRUE)
          THEN classificationid
          ELSE NULL
        END,
        updatedat = NOW()
    WHERE id = $2 AND isactive = FALSE AND workspaceid = ${DEFAULT_WORKSPACE_ID}
    RETURNING *
  )
  SELECT ${PUBLIC_COLUMNS} FROM changed cat ${JOIN_CLASSIFICATION}
`;

const SELECT_ACTIVE_STATE = `
  SELECT isactive AS "isActive"
  FROM categories
  WHERE id = $2 AND workspaceid = ${DEFAULT_WORKSPACE_ID}
`;

export function toCategory(row: CategoryRow): Category {
  const { classificationId, classificationName, ...rest } = row;
  return {
    ...rest,
    classification: classificationId === null ? null : { id: classificationId, name: classificationName as string },
  };
}

function isUsedNameViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const { code, constraint } = error as { code?: string; constraint?: string };
  return code === UNIQUE_VIOLATION && constraint === ACTIVE_NAME_INDEX;
}

export function createCategoryRepository(query: Query, workspaceName: string): CategoryRepository {
  const run = async (sql: string, params: unknown[]) => {
    try {
      return (await query(sql, params)).rows;
    } catch (error) {
      if (isUsedNameViolation(error)) throw new UsedCategoryNameError();
      throw error;
    }
  };
  const runCategories = async (sql: string, params: unknown[]) =>
    (await run(sql, params) as CategoryRow[]).map(toCategory);

  return {
    async create({ name, type, classificationId }) {
      const rows = await runCategories(INSERT_CATEGORY, [workspaceName, name, type, classificationId]);
      return rows[0] ?? null;
    },

    findAll({ classificationId, type } = {}) {
      return runCategories(SELECT_ACTIVE_CATEGORIES, [workspaceName, classificationId ?? null, type ?? null]);
    },

    async findById(id) {
      const rows = await runCategories(SELECT_ACTIVE_CATEGORY_BY_ID, [workspaceName, id]);
      return rows[0] ?? null;
    },

    async update(id, changes) {
      const hasClassification = 'classificationId' in changes && changes.classificationId !== undefined;
      const rows = await runCategories(UPDATE_ACTIVE_CATEGORY, [
        workspaceName,
        id,
        changes.name ?? null,
        hasClassification ? changes.classificationId : null,
        hasClassification,
      ]);
      return rows[0] ?? null;
    },

    async deactivate(id) {
      const rows = await run(DEACTIVATE_ACTIVE_CATEGORY, [workspaceName, id]);
      return rows.length > 0;
    },

    async reactivate(id) {
      const rows = await runCategories(REACTIVATE_CATEGORY, [workspaceName, id]);
      return rows[0] ?? null;
    },

    async findActiveState(id) {
      const result = await query(SELECT_ACTIVE_STATE, [workspaceName, id]);
      const row = result.rows[0] as { isActive: boolean } | undefined;
      return row ? row.isActive : null;
    },
  };
}
