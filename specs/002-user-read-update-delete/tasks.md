---

description: "Task list for Consulta, Alteração e Desativação de Usuário"
---

# Tasks: Consulta, Alteração e Desativação de Usuário

**Input**: Design documents from `/specs/002-user-read-update-delete/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/user-read-update-delete.openapi.yaml](contracts/user-read-update-delete.openapi.yaml), [quickstart.md](quickstart.md). Código existente da feature [001-user-crud](../001-user-crud/tasks.md) (cadastro) já implementado.

**Tests**: obrigatórios. A constitution (princípio 6) exige teste junto de toda lógica nova. Jest 29 em ESM: importar `describe`, `it`, `expect`, `jest` de `@jest/globals`; testes ao lado do código em `*.test.ts`; rodar com `npm test` (nunca `npx jest` direto).

**Organization**: tarefas agrupadas por história. As três histórias editam os mesmos arquivos (`userRepository.ts`, `userService.ts`, `userController.ts`, `userRoutes.ts`, `app.test.ts`), então **são implementadas em sequência**, na ordem US1 → US2 → US3, mesmo sendo independentes entre si em comportamento.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência pendente)
- **[Story]**: história a que a tarefa pertence (US1, US2, US3)
- Cada tarefa cabe em um commit (`Feat:`, `Chore:`), e `npx tsc` + `npm test` ficam verdes ao fim de cada uma

## Path Conventions

- Backend: `finacial-planner/backend/src/` (grafia da pasta mantida)
- Postman: `postman/collections/Financial Planner/Users/`
- Imports relativos com extensão `.ts`; `import type` para tipos; tipos junto do código (sem `types.ts` e sem `index.ts` de re-export)
- Schemas zod em `controllers/schemas/user/userSchemas.ts`
- Identificadores em inglês; só mensagens ao usuário em português
- SQL sempre estático e parametrizado (`$1`, `$2`), com filtro `isactive = TRUE`; colunas públicas sempre com alias camelCase e **nunca** `password_hash` no `RETURNING`/`SELECT`

## Convenção para os fakes de repository

Quando `UserRepository` ganha um método, todo fake tipado como `UserRepository` deixa de compilar. Por isso **a mesma tarefa que adiciona o método ao repository também estende os fakes** em `src/services/userService.test.ts` (o objeto `repository` de `setup()`) e em `src/app.test.ts` (`createInMemoryRepository`), para `npx tsc` seguir verde. No `app.test.ts`, o fake em memória aplica as mesmas regras do banco: só linhas com `isActive`, e-mail único entre ativos.

---

## Phase 1: Setup

Sem tarefas. Nenhuma dependência nova, nenhuma mudança em `schema.sql` (o índice único parcial e o trigger de auditoria sem `password_hash` já existem desde a feature 001) e nenhuma configuração nova.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: erro de domínio, schemas e contrato do controller que as três histórias usam

**⚠️ CRITICAL**: nenhuma história começa antes desta fase

- [X] T001 [P] Edit `finacial-planner/backend/src/utils/errors.ts`: add `UserNotFoundError extends DomainError` (`code` `USER_NOT_FOUND`, `statusCode` 404, message `Usuário não encontrado`); extend `errors.test.ts` covering code, status, message, `instanceof DomainError` and `name`
- [X] T002 [P] Edit `finacial-planner/backend/src/controllers/schemas/user/userSchemas.ts`: extract the existing `email` and `password` field definitions into shared constants (same rules and messages as `createUserSchema`, which must keep behaving exactly the same); add `userIdParamsSchema` (`z.object({ id: z.string().uuid('Identificador inválido') })`) and `updateUserSchema` (`email` and `password` both optional using the shared constants, `.strict('Campo não permitido na alteração de usuário')`, plus a `.refine` requiring at least one of them with message `Informe ao menos um campo para alterar (email ou password)`); export `UpdateUserBody` type; extend `userSchemas.test.ts` covering: valid UUID accepted and `abc` / empty rejected with `Identificador inválido`; update with only email, only password and both; email normalization (`'  Ana@Exemplo.com '` → `ana@exemplo.com`); `{}` rejected with the "ao menos um campo" message; extra fields (`id`, `isActive`, `createdAt`, `updatedAt`) rejected; password 7/8/72/73 boundaries; the existing `createUserSchema` tests still pass
- [X] T003 [P] Refactor the controller contract without changing behavior: in `finacial-planner/backend/src/controllers/userController.ts` export `type UserController = { create: RouteHandlerMethod }` and make `createUserController(service)` return `{ create }` (the current handler becomes `create`); in `finacial-planner/backend/src/routes/userRoutes.ts` change `UserRoutesOptions` to `{ controller: UserController }` and register `app.post('/', options.controller.create)`; in `finacial-planner/backend/src/routes/routesIndex.ts` keep `RoutesDependencies = { user: UserRoutesOptions }`; in `finacial-planner/backend/src/index.ts` pass `{ user: { controller: createUserController(userService) } }`; update `userController.test.ts` (`app.post('/users', controller.create)`), `userRoutes.test.ts` (fake controller `{ create }`) and `app.test.ts` accordingly. All existing tests must keep passing with the same assertions

**Checkpoint**: base pronta; as histórias podem começar

---

## Phase 3: User Story 1 - Consultar usuários (Priority: P1) 🎯 MVP

**Goal**: listar os usuários ativos e consultar um usuário ativo pelo identificador (`GET /financial-control/users` e `GET /financial-control/users/:id`).

**Independent Test**: com usuários ativos e desativados, `GET /users` devolve só os ativos por ordem de criação (ou `[]`), `GET /users/:id` devolve o usuário sem senha, `GET /users/abc` dá 400 "Identificador inválido" e um id inexistente ou desativado dá 404 "Usuário não encontrado".

### Implementation for User Story 1

- [X] T004 [US1] Edit `finacial-planner/backend/src/repositories/userRepository.ts`: extract the public column list (`id, email, isactive AS "isActive", createdat AS "createdAt", updatedat AS "updatedAt"`) into one constant reused by every statement (including the existing `INSERT ... RETURNING`); add `findAll(): Promise<User[]>` running `SELECT <public columns> FROM users WHERE isactive = TRUE ORDER BY createdat ASC, id ASC` with params `[]`, and `findById(id): Promise<User | null>` running the same `SELECT` with `AND id = $1` and returning `null` when no row matches; extend `userRepository.test.ts` (fake `query`) verifying the SQL text contains `isactive = TRUE`, the ordering clause, `$1` for the id, no interpolated values, no `password_hash` in the selected columns, `null` on an empty result, and that errors from `query` propagate; per the fake convention, extend the `repository` fake in `userService.test.ts` and `createInMemoryRepository` in `app.test.ts` with `findAll`/`findById`. Depends on T003
- [X] T005 [US1] Edit `finacial-planner/backend/src/services/userService.ts`: add `listUsers(): Promise<User[]>` and `getUser(id): Promise<User>` to `UserService`; `getUser` throws `UserNotFoundError` when the repository returns `null`; extend `userService.test.ts` covering: the list is passed through unchanged (including `[]`), `getUser` returns the user, `getUser` throws `UserNotFoundError` on `null`, and results never contain a password or hash field. Depends on T001, T004
- [X] T006 [US1] Edit `finacial-planner/backend/src/controllers/userController.ts`: add `list` (replies 200 with the array) and `getById` (parses `request.params` with `userIdParamsSchema`, replies 200 with the user) to `UserController`/`createUserController`; extend `userController.test.ts` (fake service, `app.inject`) covering: 200 with an array and with `[]`; 200 for a valid id and the service called with that id; 400 with `issues[0].field === 'id'` and message `Identificador inválido` for `abc` without calling the service; 404 `USER_NOT_FOUND` / `Usuário não encontrado` when the service throws `UserNotFoundError`; responses never contain `password` or `hash`. Depends on T002, T005
- [X] T007 [US1] Edit `finacial-planner/backend/src/routes/userRoutes.ts`: register `GET /` → `controller.list` and `GET /:id` → `controller.getById`; extend `userRoutes.test.ts` checking both reach the fake controller under `/financial-control/users`, and that `PUT` and `DELETE` on `/financial-control/users` still return 404. Depends on T006
- [X] T008 [US1] Edit `finacial-planner/backend/src/app.test.ts`: add end-to-end cases (real service, controller and hasher; in-memory repository) for `GET /financial-control/users` (empty list, then ordered list after two `POST`s, deactivated users absent via a direct fake-repository state change) and `GET /financial-control/users/:id` (200, 400 invalid id, 404 unknown id); extend the existing "nunca expõe a senha nem o hash" test to also cover these responses, the captured Fastify log lines and the captured `console.error`/`console.log` output. Depends on T007

**Checkpoint**: US1 funcional e testável sem banco real

---

## Phase 4: User Story 2 - Alterar usuário (Priority: P2)

**Goal**: alterar e-mail e/ou senha de um usuário ativo (`PATCH /financial-control/users/:id`), com as mesmas regras do cadastro.

**Independent Test**: `PATCH` com um e-mail livre devolve 200 com o novo e-mail normalizado e `updatedAt` renovado; com o e-mail de outro usuário ativo dá 409; com o próprio e-mail dá 200; com `{}`, campo proibido, senha fora da regra ou id inválido dá 400; com usuário inexistente ou desativado dá 404.

### Implementation for User Story 2

- [X] T009 [US2] Edit `finacial-planner/backend/src/repositories/userRepository.ts`: add `update(id, { email?, passwordHash? }): Promise<User | null>` running the static statement `UPDATE users SET email = COALESCE($2, email), password_hash = COALESCE($3, password_hash), updatedat = NOW() WHERE id = $1 AND isactive = TRUE RETURNING <public columns>` with params `[id, email ?? null, passwordHash ?? null]`; return `null` when no row is affected; reuse the existing unique-violation check so `23505` on `idx_users_email_active` becomes `UsedEmailError` and any other error is rethrown; extend `userRepository.test.ts` covering: params order and `null` for omitted fields, SQL contains `isactive = TRUE` and `updatedat = NOW()`, no `password_hash` in `RETURNING`, `null` when no row, `23505` on the e-mail index → `UsedEmailError`, `23505` on another constraint and other errors rethrown as-is; extend the two fakes (`userService.test.ts`, `app.test.ts`) with `update` (in-memory: only active rows, e-mail uniqueness among *other* active rows, renewing `updatedAt`). Depends on T008
- [X] T010 [US2] Edit `finacial-planner/backend/src/services/userService.ts`: add `updateUser(id, { email?, password? }): Promise<User>`; hash the password with the injected hasher **only when it was provided**, call `repository.update(id, { email, passwordHash })`, throw `UserNotFoundError` on `null`; extend `userService.test.ts` covering: e-mail-only update does not call the hasher and sends no hash, password-only update sends the hash (never the plain password) and no e-mail, both together, `UserNotFoundError` on `null`, `UsedEmailError` propagated, result without password/hash. Depends on T009
- [X] T011 [US2] Edit `finacial-planner/backend/src/controllers/userController.ts`: add `update` to `UserController`/`createUserController` — parse `request.params` with `userIdParamsSchema` first, then `request.body` with `updateUserSchema`, call `service.updateUser(id, body)`, reply 200 with the user; extend `userController.test.ts` covering: 200 with normalized e-mail; 200 password-only; 400 for invalid id (service not called); 400 with `issues[0].field === 'body'` for `{}`; 400 for forbidden fields (`id`, `isActive`, `createdAt`, `updatedAt`), invalid e-mail, short/long password; 404 and 409 translated from the service errors; id validation reported before body validation; responses never contain the password value. Depends on T010
- [X] T012 [US2] Edit `finacial-planner/backend/src/routes/userRoutes.ts`: register `PATCH /:id` → `controller.update`; extend `userRoutes.test.ts` checking it reaches the fake controller, and that `PUT` on `/financial-control/users/:id` still returns 404. Depends on T011
- [X] T013 [US2] Edit `finacial-planner/backend/src/app.test.ts`: add end-to-end cases for `PATCH`: e-mail change (normalized, `updatedAt` after `createdAt`, id unchanged), password change, e-mail and password together, 409 when taking another active user's e-mail (and the user is unchanged afterwards), 200 when sending the user's own e-mail in a different case, 200 when taking the e-mail of a deactivated user, 400 for `{}` and for forbidden fields, 404 for unknown and deactivated ids; extend the "nunca expõe a senha nem o hash" test to cover these responses, the captured Fastify log and the captured console output. Depends on T012

**Checkpoint**: US1 e US2 funcionam de forma independente

---

## Phase 5: User Story 3 - Desativar usuário (Priority: P3)

**Goal**: desativar logicamente um usuário (`DELETE /financial-control/users/:id`): `isActive` vira falso, nada é apagado, e o usuário passa a ser tratado como inexistente.

**Independent Test**: `DELETE` em um usuário ativo dá 204 sem corpo; depois disso `GET`, `PATCH` e `DELETE` no mesmo id dão 404, ele some da lista, o registro continua no banco com `isactive = false`, e o e-mail pode ser cadastrado de novo.

### Implementation for User Story 3

- [X] T014 [US3] Edit `finacial-planner/backend/src/repositories/userRepository.ts`: add `deactivate(id): Promise<boolean>` running `UPDATE users SET isactive = FALSE, updatedat = NOW() WHERE id = $1 AND isactive = TRUE RETURNING <public columns>` with params `[id]` and returning whether a row was affected; there must be **no** `DELETE FROM` anywhere in the repository; extend `userRepository.test.ts` covering: SQL contains `isactive = FALSE`, `updatedat = NOW()` and `isactive = TRUE` in the `WHERE`, `$1` param, `true` when a row is returned, `false` when none, error propagation, and a test asserting that no SQL statement issued by any repository method contains `DELETE`; extend the two fakes (`userService.test.ts`, `app.test.ts`) with `deactivate` (in-memory: flips `isActive` to false and renews `updatedAt`, never removes the row). Depends on T013
- [X] T015 [US3] Edit `finacial-planner/backend/src/services/userService.ts`: add `deactivateUser(id): Promise<void>` that throws `UserNotFoundError` when `repository.deactivate` returns `false`; extend `userService.test.ts` covering success and `UserNotFoundError`. Depends on T014
- [X] T016 [US3] Edit `finacial-planner/backend/src/controllers/userController.ts`: add `remove` to `UserController`/`createUserController` — parse `request.params` with `userIdParamsSchema`, call `service.deactivateUser(id)`, reply `204` with no body; extend `userController.test.ts` covering: 204 with an empty body; 400 for invalid id (service not called); 404 translated from `UserNotFoundError`. Depends on T015
- [X] T017 [US3] Edit `finacial-planner/backend/src/routes/userRoutes.ts`: register `DELETE /:id` → `controller.remove`; extend `userRoutes.test.ts` checking it reaches the fake controller. Depends on T016
- [X] T018 [US3] Edit `finacial-planner/backend/src/app.test.ts`: add end-to-end cases for the full lifecycle: `DELETE` → 204; then `GET`, `PATCH` and `DELETE` on the same id → 404 and the user absent from `GET /users`; the row still exists in the fake repository with `isActive === false` (nothing removed); `POST` with the deactivated user's e-mail → 201 with a different `id`; related data untouched is out of reach of the fake, so only assert that no other users changed. Depends on T017

**Checkpoint**: CRUD completo e testado sem banco real

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T019 Edit the Postman collection under `postman/collections/Financial Planner/Users/` (shared prep + read requests): in `Create user.request.yaml` also store the created id with `pm.collectionVariables.set('createdUserId', user.id)` in the `afterResponse` script; in `Create user - minimum password.request.yaml` store `secondUserId` and `secondUserEmail` the same way; add `List users.request.yaml` (200, array, contains `createdUserId`, every item has exactly the 5 public fields, no `password`/`hash`, ordered by `createdAt`), `Get user by id.request.yaml` (200, same fields, `id` equals `createdUserId`), `Get user - invalid id.request.yaml` (`GET .../users/abc` → 400, `issues` field `id`, `Identificador inválido`) and `Get user - not found.request.yaml` (valid unknown UUID → 404 `USER_NOT_FOUND`); `order` values spaced after the existing ones (9000+), a `description` on each, single-quoted `{{variables}}`, and saved examples for the 200 and 404 cases under `Users/.resources/<request>.resources/examples/`. Depends on T018
- [X] T020 [P] Add to the same folder the update requests (`order` 10000+): `Update user - email.request.yaml` (PATCH `createdUserId` with `"  Novo.<timestamp>@Exemplo.com "` → 200, normalized, `updatedAt` greater than `createdAt`, same `id`), `Update user - password.request.yaml` (200, no password in the response), `Update user - same email.request.yaml` (own e-mail in another case → 200), `Update user - email in use.request.yaml` (e-mail of `secondUserEmail` → 409 `USED_EMAIL`), `Update user - empty body.request.yaml` (`{}` → 400, field `body`), `Update user - forbidden fields.request.yaml` (`isActive`, `id` → 400), `Update user - not found.request.yaml` (unknown UUID → 404); every test also asserts the password value and `scrypt` never appear in the response text. Depends on T019
- [X] T021 [P] Add to the same folder the deactivation requests (`order` 11000+, running after the update requests): `Delete user.request.yaml` (DELETE `createdUserId` → 204, empty body), `Delete user - already deleted.request.yaml` (→ 404), `Get user - deleted.request.yaml` (→ 404), `Update user - deleted.request.yaml` (→ 404), `List users - without deleted.request.yaml` (200, `createdUserId` absent, `secondUserId` present), `Create user - email of deleted user.request.yaml` (POST with the deleted user's e-mail → 201 and a new `id` different from `createdUserId`); save the 204 example. Depends on T019
- [X] T022 Validate the collection without touching the real database: run `postman collection lint "postman/collections/Financial Planner"`; start a throwaway Postgres from the project image with the current `schema.sql` mounted (`docker run -d --rm --name schema-check -p 5433:5432 -v "$PWD/finacial-planner/database/schema.sql:/docker-entrypoint-initdb.d/01-schema.sql:ro" finacial-planner-postgres`), start the API with inline env vars (`DB_HOST=localhost DB_PORT=5433 DB_USER=financial_user DB_PASSWORD=secure_password_123 DB_NAME=financial_control_db PORT=8099 NODE_ENV=test node src/index.ts`, never reading `.env`), run `postman collection run "postman/collections/Financial Planner" -e "postman/environments/Financial Planner Environment.environment.yaml" --env-var BASE_URL=http://localhost:8099 -i Users`, report assertion counts and exit code, check in that database that the deactivated user still exists with `isactive = false` and that `audit_log` has no `password_hash` and no `DELETE` action for `users`, then stop the API and the container. Depends on T020, T021
- [X] T023 Run `npx tsc` and `npm test` in `finacial-planner/backend/`; fix anything red; report the actual output. Depends on T018
- [ ] T024 (pendente só contra o banco real, que depende de confirmação do usuário; o SC-005 já foi medido em um Postgres descartável: lista com 1.000 ativos em ~15 ms, consulta/alteração/desativação em 2 a 4 ms com 10.000 usuários) Ask the user for confirmation, then run the manual scenarios of [quickstart.md](quickstart.md) against the real Postgres. No schema change is needed **if** the real database already has the schema of feature 001 (`idx_users_email_active`); if it still has the old schema, the 409 scenarios would fail with a 500, and reapplying it needs `docker compose down -v` (destructive: wipes database data; same pending item as T014 of feature 001). Also measure SC-005: seed about 1,000 active users and confirm `GET /users` answers in under 1 second. Depends on T022, T023
- [X] T025 [P] Update `CLAUDE.md`: routes available (`GET /financial-control/users`, `GET`/`PATCH`/`DELETE /financial-control/users/:id`), the new `UserController` shape and `UserNotFoundError` in the architecture section, the current state (CRUD de usuário completo e aberto, sem autenticação, não vai para produção assim) and the Postman folder contents. Depends on T023

