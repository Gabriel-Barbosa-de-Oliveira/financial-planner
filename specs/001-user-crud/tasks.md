---

description: "Task list for Cadastro de Usuário"
---

# Tasks: Cadastro de Usuário

**Input**: Design documents from `/specs/001-user-crud/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/create-user.openapi.yaml](contracts/create-user.openapi.yaml), [quickstart.md](quickstart.md)

**Tests**: obrigatórios. A constitution (princípio 6) exige teste junto de toda lógica nova. Jest 29 em ESM: importar `describe`, `it`, `expect` de `@jest/globals`; testes ao lado do código em `*.test.ts`; rodar com `npm test` (nunca `npx jest` direto).

**Organization**: a spec tem uma única história (US1, cadastro). Consulta, listagem, alteração e desativação ficam fora desta lista.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência pendente)
- **[Story]**: história a que a tarefa pertence (US1)
- Cada tarefa cabe em um commit (`Feat:`, `Chore:`), e `npx tsc` + `npm test` ficam verdes ao fim de cada uma

## Path Conventions

- Backend: `finacial-planner/backend/src/` (grafia da pasta mantida)
- Banco: `finacial-planner/database/schema.sql`
- Imports relativos com extensão `.ts`; `import type` para tipos; tipos junto do código (sem `types.ts` e sem `index.ts` de re-export)
- Identificadores em inglês; só mensagens ao usuário em português

---

## Phase 1: Setup

**Purpose**: valores de configuração, para não haver nada hardcoded na lógica

- [X] T001 Create `finacial-planner/backend/src/config/security.ts` exporting `securityConfig` with: scrypt params (`N` 16384, `r` 8, `p` 1, `keyLength` 64, `saltLength` 16), `password` limits (`minLength` 8, `maxLength` 72) and `email` limit (`maxLength` 255), following the style of `src/config/env.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: base compartilhada que a US1 usa; nenhuma tarefa da Phase 3 começa antes disto

**⚠️ CRITICAL**: T006 altera o schema do banco; reaplicá-lo exige `docker compose down -v` (apaga dados) e só acontece com confirmação humana na Phase 4

- [X] T002 [P] Create `finacial-planner/backend/src/utils/errors.ts` with `DomainError` (extends `Error`; fields `code: string`, `statusCode: number`) and `UsedEmailError` (`code` `USED_EMAIL`, `statusCode` 409, message `E-mail já está em uso`); add `errors.test.ts` covering code, status, message and `instanceof DomainError`
- [X] T003 [P] Create `finacial-planner/backend/src/utils/passwordHasher.ts` with `createPasswordHasher(config)` returning `{ hash(password): Promise<string> }`, using async `scrypt` from `node:crypto` and a random salt; output format `scrypt$N$r$p$<salt base64>$<hash base64>`; add `passwordHasher.test.ts` covering the format, a different salt per call (two hashes of the same password differ), the hash never containing the plain password, and the result fitting in 255 characters
- [X] T004 Edit `finacial-planner/backend/src/server.ts`: remove the `testConnection()` call from `createServer()` (the import stays only if still used); make the global error handler (a) respond with `error.statusCode` and `{ error, message, statusCode }` for `DomainError`, (b) respond 400 with `issues: [{ field, message }]` built from the `ZodError` issues, (c) keep the generic 500 without internal details; add `finacial-planner/backend/src/server.test.ts` using `app.inject` with throwaway routes that throw `UsedEmailError` (expects 409), a `ZodError` (expects 400 with `issues`) and a plain `Error` (expects 500 with no stack or message leak). Depends on T002
- [X] T005 Edit `finacial-planner/backend/src/index.ts`: call `testConnection()` after `createServer()` and before `listen`, preserving current behavior (startup still fails when the database is down). Depends on T004
- [X] T006 [P] Edit `finacial-planner/database/schema.sql` per [data-model.md](data-model.md): drop `UNIQUE` from `users.email` and the `idx_users_email` index; add `CREATE UNIQUE INDEX idx_users_email_active ON users(email) WHERE isActive = TRUE;`; in `fn_audit_log()` use `to_jsonb(NEW) - 'password_hash'` and `to_jsonb(OLD) - 'password_hash'`. Do not run any Docker command in this task

**Checkpoint**: fundação pronta; a US1 pode começar

---

## Phase 3: User Story 1 - Cadastrar usuário (Priority: P1) 🎯 MVP

**Goal**: criar um usuário com e-mail e senha via `POST /financial-control/users`, devolvendo-o sem a senha.

**Independent Test**: enviar e-mail e senha válidos e receber 201 com `id`, `email` normalizado, `isActive: true`, `createdAt` e `updatedAt`, sem `password` nem hash; repetir o e-mail e receber 409; enviar dados inválidos e receber 400 com `issues`.

### Implementation for User Story 1

