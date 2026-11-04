# Financial Control (Planejador Financeiro)

Sistema de controle financeiro familiar (MVP). Um usuário (login) gerencia um workspace onde vários membros (sem login) lançam entradas e saídas em contas e categorias, com suporte a parcelamento e auditoria completa.

O `README.md` da raiz documenta o banco (queries de exemplo, CloudBeaver, troubleshooting). Ele descreve o backend como "HTTP nativo", mas o código usa **Fastify**.

## Constitution

`specs/constitution.md` define os princípios não-negociáveis do projeto (camadas, validação, erros de domínio, integridade financeira, testes, segurança, spec antes de código). Em caso de conflito com este arquivo, a constitution prevalece.

## Spec Kit

Inicializado com `specify init --here --integration Codex --script sh` (specify-cli 1.0.4.dev0).

- `.specify/`: templates, scripts (`.specify/scripts/bash/`) e `memory/constitution.md` (cópia de `specs/constitution.md`, lida pelas skills; manter as duas iguais)
- `.Codex/skills/speckit-*`: skills do fluxo
- Fluxo: `/speckit-specify` -> (`/speckit-clarify`) -> `/speckit-plan` -> `/speckit-tasks` -> (`/speckit-analyze`) -> `/speckit-implement`, com revisão humana entre as fases
- Cada feature gera `specs/NNN-nome/` (numeração sequencial) com `spec.md`, `plan.md`, `tasks.md` e afins

## Estrutura

- `specs/`: `constitution.md` e as specs de cada feature em `specs/NNN-nome/` (spec, plan, tasks)
- `finacial-planner/` (grafia com erro, mantida): código do projeto
  - `backend/`: API (pacote npm próprio)
  - `database/`: `Dockerfile` (Postgres 16 alpine) e `schema.sql`
  - `frontend/`: vazio, previsto React + Vite
  - `docker-compose.yml`: Postgres (5432) + CloudBeaver (8978); serviço do backend ainda comentado
- `.Codex/agents/developer.md`: agente para código Node/TS
- `postman/`: collection `Financial Planner` (pastas Health, Users e Accounts, com testes) e ambiente com `BASE_URL`. Rodar: `postman collection run "postman/collections/Financial Planner" -e "postman/environments/Financial Planner Environment.environment.yaml" -i Users` (ou `-i Accounts`) (API no ar; `--env-var BASE_URL=...` troca a porta). A request `Create user` deve rodar antes de `Create user - duplicated email`
- `.specify/` e `.Codex/skills/speckit-*`: Spec Kit (ver seção "Spec Kit")

## Stack (backend)

- Node 24, TypeScript ESM `strict`, executado direto pelo Node (type stripping), sem build no dev
- Imports relativos **com extensão `.ts`** (`allowImportingTsExtensions`); imports só de tipo usam `import type`
- Fastify 4 como servidor HTTP
- zod para validação (usado no `userController`)
- PostgreSQL 16 via `pg` (Pool), SQL puro, sem ORM
- Testes: Jest 29 + ts-jest em modo ESM (`jest.config.js`). Arquivos `src/**/*.test.ts`, junto do código testado. Importar `describe`/`it`/`expect`/`jest` de `@jest/globals` (não há globais em ESM). Mock de módulo ESM exige `jest.unstable_mockModule` + `await import()`; preferir injeção de dependência

## Comandos

Rodar dentro de `finacial-planner/`:

- `docker compose up -d`: sobe Postgres + CloudBeaver
- `docker compose down -v`: reset completo (necessário para reaplicar `schema.sql`, que só roda com volume vazio)
- `docker exec -it financial-control-db psql -U financial_user -d financial_control_db`: psql

Rodar dentro de `finacial-planner/backend/`:

- `npm run dev`: inicia a API com watch e inspector (`src/index.ts`, lê `.env`)
- `npm test`: roda o Jest (o script já define `NODE_OPTIONS=--experimental-vm-modules`); `npx jest` direto falha sem essa flag. Também há `test:watch` e `test:coverage`
- `npx tsc`: typecheck (o tsconfig tem `noEmit: true`, então `npm run build`/`npm start` ainda não geram/rodam `dist/`)

## Env da API

