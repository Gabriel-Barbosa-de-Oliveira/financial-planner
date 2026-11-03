# Implementation Plan: Consulta, Alteração e Desativação de Usuário

**Branch**: `feature/create-user` | **Date**: 2026-11-02 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/002-user-read-update-delete/spec.md`

## Summary

Completa o CRUD de usuário iniciado em [001-user-crud](../001-user-crud/plan.md) com quatro operações sob `/financial-control/users`: `GET /` (listar ativos), `GET /:id`, `PATCH /:id` (alterar e-mail e/ou senha) e `DELETE /:id` (desativação lógica). Reaproveita as camadas, o hasher, o `DomainError` e o handler global de erros da feature anterior. Cada operação é uma única instrução SQL parametrizada com filtro `isactive = TRUE`, o que dá consistência em concorrência sem transação explícita. Não há mudança no `schema.sql`: o índice único parcial e o trigger de auditoria sem `password_hash` já cobrem esta feature.

## Technical Context

**Language/Version**: Node 24, TypeScript ESM `strict`, executado direto pelo Node (imports `.ts`)

**Primary Dependencies**: Fastify 4, zod 3, pg 8 (já instaladas). Nenhuma dependência nova.

**Storage**: PostgreSQL 16, tabela `users` existente. Sem alteração de schema.

**Testing**: Jest 29 + ts-jest em ESM (`npm test`), testes ao lado do código; sem banco real nos testes unitários. Collection do Postman para validação contra a API.

**Target Platform**: servidor Linux/macOS via Docker Compose (Postgres) e API Node

**Project Type**: web-service (backend `finacial-planner/backend/`)

**Performance Goals**: consulta, alteração e desativação em menos de 1 s com 10.000 usuários; listagem em menos de 1 s com 1.000 ativos (SC-005)

**Constraints**: nunca expor senha/hash em resposta, erro, log ou auditoria; SQL parametrizado; mensagens em português; identificadores em inglês; exclusão sempre lógica

**Scale/Scope**: uso familiar; quatro endpoints, sem paginação no MVP

## Constitution Check

*GATE: passa antes da pesquisa e continua passando depois do design.*

| # | Princípio | Situação |
|---|-----------|----------|
| 1 | Camadas explícitas | Passa. Routes → Controller → Service → Repository; o repository continua recebendo `query` por parâmetro. |
| 2 | Validação na fronteira | Passa. Schemas zod em `controllers/schemas/user/` validam `:id` (UUID) e o corpo do PATCH antes do service. |
| 3 | Erros de domínio | Passa. `UserNotFoundError` (404) novo; `UsedEmailError` (409) reaproveitado; ambos via `DomainError`. |
| 4 | Funções puras | Passa. Schemas e a regra "ao menos um campo" são puros; IO só no repository e no hasher injetado. |
| 5 | Integridade financeira | Não se aplica a valores. Soft delete respeitado: nenhuma exclusão física; todo SELECT/UPDATE filtra `isactive = TRUE`. |
| 6 | Teste é parte da tarefa | Passa. Cada função nova tem teste; `npx tsc` e `npm test` verdes. |
| 7 | Segurança por padrão | Passa. SQL parametrizado e estático (sem montar SQL por concatenação); o hash nunca sai do repository nem entra na auditoria. |
| 8 | Spec antes de código | Passa. Fluxo `/speckit-*` seguido. |
| 9 | Pequeno e reversível | Passa. Tarefas por camada, um commit cada. |
| 10 | Código em inglês | Passa. Identificadores em inglês; só mensagens ao usuário em português. |

Sem violações; Complexity Tracking não se aplica.

## Project Structure

### Documentation (this feature)

```text
specs/002-user-read-update-delete/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── user-read-update-delete.openapi.yaml
├── checklists/
│   └── requirements.md
└── tasks.md             # /speckit-tasks (não criado aqui)
```

### Source Code (repository root)

```text
finacial-planner/backend/src/
├── utils/
│   └── errors.ts                       # + UserNotFoundError (404)  (+ errors.test.ts)
├── repositories/
│   └── userRepository.ts               # + findAll, findById, update, deactivate  (+ .test.ts)
├── services/
│   └── userService.ts                  # + listUsers, getUser, updateUser, deactivateUser  (+ .test.ts)
├── controllers/
│   ├── userController.ts               # createUserController passa a devolver { create, list, getById, update, remove }  (+ .test.ts)
│   └── schemas/user/
│       └── userSchemas.ts              # + userIdParamsSchema, updateUserSchema  (+ .test.ts)
├── routes/
│   ├── userRoutes.ts                   # + GET /, GET /:id, PATCH /:id, DELETE /:id  (+ .test.ts)
│   └── routesIndex.ts                  # dependências passam a ser o controller completo
├── index.ts                            # composition root usa o controller completo
└── app.test.ts                         # + cenários ponta a ponta das 4 operações

postman/collections/Financial Planner/Users/   # + requests e testes das 4 operações
```

**Structure Decision**: mesma estrutura de camadas da feature 001; nenhum arquivo novo em `src/`, só extensões dos existentes. O controller muda de "um handler" para "um objeto com um handler por operação", para as rotas receberem uma única dependência (`controller`) em vez de uma por endpoint.

## Mudanças em código existente (contrato interno)

- `createUserController(service)` deixa de devolver uma função e passa a devolver `{ create, list, getById, update, remove }`. Os testes de `userController.test.ts` e `userRoutes.test.ts` e o `index.ts` são ajustados.
- `UserRoutesOptions` passa de `{ createUser }` para `{ controller }`; `registerRoutes` e `app.test.ts` acompanham.
- O comportamento público do `POST /users` não muda.
