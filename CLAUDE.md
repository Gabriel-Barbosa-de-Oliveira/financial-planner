# Financial Control (Planejador Financeiro)

Sistema de controle financeiro familiar (MVP). Um usuário (login) gerencia um workspace onde vários membros (sem login) lançam entradas e saídas em contas e categorias, com suporte a parcelamento e auditoria completa.

O `README.md` da raiz documenta o banco (queries de exemplo, CloudBeaver, troubleshooting). Ele descreve o backend como "HTTP nativo", mas o código usa **Fastify**.

## Constitution

`specs/constitution.md` define os princípios não-negociáveis do projeto (camadas, validação, erros de domínio, integridade financeira, testes, segurança, spec antes de código). Em caso de conflito com este arquivo, a constitution prevalece.

## Spec Kit

Inicializado com `specify init --here --integration claude --script sh` (specify-cli 1.0.4.dev0).

- `.specify/`: templates, scripts (`.specify/scripts/bash/`) e `memory/constitution.md` (cópia de `specs/constitution.md`, lida pelas skills; manter as duas iguais)
- `.claude/skills/speckit-*`: skills do fluxo
- Fluxo: `/speckit-specify` -> (`/speckit-clarify`) -> `/speckit-plan` -> `/speckit-tasks` -> (`/speckit-analyze`) -> `/speckit-implement`, com revisão humana entre as fases
- Cada feature gera `specs/NNN-nome/` (numeração sequencial) com `spec.md`, `plan.md`, `tasks.md` e afins

## Estrutura

- `specs/`: `constitution.md` e as specs de cada feature em `specs/NNN-nome/` (spec, plan, tasks)
- `finacial-planner/` (grafia com erro, mantida): código do projeto
  - `backend/`: API (pacote npm próprio)
  - `database/`: `Dockerfile` (Postgres 16 alpine) e `schema.sql`
  - `frontend/`: vazio, previsto React + Vite
  - `docker-compose.yml`: Postgres (5432) + CloudBeaver (8978); serviço do backend ainda comentado
- `.claude/agents/developer.md`: agente para código Node/TS
- `.specify/` e `.claude/skills/speckit-*`: Spec Kit (ver seção "Spec Kit")

## Stack (backend)

- Node 24, TypeScript ESM `strict`, executado direto pelo Node (type stripping), sem build no dev
- Imports relativos **com extensão `.ts`** (`allowImportingTsExtensions`); imports só de tipo usam `import type`
- Fastify 4 como servidor HTTP
- zod para validação (instalado, ainda não usado)
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

- `src/index.ts`: entrypoint; cria o servidor e registra controllers com prefixo `/financial-control`
- `src/server.ts`: instância Fastify, teste de conexão com o banco, 404 e error handler globais (ZodError → 400), graceful shutdown
- `src/config/`: `env.ts` e `database.ts` (pool, `query()`, `testConnection()`, `closePool()`)
- `src/controllers/`, `src/routes/`, `src/services/`, `src/repositories/`, `src/middlewares/`, `src/utils/`
- Camadas previstas: Routes → Controllers → Services → Repositories
- Rotas atuais: `GET /`, `GET /health`, `GET /financial-control/health` (checa o banco)

## Banco de dados

Tabelas (todas com `id` UUID, `isActive`, `createdAt`, `updatedAt`): `users` → `workspaces` → `members`, `accounts`, `categories`, `transactions` → `installments`, além de `audit_log`.

- Soft delete via `isActive = FALSE`; consultas filtram registros ativos
- Triggers gravam todo INSERT/UPDATE/DELETE em `audit_log`
- `value` sempre positivo; o sentido (ENTRADA/SAÍDA) vem de `categories.type`
- Colunas camelCase sem aspas: o Postgres as guarda em minúsculas (`userid`, `isactive`). Considerar isso em queries e no mapeamento dos resultados.
- Não há trigger para `updatedAt` nem para atualizar `accounts.balance`; isso fica a cargo do backend
- Sem migrations: mudanças vão direto em `schema.sql`

## Convenções

- Entrada externa sempre validada com zod
- Tipos ficam junto do código (sem `types.ts`), sem `index.ts` de re-export
- Funções puras e injeção de dependência; efeitos colaterais nas bordas
- Valores de configuração em `src/config/`, nada hardcoded na lógica
- Lógica nova nasce com teste; typecheck e testes sempre verdes
- SQL sempre parametrizado; erros previsíveis viram classes de erro de domínio
- Mudanças relevantes começam por uma spec em `specs/NNN-nome/`
- Nunca commitar segredos nem ler `.env`
- Mensagens e textos voltados ao usuário em português

## Git

- Branch principal: `master`; features em `feature/<nome>`
- Commits no formato `Tipo: descrição` (`Feat:`, `Chore:`, `Wip:`)

## Estado atual (nov/2026)

- Branch `feature/create-user`: fluxo de criação de usuário ainda não iniciado
- `src/routes/routesIndex.ts` tem `registerRoutes()` com rotas comentadas, ainda não chamada
- `src/routes/healthRoutes.ts` duplica `healthController` e tem imports sem `.ts`; escolher um padrão (routes ou controllers) e remover o outro
- Constraint `check_installment_date_not_past` bloqueia UPDATE de parcelas já vencidas (ex.: marcar como paga)