Ver `backend/.env.example`: `PORT` (padrão 8080), `NODE_ENV`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`. Lidas em `src/config/env.ts`.

## Arquitetura do backend

- `src/index.ts`: entrypoint e composition root; cria o servidor, testa a conexão com o banco, monta as dependências (repository, hasher, service, controller) e registra health e rotas com prefixo `/financial-control`
- `src/server.ts`: `createServer(logger = true)` monta a instância Fastify (sem tocar no banco, então é testável com `app.inject`), 404 e error handler globais (`DomainError` → status próprio, `ZodError` → 400 com `issues: [{ field, message }]`, demais → 500 genérico), graceful shutdown
- `src/controllers/userController.ts`: `createUserController(service)` devolve `{ create, list, getById, update, remove }`; `src/routes/userRoutes.ts` liga cada um à sua rota
- `src/controllers/accountController.ts`, `src/services/accountService.ts`, `src/repositories/accountRepository.ts`, `src/routes/accountRoutes.ts`: CRUD de contas, mesmo padrão do usuário. O repository recebe o nome do workspace (`src/config/workspace.ts`, `familia`) e resolve o id no SQL; o saldo trafega como string decimal
- `src/utils/errors.ts`: `DomainError`, `UsedEmailError` (409), `UserNotFoundError` (404), `AccountNotFoundError` (404), `UsedAccountNameError` (409) e `WorkspaceUnavailableError` (422); `src/utils/passwordHasher.ts`: hash `scrypt` (`node:crypto`); `src/config/security.ts`: parâmetros do scrypt e limites de e-mail/senha
- `src/config/`: `env.ts` e `database.ts` (pool, `query()`, `testConnection()`, `closePool()`)
- `src/controllers/`, `src/routes/`, `src/services/`, `src/repositories/`, `src/middlewares/`, `src/utils/`
- Camadas previstas: Routes → Controllers → Services → Repositories
- Rotas atuais: `GET /`, `GET /health`, `GET /financial-control/health` (checa o banco), `POST /financial-control/users` (cadastro), `GET /financial-control/users`, `GET|PATCH|DELETE /financial-control/users/:id` (contratos em `specs/001-user-crud/contracts/` e `specs/002-user-read-update-delete/contracts/`; `DELETE` é desativação lógica e responde 204), `POST|GET /financial-control/accounts`, `GET|PATCH|DELETE /financial-control/accounts/:id` (contrato em `specs/003-accounts/contracts/`; PATCH altera só nome e tipo, nunca o saldo)

## Banco de dados

Tabelas (todas com `id` UUID, `isActive`, `createdAt`, `updatedAt`): `users` → `workspaces` → `members`, `accounts`, `categories`, `transactions` → `installments`, além de `audit_log`.

- Seed no fim do `schema.sql`: workspace `familia` (único do MVP) e o usuário dono `familia@seed.local`, com `password_hash` inválido (não autentica; definir senha real via `PATCH /users/:id`)
- `accounts`: `balance` NOT NULL, `type` com CHECK (BANK, INVESTMENT, CASH, SAVINGS) e nome único entre ativas por workspace sem diferenciar caixa (`idx_accounts_name_active`)
- Soft delete via `isActive = FALSE`; consultas filtram registros ativos
- Triggers gravam todo INSERT/UPDATE/DELETE em `audit_log`
- `value` sempre positivo; o sentido (ENTRADA/SAÍDA) vem de `categories.type`
- Colunas camelCase sem aspas: o Postgres as guarda em minúsculas (`userid`, `isactive`). Considerar isso em queries e no mapeamento dos resultados.
- Não há trigger para `updatedAt` nem para atualizar `accounts.balance`; isso fica a cargo do backend
- Sem migrations: mudanças vão direto em `schema.sql`

## Convenções

- Entrada externa sempre validada com zod; os schemas ficam em `src/controllers/schemas/<entidade>/<entidade>Schemas.ts` (ex.: `schemas/user/userSchemas.ts`)
- Tipos ficam junto do código (sem `types.ts`), sem `index.ts` de re-export
- Funções puras e injeção de dependência; efeitos colaterais nas bordas
- Valores de configuração em `src/config/`, nada hardcoded na lógica
- Lógica nova nasce com teste; typecheck e testes sempre verdes
- SQL sempre parametrizado; erros previsíveis viram classes de erro de domínio
- Mudanças relevantes começam por uma spec em `specs/NNN-nome/`
- Nunca commitar segredos nem ler `.env`
- Mensagens e textos voltados ao usuário em português
- Identificadores de código (funções, classes, variáveis, arquivos, códigos de erro) sempre em inglês, ex.: `UsedEmailError`, `createUserService`. Só as mensagens exibidas ao usuário ficam em português

## Git

- Branch principal: `master`; features em `feature/<nome>`
- Commits no formato `Tipo: descrição` (`Feat:`, `Chore:`, `Wip:`)

## Estado atual (nov/2026)

- Branch `feature/accounts`: CRUD de contas implementado (`specs/003-accounts`), validado em Postgres descartável (Postman: 51 requests, 133 asserções). Pendente: validação contra o Postgres real (T020), que exige `docker compose down -v` para reaplicar o `schema.sql` (seed do workspace e constraints de `accounts`)
- Branch `feature/create-user`: CRUD de usuário completo (`specs/001-user-crud` e `specs/002-user-read-update-delete`): cadastro, listagem, consulta por id, alteração parcial e desativação lógica. Pendente: validação manual contra o Postgres real (T014 da 001 e T024 da 002), que exige `docker compose down -v` para reaplicar o `schema.sql`
- `registerRoutes(app, dependencies)` em `src/routes/routesIndex.ts` está em uso e registra `userRoutes` em `/users` e `accountRoutes` em `/accounts`; categorias e transações seguem comentadas
- `schema.sql`: `users.email` é único só entre ativos (`idx_users_email_active`) e o trigger de auditoria omite `password_hash`. Bancos criados antes dessa mudança precisam de `docker compose down -v`
- As rotas de usuário e de conta são abertas (sem autenticação) e não devem ir para produção assim; a proteção vem com a feature de login
- `src/routes/healthRoutes.ts` duplica `healthController` e tem imports sem `.ts`; escolher um padrão (routes ou controllers) e remover o outro
- Constraint `check_installment_date_not_past` bloqueia UPDATE de parcelas já vencidas (ex.: marcar como paga)
