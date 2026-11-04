---

description: "Task list for Categorias e Classificações (Categories)"
---

# Tasks: Categorias e Classificações (Categories)

**Input**: Design documents from `/specs/004-categories/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/classifications.openapi.yaml](contracts/classifications.openapi.yaml), [contracts/categories.openapi.yaml](contracts/categories.openapi.yaml), [quickstart.md](quickstart.md). O workspace `familia` já está no seed do `schema.sql`.

**Tests**: obrigatórios. A constitution (princípio 6) exige teste junto de toda lógica nova. Jest 29 em ESM: importar `describe`, `it`, `expect`, `jest` de `@jest/globals`; testes ao lado do código em `*.test.ts`; rodar com `npm test` (nunca `npx jest` direto).

**Organization**: tarefas agrupadas por história. As histórias editam os mesmos arquivos (repositories, services, controllers, routes, schemas e `app.test.ts`), então **são implementadas em sequência**: US1 → US2 → US3 → US4 → US5. Dentro de cada história, classificação vem antes de categoria quando as duas aparecem.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência pendente)
- **[Story]**: história a que a tarefa pertence (US1 a US5)
- Cada tarefa cabe em um commit (`Feat:`, `Chore:`), e `npx tsc` + `npm test` ficam verdes ao fim de cada uma

## Path Conventions

- Backend: `finacial-planner/backend/src/` (grafia da pasta mantida)
- Banco: `finacial-planner/database/schema.sql`
- Postman: `postman/collections/Financial Planner/Classifications/` e `.../Categories/`
- Imports relativos com extensão `.ts`; `import type` para tipos; tipos junto do código (sem `types.ts` e sem `index.ts` de re-export)
- Schemas zod em `controllers/schemas/classification/classificationSchemas.ts` e `controllers/schemas/category/categorySchemas.ts`
- Identificadores em inglês; só mensagens ao usuário em português. O tipo da categoria na API é `ENTRADA` ou `SAIDA` (sem acento); as mensagens escrevem "SAÍDA"
- SQL sempre estático e parametrizado (`$1`, `$2`). `$1` é sempre o nome do workspace padrão; o id é resolvido por `workspaceid = (SELECT id FROM workspaces WHERE name = $1 AND isactive = TRUE ORDER BY createdat ASC, id ASC LIMIT 1)`, como em `accountRepository.ts`
- Colunas públicas com alias camelCase:
  - Classificação: `PUBLIC_COLUMNS = id, name, isactive AS "isActive", createdat AS "createdAt", updatedat AS "updatedAt"` (**sem** `workspaceid`)
  - Categoria: `cat.id, cat.name, cat.type, cat.isactive AS "isActive", cat.createdat AS "createdAt", cat.updatedat AS "updatedAt", cls.id AS "classificationId", cls.name AS "classificationName"`, sempre com `FROM categories cat LEFT JOIN classifications cls ON cls.id = cat.classificationid AND cls.isactive = TRUE` (a classificação só aparece se estiver ativa; research decisão 3). Instruções que escrevem usam `WITH changed AS (<INSERT|UPDATE> ... RETURNING *) SELECT <colunas> FROM changed cat LEFT JOIN classifications cls ON ...`
- Um mapeador puro `toCategory(row)` em `categoryRepository.ts` transforma a linha em `{ id, name, type, classification: { id, name } | null, isActive, createdAt, updatedAt }`
- Índices únicos tratados no repository: `idx_classifications_name_active` → `UsedClassificationNameError`; `idx_categories_name_type_active` → `UsedCategoryNameError` (código `23505` com esse `constraint`; qualquer outro erro é relançado)

## Convenção para os fakes de repository

Quando `ClassificationRepository` ou `CategoryRepository` ganha um método, todo fake tipado com esse tipo deixa de compilar. A mesma tarefa que adiciona o método ao repository também estende os fakes em `src/services/classificationService.test.ts`, `src/services/categoryService.test.ts` e `src/app.test.ts` (`createInMemoryClassificationRepository` e `createInMemoryCategoryRepository`), para `npx tsc` seguir verde. Os fakes em memória aplicam as regras do banco: só linhas ativas, nome único entre ativas sem diferenciar caixa (categoria: dentro do tipo). **Os dois fakes em memória compartilham o mesmo armazenamento** de classificações e categorias, para que o fake de categoria possa resolver a classificação ativa na leitura e o fake de classificação possa desvincular categorias.

---

## Phase 1: Setup

**Purpose**: ajustes de schema e configuração usados por todas as histórias

- [ ] T001 Edit `finacial-planner/database/schema.sql` per [data-model.md](data-model.md): (1) create table `classifications` **before** `categories` (`id UUID PK DEFAULT gen_random_uuid()`, `workspaceId UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE`, `name VARCHAR(100) NOT NULL`, `isActive BOOLEAN DEFAULT TRUE`, `createdAt`, `updatedAt` like the other tables) with indexes `idx_classifications_workspaceId`, `idx_classifications_isActive` and `CREATE UNIQUE INDEX idx_classifications_name_active ON classifications(workspaceId, LOWER(name)) WHERE isActive = TRUE`; (2) in `categories` add `classificationId UUID REFERENCES classifications(id)` (nullable), `CONSTRAINT check_category_type CHECK (type IN ('ENTRADA', 'SAIDA'))`, `CREATE INDEX idx_categories_classificationId`, and update the `type` comment to `ENTRADA ou SAIDA`; (3) replace `idx_categories_unique_per_workspace` with `CREATE UNIQUE INDEX idx_categories_name_type_active ON categories(workspaceId, LOWER(name), type) WHERE isActive = TRUE`; (4) add `trg_audit_classifications` (same form as the other triggers) and `COMMENT ON TABLE classifications IS 'Classificações (grupos) de categorias'`. Comments in Portuguese. Do not touch the seed. Validate on a throwaway Postgres container (never the real `financial-control-db`, never `down -v`): script applies without errors; a category type outside the list is rejected; two active classifications differing only by case are rejected; two active categories with the same name and type (any case) are rejected but the same name with another type is accepted; a deactivated record's name can be reused; a category with unknown `classificationId` is rejected by the FK; inserting into `classifications` writes to `audit_log`. **Pendente**: `schema.sql` editado, mas a validação em Postgres descartável não foi executada (daemon do Docker desligado); o script ainda não foi aplicado em nenhum banco
- [X] T002 [P] Create `finacial-planner/backend/src/config/classification.ts` exporting `classificationConfig = { name: { maxLength: 100 } }` and `finacial-planner/backend/src/config/category.ts` exporting `categoryConfig = { types: ['ENTRADA', 'SAIDA'] as const, name: { maxLength: 100 } }` and `type CategoryType = typeof categoryConfig.types[number]`. Plain constants; no test needed beyond usage in later schema tests

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: erros de domínio que as histórias usam

**⚠️ CRITICAL**: nenhuma história começa antes desta fase

- [X] T003 Edit `finacial-planner/backend/src/utils/errors.ts`: add, all `extends DomainError`: `ClassificationNotFoundError` (`CLASSIFICATION_NOT_FOUND`, 404, `Classificação não encontrada`), `UsedClassificationNameError` (`USED_CLASSIFICATION_NAME`, 409, `Já existe uma classificação com este nome`), `ClassificationAlreadyActiveError` (`CLASSIFICATION_ALREADY_ACTIVE`, 409, `Classificação já está ativa`), `CategoryNotFoundError` (`CATEGORY_NOT_FOUND`, 404, `Categoria não encontrada`), `UsedCategoryNameError` (`USED_CATEGORY_NAME`, 409, `Já existe uma categoria com este nome para este tipo`), `CategoryAlreadyActiveError` (`CATEGORY_ALREADY_ACTIVE`, 409, `Categoria já está ativa`), `InvalidClassificationError` (`INVALID_CLASSIFICATION`, 422, `Classificação não encontrada`); extend `errors.test.ts` covering code, status, message, `instanceof DomainError` and `name` for each

**Checkpoint**: base pronta; as histórias podem começar

---

## Phase 3: User Story 1 - Cadastrar e consultar classificações (Priority: P1) 🎯 MVP

**Goal**: cadastrar classificação e listar/consultar classificações ativas (`POST` e `GET /financial-control/classifications`, `GET /financial-control/classifications/:id`).

**Independent Test**: `POST` `{"name":"Automóvel"}` devolve 201; a classificação aparece na lista e na consulta por id; `"automóvel"`/`"AUTOMÓVEL"` repetido devolve 409 (caixa ignorada, acento mantido); entrada inválida devolve 400 por campo.

- [X] T004 [US1] Create `finacial-planner/backend/src/controllers/schemas/classification/classificationSchemas.ts`: `createClassificationSchema` (`name`: string, `trim`, min 1, max `classificationConfig.name.maxLength`; `.strict('Campo não permitido no cadastro de classificação')`; messages in Portuguese: `Nome é obrigatório`, `Nome deve ser um texto`, `Nome deve ter no máximo 100 caracteres`) and `classificationIdParamsSchema` (UUID, message `Identificador inválido`); export `CreateClassificationBody`. Create `classificationSchemas.test.ts` covering: valid name, trim, missing/empty/whitespace-only/101 chars/non-string name, forbidden `id`, `isActive`, `workspaceId`, `createdAt`, valid and invalid UUID
- [X] T005 [US1] Create `finacial-planner/backend/src/repositories/classificationRepository.ts`: types `Classification` (`id`, `name`, `isActive`, `createdAt`, `updatedAt`), `NewClassification` (`name`), `Query`, `ClassificationRepository`; `createClassificationRepository(query, workspaceName)` with `create` (`INSERT INTO classifications (workspaceid, name) SELECT w.id, $2 FROM workspaces w WHERE w.name = $1 AND w.isactive = TRUE ORDER BY w.createdat ASC, w.id ASC LIMIT 1 RETURNING ...`; `null` when no row; unique violation → `UsedClassificationNameError`), `findAll` (active, workspace, `ORDER BY createdat ASC, id ASC`) and `findById` (active, workspace; `null` when none). Create `classificationRepository.test.ts` with a fake `query`: parameters, `null` on empty result, unique-violation mapping (only for `idx_classifications_name_active`; other errors rethrown), every statement filters `isactive = TRUE` and the workspace, `workspaceid` absent from selected columns
- [X] T006 [US1] Create `finacial-planner/backend/src/services/classificationService.ts`: `ClassificationService` with `createClassification` (`repository.create`; `null` → `WorkspaceUnavailableError`), `listClassifications`, `getClassification` (`null` → `ClassificationNotFoundError`); `createClassificationService({ repository })`. Create `classificationService.test.ts` with a fake repository (follow the fakes convention): success, `WorkspaceUnavailableError`, `ClassificationNotFoundError`, empty list
- [X] T007 [US1] Create `finacial-planner/backend/src/controllers/classificationController.ts`: `type ClassificationController = { create, list, getById, update, remove, reactivate }` as `RouteHandlerMethod`; in this task implement `create` (parse with `createClassificationSchema`, `201`), `list` (`200`) and `getById` (parse `classificationIdParamsSchema`, `200`); keep the type limited to the implemented handlers, widening it in later stories. Create `classificationController.test.ts` with a fake service via `app.inject`: status codes, validation errors reach the global handler as 400 with `issues`, `DomainError` mapped to its status
- [X] T008 [US1] Create `finacial-planner/backend/src/routes/classificationRoutes.ts` (`ClassificationRoutesOptions = { controller }`; `POST /`, `GET /`, `GET /:id`) and `classificationRoutes.test.ts`; edit `routesIndex.ts` (`RoutesDependencies` gains `classification: ClassificationRoutesOptions`; register with prefix `/classifications`); edit `src/index.ts` composition root (`createClassificationRepository(query, defaultWorkspaceConfig.name)`, `createClassificationService`, `createClassificationController`) and update every existing `registerRoutes` call site (`app.test.ts`) so `npx tsc` stays green
- [X] T009 [US1] Edit `finacial-planner/backend/src/app.test.ts`: add `createInMemoryClassificationRepository` on top of a shared in-memory store (active-only, unique name among active ignoring case, `create` returning `null` when configured with no workspace) and end-to-end scenarios through the real Fastify instance: create, name trim, case-insensitive duplicate → 409 while a different accent is accepted, validation errors → 400 with `issues`, forbidden fields → 400, list empty and ordered, get by id / unknown id 404 / invalid id 400, no `workspaceId` in any response, workspace missing → 422, unexpected error → generic 500 without internals

**Checkpoint**: P1 entrega cadastro e consulta de classificações

---

## Phase 4: User Story 2 - Cadastrar e consultar categorias (Priority: P1)

**Goal**: cadastrar categoria (com ou sem classificação) e listar/consultar categorias ativas, com filtros (`POST` e `GET /financial-control/categories`, `GET /financial-control/categories/:id`).

**Independent Test**: `POST` Gasolina (`SAIDA`, classificação Automóvel) devolve 201 com `classification: { id, name }`; `POST` Salário (`ENTRADA`) sem classificação devolve `classification: null`; a lista aceita `?classificationId=` e `?type=`; nome repetido no mesmo tipo devolve 409, em outro tipo devolve 201; classificação inexistente ou desativada devolve 422.

- [X] T010 [US2] Create `finacial-planner/backend/src/controllers/schemas/category/categorySchemas.ts`: `createCategorySchema` (`name` as in classifications; `type`: `z.enum(categoryConfig.types)` with messages `Tipo é obrigatório` / `Tipo inválido (use ENTRADA ou SAIDA)`; `classificationId`: optional, UUID or `null`, message `Classificação inválida`; `.strict('Campo não permitido no cadastro de categoria')`), `categoryIdParamsSchema` (UUID, `Identificador inválido`) and `listCategoriesQuerySchema` (`classificationId` optional UUID, `type` optional enum, `.strict('Filtro não permitido')`, messages in Portuguese); export `CreateCategoryBody` and `ListCategoriesQuery`. Create `categorySchemas.test.ts`: with and without classification, `null` classification, `SÁIDA`/`XYZ` type rejected, missing type, invalid UUID, forbidden fields (`id`, `isActive`, `workspaceId`, dates), query with each filter, both, none, invalid values and unknown params
- [X] T011 [US2] Create `finacial-planner/backend/src/repositories/categoryRepository.ts`: types `Category` (`id`, `name`, `type: CategoryType`, `classification: { id: string; name: string } | null`, `isActive`, `createdAt`, `updatedAt`), `NewCategory` (`name`, `type`, `classificationId: string | null`), `CategoryFilters` (`classificationId?`, `type?`), `Query`, `CategoryRepository`; pure `toCategory(row)` mapper; `createCategoryRepository(query, workspaceName)` with `create` (`WITH inserted AS (INSERT INTO categories (workspaceid, name, type, classificationid) SELECT w.id, $2, $3, $4 FROM workspaces w WHERE w.name = $1 AND w.isactive = TRUE ORDER BY w.createdat ASC, w.id ASC LIMIT 1 RETURNING *) SELECT ... FROM inserted cat LEFT JOIN classifications cls ON ...`; `null` when no row; unique violation → `UsedCategoryNameError`), `findAll(filters)` (active, workspace, `AND ($2::uuid IS NULL OR cls.id = $2) AND ($3::text IS NULL OR cat.type = $3)`, `ORDER BY cat.createdat ASC, cat.id ASC`) and `findById` (active, workspace). Create `categoryRepository.test.ts`: `toCategory` with and without classification; parameters (`null` for absent filters); filter by classification uses the joined (active) classification; `null` on empty result; unique-violation mapping only for `idx_categories_name_type_active`; every statement filters `isactive = TRUE` and the workspace; `workspaceid` absent from output
- [X] T012 [US2] Create `finacial-planner/backend/src/services/categoryService.ts`: `CategoryService` with `createCategory`, `listCategories(filters)`, `getCategory`; `createCategoryService({ repository, classificationRepository })`. `createCategory`: when `classificationId` is a string, `classificationRepository.findById` returning `null` → `InvalidClassificationError` before any write; then `repository.create` (`null` → `WorkspaceUnavailableError`); `getCategory` `null` → `CategoryNotFoundError`. Create `categoryService.test.ts` with fakes (follow the convention): success with and without classification, `InvalidClassificationError` (and that `repository.create` is not called), `WorkspaceUnavailableError`, `CategoryNotFoundError`, filters passed through, empty list
- [X] T013 [US2] Create `finacial-planner/backend/src/controllers/categoryController.ts` (`type CategoryController = { create, list, getById, update, remove, reactivate }`; implement `create` → `201`, `list` (parse `listCategoriesQuerySchema` from `request.query`) → `200`, `getById` → `200`) with `categoryController.test.ts`; create `finacial-planner/backend/src/routes/categoryRoutes.ts` (`POST /`, `GET /`, `GET /:id`) with `categoryRoutes.test.ts`; edit `routesIndex.ts` (`RoutesDependencies` gains `category`; register with prefix `/categories`, removing the old commented lines for categories) and `src/index.ts` (`createCategoryRepository(query, defaultWorkspaceConfig.name)`, `createCategoryService({ repository, classificationRepository })`, `createCategoryController`); update `registerRoutes` call sites so `npx tsc` stays green
- [X] T014 [US2] Edit `app.test.ts`: add `createInMemoryCategoryRepository` over the shared store (join with the active classification on read; unique name per type among active ignoring case) and end-to-end scenarios: the three examples of the request (Gasolina/Automóvel, Supermercado/Comidas, Futvôlei/Lazer) listed with the right classification; Salário without classification → `classification: null`; same name in another type accepted, same name in the same type (other case) → 409; unknown or deactivated-classification id → 422 and nothing stored; invalid type, empty name, invalid `classificationId`, forbidden fields → 400; list filtered by classification, by type, by both, invalid filter → 400, unknown classification id → empty list; get by id / unknown 404 / invalid 400; no `workspaceId` in any response

**Checkpoint**: P1 completo: classificações e categorias cadastráveis e consultáveis

---

## Phase 5: User Story 3 - Alterar categoria e classificação (Priority: P2)

**Goal**: `PATCH` do nome de uma classificação e do nome e/ou classificação de uma categoria, sem mudar o tipo.

**Independent Test**: mover Futvôlei de Lazer para Esportes e consultar: nova classificação, mesmo `id` e `type`, `updatedAt` maior; `{"classificationId":null}` devolve `classification: null`; `{"type":"ENTRADA"}` devolve 400.

- [X] T015 [US3] Edit `classificationSchemas.ts`: add `updateClassificationSchema` (`name` required, same field definition, `.strict('Campo não permitido na alteração de classificação')`); edit `categorySchemas.ts`: add `updateCategorySchema` (`name` optional, `classificationId` optional UUID or `null`, `.strict('Campo não permitido na alteração de categoria')`, `.refine` requiring at least one key present with message `Informe ao menos um campo para alterar (name ou classificationId)`; `classificationId: null` counts as present); export `UpdateClassificationBody` and `UpdateCategoryBody`; extend both schema tests (only name, only classification, both, `null`, `{}` rejected with the message, `type`/`id`/`isActive`/`workspaceId` rejected, invalid values)
- [X] T016 [US3] Classification update across layers: `classificationRepository.ts` `update(id, { name })` → `UPDATE classifications SET name = $3, updatedat = NOW() WHERE id = $2 AND isactive = TRUE AND workspaceid = (...) RETURNING ...` (`null` when no row, unique violation → `UsedClassificationNameError`); `classificationService.ts` `updateClassification` (`null` → `ClassificationNotFoundError`); `classificationController.ts` `update` (parse id and body, `200`); `classificationRoutes.ts` `PATCH /:id`; each with tests, and extend the fakes in `classificationService.test.ts` and `app.test.ts`
- [X] T017 [US3] Category update across layers: `categoryRepository.ts` `update(id, { name?, classificationId? })` → `WITH changed AS (UPDATE categories SET name = COALESCE($3, name), classificationid = CASE WHEN $5::boolean THEN $4::uuid ELSE classificationid END, updatedat = NOW() WHERE id = $2 AND isactive = TRUE AND workspaceid = (...) RETURNING *) SELECT ...` with params `[workspace, id, name ?? null, classificationId ?? null, 'classificationId' in changes]` (the statement must not reference `type`; `null` when no row; unique violation → `UsedCategoryNameError`); `categoryService.ts` `updateCategory` (when `classificationId` is a string and `classificationRepository.findById` returns `null` → `InvalidClassificationError`; repository `null` → `CategoryNotFoundError`); `categoryController.ts` `update`; `categoryRoutes.ts` `PATCH /:id`; tests for each (including: `null` clears the link, absent key keeps it, `type` absent from the SQL text, `InvalidClassificationError` skips the write) and extend the fakes
- [X] T018 [US3] Edit `app.test.ts` with end-to-end scenarios: rename classification (categories show the new name), name in use → 409, own name in another case → 200, unknown/deactivated → 404; rename category, move to another classification, remove classification (`null`), rename + move together, same name in same type → 409, own name in another case → 200, move to unknown or deactivated classification → 422 and nothing changes, `type`/empty body/forbidden fields/invalid id → 400, deactivated or unknown category → 404

**Checkpoint**: US1 a US3 funcionam e podem ser testadas separadamente

---

## Phase 6: User Story 4 - Desativar categoria e classificação (Priority: P3)

**Goal**: desativação lógica de ambas (`DELETE`, 204); desativar classificação desvincula suas categorias ativas na mesma operação.

**Independent Test**: desativar uma classificação com categorias ativas: 204, some da lista e da consulta, e as categorias dela continuam ativas com `classification: null`; a linha continua no banco com `isactive = false`; desativar categoria nunca altera lançamentos.

- [X] T019 [US4] Classification deactivate across layers: `classificationRepository.ts` `deactivate(id)` → one statement: `WITH deactivated AS (UPDATE classifications SET isactive = FALSE, updatedat = NOW() WHERE id = $2 AND isactive = TRUE AND workspaceid = (...) RETURNING id), unlinked AS (UPDATE categories SET classificationid = NULL, updatedat = NOW() WHERE isactive = TRUE AND classificationid IN (SELECT id FROM deactivated)) SELECT id FROM deactivated`; returns `boolean`; `classificationService.ts` `deactivateClassification` (`false` → `ClassificationNotFoundError`); `classificationController.ts` `remove` (`204`, no body); `classificationRoutes.ts` `DELETE /:id`; tests for each (SQL contains no `DELETE FROM`, contains both updates in a single statement, only active categories are unlinked) and extend the fakes (the in-memory version also clears `classificationId` of active categories in the shared store)
- [X] T020 [US4] Category deactivate across layers: `categoryRepository.ts` `deactivate(id)` → `UPDATE categories SET isactive = FALSE, updatedat = NOW() WHERE id = $2 AND isactive = TRUE AND workspaceid = (...) RETURNING id`, returns `boolean` (the statement must not touch `transactions`); `categoryService.ts` `deactivateCategory` (`false` → `CategoryNotFoundError`); `categoryController.ts` `remove` (`204`); `categoryRoutes.ts` `DELETE /:id`; tests for each and extend the fakes
- [X] T021 [US4] Edit `app.test.ts` with end-to-end scenarios: deactivate category → 204, gone from list and get (404), repeat → 404, invalid id → 400, name reusable afterwards creating a new `id`; deactivate classification without categories → 204; with active categories → 204 and those categories remain active with `classification: null` (name and type unchanged); inactive categories of that classification are not touched; unknown/inactive classification → 404; classification name reusable afterwards

**Checkpoint**: ciclo de vida completo, exceto reativação

---

## Phase 7: User Story 5 - Reativar categoria e classificação (Priority: P3)

**Goal**: `POST /financial-control/classifications/:id/reactivate` e `POST /financial-control/categories/:id/reactivate` (200), sem religar categorias desvinculadas.

**Independent Test**: desativar e reativar uma categoria: volta à lista com o mesmo `id`; reativar com o nome em uso devolve 409; reativar registro já ativo devolve 409 "já está ativa"; reativar classificação não restaura o vínculo das categorias.

- [X] T022 [US5] Classification reactivate across layers: `classificationRepository.ts` gains `reactivate(id)` → `WITH reactivated AS (UPDATE classifications SET isactive = TRUE, updatedat = NOW() WHERE id = $2 AND isactive = FALSE AND workspaceid = (...) RETURNING ...), cleared AS (UPDATE categories SET classificationid = NULL, updatedat = NOW() WHERE classificationid IN (SELECT id FROM reactivated)) SELECT ... FROM reactivated` (`null` when no row; unique violation → `UsedClassificationNameError`) and `findActiveState(id)` → `SELECT isactive AS "isActive" FROM classifications WHERE id = $2 AND workspaceid = (...)` returning `true`, `false` or `null`; `classificationService.ts` `reactivateClassification` (row → return it; `null` → `findActiveState`: `true` → `ClassificationAlreadyActiveError`, otherwise `ClassificationNotFoundError`); `classificationController.ts` `reactivate` (parse id, `200`); `classificationRoutes.ts` `POST /:id/reactivate`; tests for each (the `cleared` update targets active **and** inactive categories) and extend the fakes
- [X] T023 [US5] Category reactivate across layers: `categoryRepository.ts` gains `reactivate(id)` → `WITH changed AS (UPDATE categories SET isactive = TRUE, classificationid = CASE WHEN EXISTS (SELECT 1 FROM classifications k WHERE k.id = categories.classificationid AND k.isactive = TRUE) THEN classificationid ELSE NULL END, updatedat = NOW() WHERE id = $2 AND isactive = FALSE AND workspaceid = (...) RETURNING *) SELECT ...` (`null` when no row; unique violation → `UsedCategoryNameError`) and `findActiveState(id)`; `categoryService.ts` `reactivateCategory` (same pattern with `CategoryAlreadyActiveError` / `CategoryNotFoundError`); `categoryController.ts` `reactivate`; `categoryRoutes.ts` `POST /:id/reactivate`; tests for each and extend the fakes
- [X] T024 [US5] Edit `app.test.ts` with end-to-end scenarios: reactivate category → 200, same `id`, back in list and get; name already used by an active category of the same type → 409; already active → 409 `CATEGORY_ALREADY_ACTIVE`; unknown → 404; invalid id → 400; category whose classification is inactive comes back with `classification: null`; same for classification (200, 409 name in use, 409 already active, 404, 400); after reactivating a classification, categories unlinked at deactivation stay `null`

**Checkpoint**: as cinco histórias funcionam

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T025 [P] Create the Postman folder `postman/collections/Financial Planner/Classifications/` (follow the structure and conventions of the `Accounts` folder, including `.resources/definition.yaml`): create (stores `createdClassificationId`), duplicated name (other case), invalid fields, forbidden fields, list, get by id / invalid id / unknown id, update (rename, name in use, empty body, forbidden fields), delete / delete again, get and update deleted, reactivate (ok, name in use, already active, unknown id, invalid id); each with `pm.test` assertions; per-run suffix variable so reruns do not collide
- [X] T026 [P] Create the Postman folder `postman/collections/Financial Planner/Categories/` (same conventions): create with classification (stores `createdCategoryId`), without classification, duplicated name same type, same name other type, unknown/deactivated classification (422), invalid fields, forbidden fields; list and filters (`classificationId`, `type`, both, invalid); get by id / invalid / unknown; update (rename, move, unlink with `null`, name in use, `type` forbidden, empty body); delete / delete again; classification deactivation unlinks the category; reactivate (ok, name in use, already active, classification inactive → `null`); each with `pm.test` assertions. The folder is self-contained: it creates its own classifications in the first requests (the collection run command gains `-i Classifications` and `-i Categories`, in any order)
- [X] T027 Update `CLAUDE.md`: new routes (including `POST /:id/reactivate`), structure (`config/classification.ts`, `config/category.ts`, the new controllers/services/repositories/schemas), the 7 new error classes, the `classifications` table and `categories.classificationid` in the database section, `SAIDA` without accent, unique indexes, Postman folders in the run command, current state (feature 004 and pending manual validation, `docker compose down -v` required). Keep `.specify/memory/constitution.md` and `specs/constitution.md` untouched
- [ ] T028 Run `npx tsc` and `npm test` in `finacial-planner/backend/` (both green) and walk through [quickstart.md](quickstart.md) on a throwaway Postgres built from the updated `schema.sql` plus the API on another port with inline env vars (never read `.env`); run the Postman `Classifications` and `Categories` folders against it; tear everything down afterwards. Also measure SC-002 with 1.000 active categories and 100 classifications, SC-004 with 100 concurrent creates of the same name (one 201, rest 409), the SC-006 query from the quickstart, and the `audit_log` rows for deactivation + unlink. **Parcial**: `npx tsc` e `npm test` verdes (479 testes); Postman rodado só contra a API com repositórios em memória (Classifications 27 requests/62 asserções, Categories 45 requests/98 asserções, 0 falhas). **Pendente**: tudo que exige Postgres (schema, SQL dos repositories, SC-002, SC-004, SC-006, auditoria)
- [ ] T029 Validation against the real `financial-control-db` (quickstart): requires `docker compose down -v` in `finacial-planner/` to reapply `schema.sql`, which **wipes the database**. Do not run without explicit user confirmation; if not confirmed, leave this task unchecked and annotated as pending. **Pendente**: não executado (destrutivo, aguardando confirmação)

---

## Dependencies & Execution Order

- Phase 1 (T001, T002) → Phase 2 (T003) → US1 → US2 → US3 → US4 → US5 → Polish.
- T001 e T002 são independentes entre si. T003 não depende deles.
- US2 depende de US1 (o service de categoria usa `classificationRepository.findById`; os fakes em memória compartilham armazenamento).
- Dentro de cada história a ordem é a numérica (schemas → repository → service → controller → rotas → ponta a ponta); em US3 a US5 a classificação vem antes da categoria.
- T025 e T026 podem rodar em paralelo depois de T024; T027 depois de T024; T028 depois de T025 a T027; T029 por último.

### Parallel Opportunities

- T001 e T002 em paralelo (arquivos diferentes).
- T025, T026 e T027 em paralelo após T024.
- As histórias não são paralelizáveis (mesmos arquivos), mas cada uma entrega valor sozinha.

## Implementation Strategy

- **MVP**: Phases 1–4 (T001–T014). Já dá para cadastrar e consultar classificações e categorias, incluindo os três exemplos do pedido; parar aí e validar com o Postman é seguro.
- **Incremental**: US3 (T015–T018), US4 (T019–T021) e US5 (T022–T024) entram depois, cada uma mantendo `npx tsc` e `npm test` verdes.
- **Segurança**: nenhuma tarefa roda `docker compose down -v` ou lê `.env`; a validação em banco real (T029) depende de confirmação humana.
