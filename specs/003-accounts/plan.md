# Implementation Plan: Contas (Accounts)

**Branch**: `feature/accounts` | **Date**: 2026-11-02 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/003-accounts/spec.md`

## Summary

CRUD de contas sob `/financial-control/accounts`: `POST /` (cadastro), `GET /`, `GET /:id`, `PATCH /:id` (nome e/ou tipo) e `DELETE /:id` (desativação lógica, 204). Segue as camadas e os padrões da feature de usuário (factories com injeção de dependência, `DomainError`, schemas zod em `controllers/schemas/account/`, uma instrução SQL parametrizada por operação).

Três decisões próprias desta feature (detalhes em [research.md](research.md)):

1. **Workspace implícito**: o repository recebe o nome do workspace padrão (`familia`, vindo de `src/config/workspace.ts`) e resolve o `id` dentro do próprio SQL. O cliente nunca envia workspace.
2. **Saldo como texto decimal** (`"1500.00"`) na entrada e na saída, sem passar por `number`, para não usar ponto flutuante.
3. **Schema** (`schema.sql`): `balance` passa a `NOT NULL`, `type` ganha `CHECK` e nome ganha índice único parcial por workspace e caixa. O seed do workspace `familia` já foi incluído.

## Technical Context

**Language/Version**: Node 24, TypeScript ESM `strict`, executado direto pelo Node (imports `.ts`)

**Primary Dependencies**: Fastify 4, zod 3, pg 8 (já instaladas). Nenhuma dependência nova.

**Storage**: PostgreSQL 16, tabela `accounts` existente, com ajustes de constraint/índice no `schema.sql`; leitura de `workspaces` para localizar o workspace padrão.

**Testing**: Jest 29 + ts-jest em ESM (`npm test`), testes ao lado do código, repository com `query` falso e service/controller com fakes. Collection do Postman para validação contra a API real.

**Target Platform**: servidor via Docker Compose (Postgres) e API Node

**Project Type**: web-service (backend `finacial-planner/backend/`)

**Performance Goals**: todas as operações em menos de 1 s com 1.000 contas ativas (SC-002)

**Constraints**: SQL parametrizado e estático; sem `DELETE` físico; saldo nunca editável pelo CRUD; mensagens em português; identificadores em inglês; rotas abertas no MVP

**Scale/Scope**: uso familiar; cinco endpoints, sem paginação

## Constitution Check

*GATE: passa antes da pesquisa e continua passando depois do design.*

| # | Princípio | Situação |
|---|-----------|----------|
| 1 | Camadas explícitas | Passa. Routes → Controller → Service → Repository; `query` e nome do workspace injetados no repository. |
| 2 | Validação na fronteira | Passa. Schemas zod validam corpo e `:id` antes do service. |
| 3 | Erros de domínio | Passa. `AccountNotFoundError` (404), `UsedAccountNameError` (409) e `WorkspaceUnavailableError` (422), todos `DomainError`. |
| 4 | Funções puras | Passa. Schemas puros; IO só no repository. |
| 5 | Integridade financeira | Passa. Saldo trafega como texto decimal e é gravado como `DECIMAL(12,2)`, sem float; PATCH não toca em `balance` (alterações de saldo ficam para lançamentos, na mesma transação). Exclusão só lógica; toda consulta filtra `isactive = TRUE`. |
| 6 | Teste é parte da tarefa | Passa. Cada função nova nasce com teste. |
| 7 | Segurança por padrão | Passa. SQL parametrizado e estático; nenhuma ação destrutiva sem confirmação (recriar o banco para aplicar o schema é passo manual). |
| 8 | Spec antes de código | Passa. Fluxo `/speckit-*` seguido. |
| 9 | Pequeno e reversível | Passa. Tarefas por camada, um commit cada. |
| 10 | Código em inglês | Passa. |

Sem violações; Complexity Tracking não se aplica.

## Project Structure

### Documentation (this feature)

```text
specs/003-accounts/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── accounts.openapi.yaml
├── checklists/
│   └── requirements.md
└── tasks.md             # /speckit-tasks (não criado aqui)
```

### Source Code (repository root)

```text
finacial-planner/
├── database/schema.sql                 # accounts: balance NOT NULL, CHECK de type, índice único de nome (seed já incluído)
└── backend/src/
    ├── config/
    │   ├── workspace.ts                # defaultWorkspaceConfig = { name: 'familia' }
    │   └── account.ts                  # tipos permitidos, limites de nome e de saldo
    ├── utils/errors.ts                 # + AccountNotFoundError, UsedAccountNameError, WorkspaceUnavailableError  (+ errors.test.ts)
    ├── repositories/accountRepository.ts       # create, findAll, findById, update, deactivate  (+ .test.ts)
    ├── services/accountService.ts              # createAccount, listAccounts, getAccount, updateAccount, deactivateAccount  (+ .test.ts)
    ├── controllers/
    │   ├── accountController.ts                # { create, list, getById, update, remove }  (+ .test.ts)
    │   └── schemas/account/accountSchemas.ts   # createAccountSchema, updateAccountSchema, accountIdParamsSchema  (+ .test.ts)
    ├── routes/
    │   ├── accountRoutes.ts                    # POST/GET /, GET/PATCH/DELETE /:id  (+ .test.ts)
    │   └── routesIndex.ts                      # registra /accounts
    ├── index.ts                                # composition root monta o fluxo de contas
    └── app.test.ts                             # + cenários ponta a ponta de contas

postman/collections/Financial Planner/Accounts/   # requests e testes das 5 operações
```

**Structure Decision**: mesma estrutura de camadas das features 001 e 002, com arquivos novos paralelos aos de usuário. A validação `userIdParamsSchema` não é reaproveitada: cada entidade tem seu schema de `:id` com a própria mensagem, mantendo os módulos independentes.

## Mudanças em código existente

- `routesIndex.ts`: `RoutesDependencies` ganha `account`; `app.test.ts` e `index.ts` acompanham.
- `errors.ts`: três classes novas; as existentes não mudam.
- `schema.sql`: ver [data-model.md](data-model.md). Bancos existentes precisam de `docker compose down -v` (destrutivo, só com confirmação).
- Comportamento público das rotas de usuário não muda.