---

## Dependencies & Execution Order

- **Phase 2** primeiro: T001, T002 e T003 em paralelo (arquivos diferentes)
- **Fases 3, 4 e 5 em sequência** (US1 → US2 → US3): editam os mesmos arquivos; dentro de cada história a ordem é repository → service → controller → routes → ponta a ponta
- T005 depende de T001 e T004; T006 depende de T002 e T005
- **Fase 6**: T019 depois de T018; T020 e T021 em paralelo depois de T019; T022 depois de T020 e T021; T023 depois de T018; T024 depois de T022 e T023 e com confirmação humana; T025 em paralelo com T024 depois de T023

### Parallel Example

```text
Phase 2:  T001  ||  T002  ||  T003
Phase 6:  T020  ||  T021      (após T019)
Phase 6:  T024  ||  T025      (após T023; T024 também após T022)
```

## Implementation Strategy

1. **Fundação** (T001–T003): nada muda de comportamento; o `POST /users` segue igual e os testes existentes continuam verdes.
2. **MVP = US1** (T004–T008): consulta, já validável por testes sem banco.
3. **US2** (T009–T013) e **US3** (T014–T018): cada uma fecha com um teste ponta a ponta, incluindo o teste de vazamento de senha e hash.
4. **Polish** (T019–T025): collection do Postman validada num Postgres descartável, typecheck/testes, validação no banco real com confirmação e documentação.

## Notes

- Um commit por tarefa, no formato `Tipo: descrição`; branch `feature/create-user`.
- Nunca ler nem commitar `.env`; nenhum segredo nos testes.
- Nenhuma tarefa cria `DELETE FROM`: remover é sempre desativar (FR-010); a T014 testa isso.
- Fora do escopo (não criar tarefas): login, autenticação, reativação, paginação, filtros, desativação em cascata de workspaces, remoção do `healthRoutes.ts`.
