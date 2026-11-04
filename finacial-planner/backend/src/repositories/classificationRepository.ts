import { UsedClassificationNameError } from '../utils/errors.ts';

export type Classification = {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type NewClassification = {
  name: string;
};

export type ClassificationChanges = {
  name: string;
};

export type Query = (text: string, params: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;

export type ClassificationRepository = {
  create: (newClassification: NewClassification) => Promise<Classification | null>;
  findAll: () => Promise<Classification[]>;
  findById: (id: string) => Promise<Classification | null>;
  update: (id: string, changes: ClassificationChanges) => Promise<Classification | null>;
  deactivate: (id: string) => Promise<boolean>;
  reactivate: (id: string) => Promise<Classification | null>;
  // true = ativa, false = desativada, null = não existe
  findActiveState: (id: string) => Promise<boolean | null>;
};

const UNIQUE_VIOLATION = '23505';
const ACTIVE_NAME_INDEX = 'idx_classifications_name_active';

const PUBLIC_COLUMNS = `id, name, isactive AS "isActive", createdat AS "createdAt", updatedat AS "updatedAt"`;

// $1 é sempre o nome do workspace padrão; o id é resolvido no próprio SQL
const DEFAULT_WORKSPACE_ID = `(SELECT id FROM workspaces WHERE name = $1 AND isactive = TRUE ORDER BY createdat ASC, id ASC LIMIT 1)`;

const INSERT_CLASSIFICATION = `
  INSERT INTO classifications (workspaceid, name)
  SELECT w.id, $2
  FROM workspaces w
  WHERE w.name = $1 AND w.isactive = TRUE
  ORDER BY w.createdat ASC, w.id ASC
  LIMIT 1
  RETURNING ${PUBLIC_COLUMNS}
`;

const SELECT_ACTIVE_CLASSIFICATIONS = `
  SELECT ${PUBLIC_COLUMNS}
  FROM classifications
  WHERE isactive = TRUE AND workspaceid = ${DEFAULT_WORKSPACE_ID}
  ORDER BY createdat ASC, id ASC
`;

const SELECT_ACTIVE_CLASSIFICATION_BY_ID = `
  SELECT ${PUBLIC_COLUMNS}
  FROM classifications
  WHERE id = $2 AND isactive = TRUE AND workspaceid = ${DEFAULT_WORKSPACE_ID}
`;

const UPDATE_ACTIVE_CLASSIFICATION = `
  UPDATE classifications
  SET name = $3,
      updatedat = NOW()
  WHERE id = $2 AND isactive = TRUE AND workspaceid = ${DEFAULT_WORKSPACE_ID}
  RETURNING ${PUBLIC_COLUMNS}
`;

// Remoção é sempre lógica. Na mesma instrução (atômica), as categorias ativas da classificação ficam sem classificação
const DEACTIVATE_ACTIVE_CLASSIFICATION = `
  WITH deactivated AS (
    UPDATE classifications
    SET isactive = FALSE,
        updatedat = NOW()
    WHERE id = $2 AND isactive = TRUE AND workspaceid = ${DEFAULT_WORKSPACE_ID}
    RETURNING id
  ),
  unlinked AS (
    UPDATE categories
    SET classificationid = NULL,
        updatedat = NOW()
    WHERE isactive = TRUE AND classificationid IN (SELECT id FROM deactivated)
  )
  SELECT id FROM deactivated
`;

// Reativar não religa categorias: quem ainda apontava para a classificação (ativas ou não) é desvinculado
const REACTIVATE_CLASSIFICATION = `
  WITH reactivated AS (
    UPDATE classifications
    SET isactive = TRUE,
        updatedat = NOW()
    WHERE id = $2 AND isactive = FALSE AND workspaceid = ${DEFAULT_WORKSPACE_ID}
    RETURNING ${PUBLIC_COLUMNS}
  ),
  cleared AS (
    UPDATE categories
    SET classificationid = NULL,
        updatedat = NOW()
    WHERE classificationid IN (SELECT id FROM reactivated)
  )
  SELECT ${PUBLIC_COLUMNS} FROM reactivated
`;

const SELECT_ACTIVE_STATE = `
  SELECT isactive AS "isActive"
  FROM classifications
  WHERE id = $2 AND workspaceid = ${DEFAULT_WORKSPACE_ID}
`;

function isUsedNameViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const { code, constraint } = error as { code?: string; constraint?: string };
  return code === UNIQUE_VIOLATION && constraint === ACTIVE_NAME_INDEX;
}

export function createClassificationRepository(query: Query, workspaceName: string): ClassificationRepository {
  const run = async (sql: string, params: unknown[]) => {
    try {
      return (await query(sql, params)).rows as Classification[];
    } catch (error) {
      if (isUsedNameViolation(error)) throw new UsedClassificationNameError();
      throw error;
    }
  };

  return {
    async create({ name }) {
      const rows = await run(INSERT_CLASSIFICATION, [workspaceName, name]);
      return rows[0] ?? null;
    },

    findAll() {
      return run(SELECT_ACTIVE_CLASSIFICATIONS, [workspaceName]);
    },

    async findById(id) {
      const rows = await run(SELECT_ACTIVE_CLASSIFICATION_BY_ID, [workspaceName, id]);
      return rows[0] ?? null;
    },

    async update(id, { name }) {
      const rows = await run(UPDATE_ACTIVE_CLASSIFICATION, [workspaceName, id, name]);
      return rows[0] ?? null;
    },

    async deactivate(id) {
      const rows = await run(DEACTIVATE_ACTIVE_CLASSIFICATION, [workspaceName, id]);
      return rows.length > 0;
    },

    async reactivate(id) {
      const rows = await run(REACTIVATE_CLASSIFICATION, [workspaceName, id]);
      return rows[0] ?? null;
    },

    async findActiveState(id) {
      const result = await query(SELECT_ACTIVE_STATE, [workspaceName, id]);
      const row = result.rows[0] as { isActive: boolean } | undefined;
      return row ? row.isActive : null;
    },
  };
}