- [X] T007 [P] [US1] Create `finacial-planner/backend/src/repositories/userRepository.ts` with `createUserRepository(query)` (the `query` function from `src/config/database.ts` is injected, never imported) returning `{ create({ email, passwordHash }): Promise<User> }`; `User` type exported from the same file (`id`, `email`, `isActive`, `createdAt`, `updatedAt`); parameterized `INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, isactive AS "isActive", createdat AS "createdAt", updatedat AS "updatedAt"` (never selects `password_hash`); catches Postgres error code `23505` and throws `UsedEmailError`, rethrowing anything else; add `userRepository.test.ts` with a fake `query` verifying the SQL text uses `$1`/`$2`, the returned columns exclude `password_hash`, `23505` becomes `UsedEmailError`, and other errors pass through. Depends on T002
- [X] T008 [P] [US1] Create `finacial-planner/backend/src/services/userService.ts` with `createUserService({ repository, hasher })` returning `{ createUser({ email, password }): Promise<User> }`; it hashes the password and calls `repository.create({ email, passwordHash })`, never passes the plain password to the repository and never logs it; add `userService.test.ts` with fake repository and fake hasher verifying the hash (not the password) reaches the repository, the user returned has no hash field, and `UsedEmailError` from the repository propagates. Depends on T002, T003; imports the `User` type from T007 (create T007 first or in the same commit)
- [X] T009 [US1] Create `finacial-planner/backend/src/controllers/userController.ts` using `createUserSchema` from `finacial-planner/backend/src/controllers/schemas/user/userSchemas.ts` (zod `.strict()`: `email` = `z.string().trim().toLowerCase().email().max(...)`, `password` = `z.string().min(...).max(...)`, limits from `securityConfig`, Portuguese messages per field) and `createUserController(service)` returning a Fastify handler that parses the body, calls `service.createUser` and replies 201 with the user; add `userController.test.ts` using `app.inject` with a fake service covering: 201 with normalized email (`"  Ana@Exemplo.com "` → `ana@exemplo.com`); 400 for invalid email, password with 7 and 73 characters, missing fields, and extra fields (`isActive`, `id`, `createdAt`); 409 when the service throws `UsedEmailError`; response body never containing `password` or `password_hash`. Depends on T001, T004, T008
- [X] T010 [US1] Create `finacial-planner/backend/src/routes/userRoutes.ts` exporting `userRoutes` (Fastify plugin receiving the controller handler through its options) that registers `POST /`; edit `finacial-planner/backend/src/routes/routesIndex.ts` so `registerRoutes(app, deps)` registers `userRoutes` with prefix `/users`, using `import type { FastifyInstance } from 'fastify'`, `.ts` extensions, leaving the commented category/transaction placeholders as they are; add `userRoutes.test.ts` checking that `POST /users` reaches the handler and other methods on `/users` return 404. Depends on T009
- [X] T011 [US1] Edit `finacial-planner/backend/src/index.ts` as composition root: build `createPasswordHasher(securityConfig)`, `createUserRepository(query)`, `createUserService(...)`, `createUserController(...)`, call `registerRoutes(app, deps)` inside `app.register` with prefix `/financial-control` (the existing `healthController` registration stays unchanged). Depends on T005, T010
- [X] T012 [US1] Edit `finacial-planner/backend/src/server.test.ts` (or add `finacial-planner/backend/src/app.test.ts`) with an end-to-end test that builds `createServer()` + `registerRoutes` with fake repository and hasher and exercises `POST /financial-control/users`: 201, 409 on a repeated email, 400 on invalid body, and a check that `JSON.stringify` of every response and of the Fastify log output captured during the test never contains the plain password. Depends on T011

**Checkpoint**: US1 funcional e testável sem banco real

---

## Phase 4: Polish & Cross-Cutting Concerns

- [X] T013 Run `npx tsc` and `npm test` in `finacial-planner/backend/`; fix anything red; report the actual output
- [ ] T014 (pendente só contra o banco real, que depende de confirmação do usuário; os cenários 1 a 5 e a auditoria já passaram pela API em um Postgres descartável com a collection do Postman) Ask the user for confirmation, then run the manual scenarios of [quickstart.md](quickstart.md) against the real Postgres, including the `docker compose down -v` needed to reapply `schema.sql` (destructive: wipes database data), and the `audit_log` check that no row contains `password_hash`
- [X] T015 [P] Update `CLAUDE.md`: current state (user creation implemented, `registerRoutes` now in use), routes available (`POST /financial-control/users`), and the schema changes (partial unique index on `users.email`, audit trigger without `password_hash`)

---

## Dependencies & Execution Order

- **Phase 1 → Phase 2 → Phase 3 → Phase 4**
- Phase 2: T002, T003 e T006 em paralelo; T004 depende de T002; T005 depende de T004
- Phase 3: T007 e T008 em paralelo (T008 importa o tipo `User` de T007, então crie T007 antes ou no mesmo commit); T009 depende de T001, T004, T008; T010 depende de T009; T011 depende de T005, T010; T012 depende de T011
- Phase 4: T013 depois de tudo; T014 depois de T013 e com confirmação humana; T015 em paralelo com T014

### Parallel Example

```text
Após T001:  T002  ||  T003  ||  T006
Após T002 e T003:  T007  ||  T008
```

## Implementation Strategy

1. Phase 1 e 2 (T001 a T006): a fundação já deixa o servidor testável sem banco.
2. Phase 3 (T007 a T012): é o MVP completo, validado só por testes unitários.
3. Phase 4: typecheck/testes verdes, depois validação real com o Postgres e atualização do CLAUDE.md.

## Notes

- Um commit por tarefa, no formato `Tipo: descrição`; branch `feature/create-user`.
- Nunca ler nem commitar `.env`; nenhum segredo nos testes.
- Fora do escopo (não criar tarefas): consulta, listagem, alteração, desativação lógica, login, criação de workspace, remoção do `healthRoutes.ts`.
