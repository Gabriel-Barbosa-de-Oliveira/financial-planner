# Implementation Plan: Cadastro de Usuário

**Branch**: `feature/create-user` | **Date**: 2026-11-02 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-user-crud/spec.md`

## Summary

Primeira entrega do CRUD de usuário: somente o cadastro (`POST /financial-control/users`). Valida e normaliza e-mail e senha com zod, gera o hash da senha com `scrypt` (`node:crypto`, sem dependência nova), grava em `users` com SQL parametrizado e devolve o usuário sem senha. A unicidade do e-mail vale só entre usuários ativos (índice único parcial). O trigger de auditoria passa a omitir `password_hash`. Consulta, listagem, alteração e desativação lógica ficam para a feature seguinte.

## Technical Context

**Language/Version**: Node 24, TypeScript ESM `strict`, executado direto pelo Node (imports `.ts`)

**Primary Dependencies**: Fastify 4, zod 3, pg 8 (todas já instaladas). Nenhuma dependência nova: o hash usa `node:crypto`.

**Storage**: PostgreSQL 16, tabela `users` e trigger de auditoria existentes; duas mudanças em `schema.sql` (ver [data-model.md](data-model.md))

**Testing**: Jest 29 + ts-jest em ESM (`npm test`), testes ao lado do código em `*.test.ts`; sem banco real nos testes unitários

**Target Platform**: Servidor Linux/macOS via Docker Compose (Postgres) e API Node

**Project Type**: web-service (backend `finacial-planner/backend/`)

**Performance Goals**: cadastro em menos de 1 s com até 10.000 usuários (SC-005); o `scrypt` com parâmetros padrão custa dezenas de ms

**Constraints**: nunca expor senha/hash em resposta, erro ou log; SQL parametrizado; mensagens em português

**Scale/Scope**: uso familiar, poucos usuários; um endpoint

## Constitution Check

*GATE: passa antes da pesquisa e continua passando depois do design.*

| # | Princípio | Situação |
|---|-----------|----------|
| 1 | Camadas explícitas | Passa. Routes → Controller → Service → Repository; o repository recebe `query` por parâmetro. |
| 2 | Validação na fronteira | Passa. Schema zod `strict` no controller antes de chamar o service. |
| 3 | Erros de domínio | Passa. `DomainError` + `UsedEmailError` (409), traduzidos pelo error handler do servidor. |
| 4 | Funções puras | Passa. Normalização de e-mail e formatação do hash são puras; IO só no repository e no hasher injetado. |
| 5 | Integridade financeira | Não se aplica (sem valores nem saldos). Soft delete respeitado: nenhuma exclusão física; unicidade só entre ativos. |
| 6 | Teste é parte da tarefa | Passa. Cada módulo novo tem `*.test.ts`; `npx tsc` e `npm test` verdes. |
| 7 | Segurança por padrão | Passa, com mudança: o trigger de auditoria deixa de gravar `password_hash`. SQL parametrizado. Nenhuma leitura de `.env`. |
| 8 | Spec antes de código | Passa. Fluxo `/speckit-*` seguido. |
| 9 | Pequeno e reversível | Passa. Tarefas pequenas, um commit cada. |

Sem violações; a tabela de Complexity Tracking não se aplica.

## Project Structure

### Documentation (this feature)

```text
specs/001-user-crud/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── create-user.openapi.yaml
├── checklists/
│   └── requirements.md
└── tasks.md             # /speckit-tasks (não criado aqui)
```

### Source Code (repository root)

```text
finacial-planner/
├── database/
│   └── schema.sql                      # índice único parcial + trigger sem password_hash
└── backend/src/
    ├── index.ts                        # composition root: monta deps, chama testConnection, registerRoutes
    ├── server.ts                       # createServer sem testConnection; handler trata DomainError e ZodError
    ├── config/
    │   └── security.ts                 # parâmetros do scrypt, limites de senha/e-mail
    ├── utils/
    │   ├── errors.ts                   # DomainError, UsedEmailError  (+ errors.test.ts)
    │   └── passwordHasher.ts           # createPasswordHasher() com scrypt  (+ .test.ts)
    ├── routes/
    │   ├── routesIndex.ts              # registerRoutes(app, deps) liga userRoutes em /users
    │   └── userRoutes.ts               # POST /
    ├── controllers/
    │   ├── userController.ts           # createUserController(service)  (+ .test.ts)
    │   └── schemas/user/
    │       └── userSchemas.ts          # schemas zod de entrada (createUserSchema)  (+ .test.ts)
    ├── services/
    │   └── userService.ts              # createUserService({ repository, hasher })  (+ .test.ts)
    └── repositories/
        └── userRepository.ts           # createUserRepository(query)  (+ .test.ts)
```

**Structure Decision**: segue a estrutura de camadas já existente em `backend/src/`. Funções fábrica com dependências injetadas (sem classes, sem estado global). O controller novo fica ao lado do `healthController`, que não é alterado. Tipos ficam junto do código, sem `types.ts` nem `index.ts` de re-export.

## Decisões que afetam fora da feature

- `createServer()` deixa de chamar `testConnection()` (passa para `index.ts`), para o servidor poder ser montado em testes com `app.inject` sem banco.
- `routesIndex.ts` passa a ser usado e ganha `import type` com extensão `.ts`. O `healthRoutes.ts` (cópia quebrada do health) não é tocado nesta feature; remoção fica registrada como pendência do CLAUDE.md.
- O error handler do `server.ts` passa a devolver as mensagens por campo do `ZodError` (FR-002) e a respeitar o `statusCode` de `DomainError`.
