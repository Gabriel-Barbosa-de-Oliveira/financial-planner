---

description: "Task list for Contas (Accounts)"
---

# Tasks: Contas (Accounts)

**Input**: Design documents from `/specs/003-accounts/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/accounts.openapi.yaml](contracts/accounts.openapi.yaml), [quickstart.md](quickstart.md). O seed do workspace `familia` já está no `schema.sql`.

**Tests**: obrigatórios. A constitution (princípio 6) exige teste junto de toda lógica nova. Jest 29 em ESM: importar `describe`, `it`, `expect`, `jest` de `@jest/globals`; testes ao lado do código em `*.test.ts`; rodar com `npm test` (nunca `npx jest` direto).

**Organization**: tarefas agrupadas por história. As três histórias editam os mesmos arquivos (`accountRepository.ts`, `accountService.ts`, `accountController.ts`, `accountRoutes.ts`, `accountSchemas.ts`, `app.test.ts`), então **são implementadas em sequência**, US1 → US2 → US3.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência pendente)
- **[Story]**: história a que a tarefa pertence (US1, US2, US3)
- Cada tarefa cabe em um commit (`Feat:`, `Chore:`), e `npx tsc` + `npm test` ficam verdes ao fim de cada uma

## Path Conventions

- Backend: `finacial-planner/backend/src/` (grafia da pasta mantida)
- Banco: `finacial-planner/database/schema.sql`
- Postman: `postman/collections/Financial Planner/Accounts/`
- Imports relativos com extensão `.ts`; `import type` para tipos; tipos junto do código (sem `types.ts` e sem `index.ts` de re-export)
- Schemas zod em `controllers/schemas/account/accountSchemas.ts`
- Identificadores em inglês; só mensagens ao usuário em português
- SQL sempre estático e parametrizado (`$1`, `$2`); colunas públicas com alias camelCase via constante `PUBLIC_COLUMNS` (`id, name, type, balance, isactive AS "isActive", createdat AS "createdAt", updatedat AS "updatedAt"`; **sem** `workspaceid`)
- Toda instrução filtra `isactive = TRUE` e o workspace padrão pela subconsulta `workspaceid = (SELECT id FROM workspaces WHERE name = $n AND isactive = TRUE ORDER BY createdat ASC, id ASC LIMIT 1)`, com o nome do workspace passado como parâmetro
- Saldo trafega como **string** decimal; nunca converter para `number`

## Convenção para os fakes de repository

Quando `AccountRepository` ganha um método, todo fake tipado como `AccountRepository` deixa de compilar. A mesma tarefa que adiciona o método ao repository também estende os fakes em `src/services/accountService.test.ts` e em `src/app.test.ts` (`createInMemoryAccountRepository`), para `npx tsc` seguir verde. O fake em memória aplica as regras do banco: só linhas ativas, nome único entre ativas sem diferenciar caixa.

---

## Phase 1: Setup

**Purpose**: ajustes de schema e configuração usados por todas as histórias

- [X] T001 Edit `finacial-planner/database/schema.sql` in the `accounts` table: `balance DECIMAL(12, 2) NOT NULL DEFAULT 0.00`; add `CONSTRAINT check_account_type CHECK (type IN ('BANK', 'INVESTMENT', 'CASH', 'SAVINGS'))`; add `CREATE UNIQUE INDEX idx_accounts_name_active ON accounts(workspaceId, LOWER(name)) WHERE isActive = TRUE;` with a comment in Portuguese like the other partial indexes. Validate on a throwaway Postgres container (never the real `financial-control-db`, never `down -v`): script applies without errors, a type outside the list is rejected, two active accounts with names differing only by case are rejected, a deactivated account's name can be reused, `balance` rejects `NULL`
- [X] T002 [P] Create `finacial-planner/backend/src/config/workspace.ts` exporting `defaultWorkspaceConfig = { name: 'familia' }`, and `finacial-planner/backend/src/config/account.ts` exporting `accountConfig = { types: ['BANK', 'INVESTMENT', 'CASH', 'SAVINGS'] as const, name: { maxLength: 100 }, balance: { pattern: /^-?\d{1,10}(\.\d{1,2})?$/, default: '0.00' } }` and `type AccountType = typeof accountConfig.types[number]`. No test needed beyond usage in later schema tests (plain constants)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: erros de domínio que as três histórias usam

**⚠️ CRITICAL**: nenhuma história começa antes desta fase

- [X] T003 Edit `finacial-planner/backend/src/utils/errors.ts`: add `AccountNotFoundError` (`ACCOUNT_NOT_FOUND`, 404, `Conta não encontrada`), `UsedAccountNameError` (`USED_ACCOUNT_NAME`, 409, `Já existe uma conta com este nome`) and `WorkspaceUnavailableError` (`WORKSPACE_UNAVAILABLE`, 422, `Workspace padrão não encontrado`), all `extends DomainError`; extend `errors.test.ts` covering code, status, message, `instanceof DomainError` and `name` for each

**Checkpoint**: base pronta; as histórias podem começar

---

## Phase 3: User Story 1 - Cadastrar e consultar contas (Priority: P1) 🎯 MVP

**Goal**: cadastrar conta e listar/consultar contas ativas (`POST` e `GET /financial-control/accounts`, `GET /financial-control/accounts/:id`).

**Independent Test**: `POST` `{"name":"Nubank","type":"BANK","balance":"1500.00"}` devolve 201 com saldo `"1500.00"`; a conta aparece na lista e na consulta por id; nome repetido devolve 409; entrada inválida devolve 400 por campo.

- [X] T004 [US1] Create `finacial-planner/backend/src/controllers/schemas/account/accountSchemas.ts`: `createAccountSchema` (`name`: string, `trim`, min 1, max `accountConfig.name.maxLength`; `type`: `z.enum(accountConfig.types)`; `balance`: optional string matching `accountConfig.balance.pattern`, default `accountConfig.balance.default`; `.strict('Campo não permitido no cadastro de conta')`; every message in Portuguese, e.g. `Nome é obrigatório`, `Tipo inválido (use BANK, INVESTMENT, CASH ou SAVINGS)`, `Saldo deve ser um valor decimal com até 2 casas`) and `accountIdParamsSchema` (UUID, message `Identificador inválido`); export `CreateAccountBody`. Create `accountSchemas.test.ts` covering: valid body; trim of name; default balance `0.00`; negative, zero and integer balances accepted; balance `1,5`, `1.234`, `abc`, number type and 11 integer digits rejected; empty/blank name and 101 chars rejected; type `XYZ` and lowercase `bank` rejected; missing name/type; extra fields (`id`, `workspaceId`, `isActive`, `createdAt`) rejected; UUID accepted, `abc` rejected with `Identificador inválido`
- [X] T005 [US1] Create `finacial-planner/backend/src/repositories/accountRepository.ts`: types `Account` (`id`, `name`, `type: AccountType`, `balance: string`, `isActive`, `createdAt`, `updatedAt`), `NewAccount` (`name`, `type`, `balance`), `Query`, `AccountRepository`; `createAccountRepository(query, workspaceName)` with `create` (`INSERT INTO accounts (workspaceid, name, type, balance) SELECT w.id, $2, $3, $4 FROM workspaces w WHERE w.name = $1 AND w.isactive = TRUE ORDER BY w.createdat ASC, w.id ASC LIMIT 1 RETURNING ...`; returns `null` when no row; `23505` on `idx_accounts_name_active` → `UsedAccountNameError`, anything else rethrown), `findAll` (ordered by `createdat ASC, id ASC`) and `findById` (`null` when absent). Create `accountRepository.test.ts` with a fake `query`: asserts parameters order and that the workspace name is passed, `RETURNING`/`SELECT` lists the public columns without `workspaceid`, `isactive = TRUE` in every statement, `null` on empty result, unique violation mapping vs. other errors rethrown, balance returned as the string received
- [X] T006 [US1] Create `finacial-planner/backend/src/services/accountService.ts`: `AccountService` with `createAccount` (calls `repository.create`; `null` → `WorkspaceUnavailableError`), `listAccounts`, `getAccount` (`null` → `AccountNotFoundError`); `createAccountService({ repository })`. Create `accountService.test.ts` with a fake repository (follow the fakes convention) covering success, `WorkspaceUnavailableError`, `AccountNotFoundError`, empty list
- [X] T007 [US1] Create `finacial-planner/backend/src/controllers/accountController.ts`: `type AccountController = { create, list, getById, update, remove }` as `RouteHandlerMethod`; in this task implement `create` (parse with `createAccountSchema`, `201`), `list` (`200`) and `getById` (parse `accountIdParamsSchema`, `200`); `update` and `remove` are added in US2/US3 (keep the type limited to the implemented handlers until then, widening it in those tasks). Create `accountController.test.ts` with a fake service via `app.inject`: status codes, validation errors reach the global handler as 400 with `issues`, `DomainError` mapped to its status
- [X] T008 [US1] Create `finacial-planner/backend/src/routes/accountRoutes.ts` (`AccountRoutesOptions = { controller: AccountController }`; `POST /`, `GET /`, `GET /:id`) and `accountRoutes.test.ts`; edit `routesIndex.ts` (`RoutesDependencies` gains `account: AccountRoutesOptions`; register `accountRoutes` with prefix `/accounts`); edit `src/index.ts` composition root (`createAccountRepository(query, defaultWorkspaceConfig.name)`, `createAccountService`, `createAccountController`) and update the existing `userRoutes`/`app.test.ts` call sites of `registerRoutes` so `npx tsc` stays green
- [X] T009 [US1] Edit `finacial-planner/backend/src/app.test.ts`: add `createInMemoryAccountRepository` (active-only, unique name among active ignoring case, `create` returning `null` when configured with no workspace) and end-to-end scenarios through the real Fastify instance: create with and without balance (default `"0.00"`), balance returned as string, name trim, case-insensitive duplicate → 409, validation errors → 400 with `issues`, forbidden fields → 400, list empty and ordered, get by id / unknown id 404 / invalid id 400, no `workspaceId` in any response, workspace missing → 422, unexpected error → generic 500 without internals

**Checkpoint**: P1 entrega cadastro e consulta de contas, o suficiente para usar o sistema

---

## Phase 4: User Story 2 - Alterar conta (Priority: P2)

**Goal**: alterar nome e/ou tipo de uma conta ativa (`PATCH /financial-control/accounts/:id`), sem tocar no saldo.

**Independent Test**: renomear uma conta e consultar de novo: novo nome, mesmo `id`, mesmo saldo, `updatedAt` maior; `PATCH` com `balance` devolve 400.

- [X] T010 [US2] Edit `accountSchemas.ts`: add `updateAccountSchema` (`name` and `type` optional reusing the shared field definitions from `createAccountSchema`, `.strict('Campo não permitido na alteração de conta')`, `.refine` requiring at least one with message `Informe ao menos um campo para alterar (name ou type)`); export `UpdateAccountBody`; extend `accountSchemas.test.ts`: only name, only type, both; trim; `{}` rejected with the message; `balance`, `id`, `isActive`, `workspaceId` rejected; invalid type/name rejected
- [X] T011 [US2] Edit `accountRepository.ts`: add `update(id, { name?, type? })` → `UPDATE accounts SET name = COALESCE($2, name), type = COALESCE($3, type), updatedat = NOW() WHERE id = $1 AND isactive = TRUE AND workspaceid = (...) RETURNING ...`, `null` when no row, `23505` → `UsedAccountNameError`; the statement must not reference `balance`. Extend `accountRepository.test.ts` (parameters, nulls for absent fields, `updatedat = NOW()`, no `balance` in the SQL text, unique violation mapping) and extend the fakes in `accountService.test.ts` and `app.test.ts`
- [X] T012 [US2] Edit `accountService.ts` (`updateAccount`: `null` → `AccountNotFoundError`) with tests; edit `accountController.ts` (`update`: parse id and body, `200`) with tests; edit `accountRoutes.ts` (`PATCH /:id`) with a route test
- [X] T013 [US2] Edit `app.test.ts` with end-to-end scenarios: rename and retype keep `id`, `balance` and refresh `updatedAt`; same name in another case accepted; another active account's name → 409 and nothing changes; deactivated or unknown id → 404; empty body / `balance` / forbidden fields / invalid id → 400; name of a deactivated account reusable

**Checkpoint**: US1 e US2 funcionam e podem ser testadas separadamente

---

## Phase 5: User Story 3 - Desativar conta (Priority: P3)

**Goal**: desativação lógica (`DELETE /financial-control/accounts/:id`, 204).

**Independent Test**: desativar uma conta; ela some da lista e da consulta (404), mas a linha continua no banco com `isactive = false`.

- [X] T014 [US3] Edit `accountRepository.ts`: add `deactivate(id)` → `UPDATE accounts SET isactive = FALSE, updatedat = NOW() WHERE id = $1 AND isactive = TRUE AND workspaceid = (...) RETURNING ...`, returns `boolean`. Extend `accountRepository.test.ts` (including a test asserting that no SQL statement in the repository contains `DELETE`) and the fakes in `accountService.test.ts` and `app.test.ts`
- [X] T015 [US3] Edit `accountService.ts` (`deactivateAccount`: `false` → `AccountNotFoundError`), `accountController.ts` (`remove`: parse id, `204` with no body) and `accountRoutes.ts` (`DELETE /:id`), each with tests
- [X] T016 [US3] Edit `app.test.ts` with end-to-end scenarios: deactivate → 204, disappears from list and get (404), repeat → 404, unknown id → 404, invalid id → 400, name reusable afterwards creating a new `id`, other accounts untouched

**Checkpoint**: as três histórias funcionam

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T017 [P] Create the Postman folder `postman/collections/Financial Planner/Accounts/` (follow the structure and conventions of the `Users` folder, including `.resources/definition.yaml` and examples): requests for create (stores `createdAccountId`), duplicated name, invalid fields (type, name empty/long, balance formats), forbidden fields, create without balance, list, get by id / invalid id / unknown id, update (name, type, same name other case, name in use, empty body, `balance` forbidden, unknown id), delete / delete again, get and update deleted, list without deleted, create with the deleted account's name; each with `pm.test` assertions; use a per-run suffix variable so reruns do not collide with names. Run `postman collection lint` and fix findings
- [X] T018 Update `CLAUDE.md`: new routes, `src/config/workspace.ts` and `account.ts`, seed of the `familia` workspace and owner user in the DB section, Postman `Accounts` folder in the run command, current state (feature 003 and pending manual validation). Keep `.specify/memory/constitution.md` and `specs/constitution.md` untouched
- [X] T019 Run `npx tsc` and `npm test` in `finacial-planner/backend/` (both green) and walk through [quickstart.md](quickstart.md) on a throwaway Postgres built from the updated `schema.sql` plus the API on another port with inline env vars (never read `.env`), then run the Postman `Accounts` folder against it; tear everything down afterwards. Also measure SC-002 with 1.000 active accounts and SC-004 with concurrent creates of the same name
- [ ] T020 Validation against the real `financial-control-db` (quickstart): requires `docker compose down -v` in `finacial-planner/` to reapply `schema.sql`, which **wipes the database**. Do not run without explicit user confirmation; if not confirmed, leave this task unchecked and annotated. **Pendente**: não executado (destrutivo, aguardando confirmação). O mesmo roteiro foi validado em Postgres descartável (51 requests/133 asserções no Postman, 100 POST simultâneos → 1×201 e 99×409, 1.000 contas: lista ~22 ms, get/patch/delete 2–5 ms)

---

## Dependencies & Execution Order

- Phase 1 (T001, T002) → Phase 2 (T003) → US1 → US2 → US3 → Polish.
- T001 e T002 são independentes entre si. T003 não depende deles.
- Dentro de cada história a ordem é a numérica (schema → repository → service → controller → rotas → ponta a ponta).
- T017 pode começar depois de T016 (rotas completas); T018 depois de T016; T019 depois de T017 e T018; T020 por último.

### Parallel Opportunities

- T001 e T002 em paralelo (arquivos diferentes).
- T017 e T018 em paralelo após T016.
- As histórias não são paralelizáveis (mesmos arquivos), mas cada uma entrega valor sozinha.

## Implementation Strategy

- **MVP**: Phases 1–3 (T001–T009). Já dá para cadastrar e consultar contas; parar aí e validar com o Postman é seguro.
- **Incremental**: US2 (T010–T013) e US3 (T014–T016) entram depois, cada uma mantendo `npx tsc` e `npm test` verdes.
- **Segurança**: nenhuma tarefa roda `docker compose down -v` ou lê `.env`; a validação em banco real (T020) depende de confirmação humana.
