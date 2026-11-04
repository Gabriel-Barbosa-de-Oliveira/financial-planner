# Implementation Plan: Categorias e Classificações (Categories)

**Branch**: `feature/categories` | **Date**: 2026-11-03 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/004-categories/spec.md`

## Summary

Dois CRUDs irmãos sob `/financial-control`, no mesmo padrão da feature de contas (factories com injeção de dependência, `DomainError`, schemas zod, uma instrução SQL parametrizada por operação, workspace padrão resolvido no SQL):

- `/classifications`: `POST /`, `GET /`, `GET /:id`, `PATCH /:id` (nome), `DELETE /:id` (desativação lógica, 204) e `POST /:id/reactivate`.
- `/categories`: `POST /`, `GET /` (filtros `classificationId` e `type`), `GET /:id`, `PATCH /:id` (nome e/ou classificação, inclusive `null`), `DELETE /:id` (204) e `POST /:id/reactivate`.

Decisões próprias desta feature (detalhes em [research.md](research.md)):

1. **Nova tabela `classifications`** e coluna opcional `categories.classificationid` (FK). Nada de migração: tudo vai direto em `schema.sql`.
2. **Desativar classificação é uma única instrução SQL** (CTE) que desativa a classificação e zera `classificationid` das categorias ativas dela; reativar classificação zera o vínculo de quem ainda apontava para ela. A leitura de categoria só mostra a classificação se ela estiver ativa, então nenhuma corrida deixa uma categoria ativa "ligada" a classificação inativa (SC-006).
3. **Tipo na API** é `ENTRADA` ou `SAIDA` (ASCII, sem acento); as mensagens em português continuam escrevendo "SAÍDA". `CHECK` no banco.
4. **Unicidade**: classificação por `LOWER(name)` entre ativas; categoria por `LOWER(name)` + `type` entre ativas (substitui o índice atual, que diferencia caixa e é só por nome exato).
5. **Validação da classificação no service** (`categoryService` recebe também o `classificationRepository`), mantendo cada repository dono de uma tabela. Classificação inválida numa categoria vira `InvalidClassificationError` (422).

## Technical Context

**Language/Version**: Node 24, TypeScript ESM `strict`, executado direto pelo Node (imports `.ts`)

**Primary Dependencies**: Fastify 4, zod 3, pg 8 (já instaladas). Nenhuma dependência nova.

**Storage**: PostgreSQL 16; tabela `categories` existente (nova coluna, novo índice, `CHECK`) e tabela nova `classifications`, ambas com trigger de auditoria; leitura de `workspaces` para o workspace padrão.

**Testing**: Jest 29 + ts-jest em ESM (`npm test`), testes ao lado do código, repositories com `query` falso e services/controllers com fakes. Collection do Postman para validação contra a API real.

**Target Platform**: servidor via Docker Compose (Postgres) e API Node

**Project Type**: web-service (backend `finacial-planner/backend/`)

**Performance Goals**: todas as operações em menos de 1 s com 1.000 categorias e 100 classificações ativas (SC-002)

**Constraints**: SQL parametrizado e estático; sem `DELETE` físico; tipo da categoria imutável; mensagens em português; identificadores em inglês; rotas abertas no MVP

**Scale/Scope**: uso familiar; doze endpoints, sem paginação

## Constitution Check

*GATE: passa antes da pesquisa e continua passando depois do design.*

| # | Princípio | Situação |
|---|-----------|----------|
| 1 | Camadas explícitas | Passa. Routes → Controller → Service → Repository. O service de categoria usa o repository de classificação por injeção; repository não conhece HTTP. |
| 2 | Validação na fronteira | Passa. Schemas zod validam corpo, `:id` e query (`classificationId`, `type`) antes do service; `.strict()` recusa campos proibidos. |
| 3 | Erros de domínio | Passa. Sete classes novas, todas `DomainError` (ver Mudanças em código existente). |
| 4 | Funções puras | Passa. Schemas e o mapeamento linha → resposta são puros; IO só nos repositories. |
| 5 | Integridade financeira | Passa. O sentido ENTRADA/SAÍDA continua vindo de `categories.type`, agora com `CHECK` e imutável. Exclusão só lógica; toda consulta filtra `isactive = TRUE`. Não mexe em `accounts.balance`. |
| 6 | Teste é parte da tarefa | Passa. Cada função nova nasce com teste. |
| 7 | Segurança por padrão | Passa. SQL parametrizado e estático. Recriar o banco para aplicar o schema é passo manual com confirmação humana. |
| 8 | Spec antes de código | Passa. Fluxo `/speckit-*` seguido. |
| 9 | Pequeno e reversível | Passa. Tarefas por camada e por entidade, um commit cada. |
| 10 | Código em inglês | Passa. Mensagens em português; tipo na API sem acento (`SAIDA`). |

Sem violações; Complexity Tracking não se aplica.

## Project Structure

### Documentation (this feature)

```text
specs/004-categories/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── classifications.openapi.yaml
│   └── categories.openapi.yaml
├── checklists/
│   └── requirements.md
└── tasks.md             # /speckit-tasks (não criado aqui)
```

### Source Code (repository root)

```text
finacial-planner/
├── database/schema.sql                 # tabela classifications, categories.classificationid, CHECK de type, índices únicos, trigger de auditoria
└── backend/src/
    ├── config/
    │   ├── classification.ts           # limite de nome
    │   └── category.ts                 # tipos permitidos (ENTRADA, SAIDA), limite de nome
    ├── utils/errors.ts                 # + 7 classes de erro  (+ errors.test.ts)
    ├── repositories/
    │   ├── classificationRepository.ts # create, findAll, findById, update, deactivate, reactivate, findActiveState  (+ .test.ts)
    │   └── categoryRepository.ts       # create, findAll(filters), findById, update, deactivate, reactivate, findActiveState  (+ .test.ts)
    ├── services/
    │   ├── classificationService.ts    # (+ .test.ts)
    │   └── categoryService.ts          # (+ .test.ts)
    ├── controllers/
    │   ├── classificationController.ts # { create, list, getById, update, remove, reactivate }  (+ .test.ts)
    │   ├── categoryController.ts       # idem  (+ .test.ts)
    │   └── schemas/
    │       ├── classification/classificationSchemas.ts   # (+ .test.ts)
    │       └── category/categorySchemas.ts               # (+ .test.ts)
    ├── routes/
    │   ├── classificationRoutes.ts     # (+ .test.ts)
    │   ├── categoryRoutes.ts           # (+ .test.ts)
    │   └── routesIndex.ts              # registra /classifications e /categories
    ├── index.ts                        # composition root monta os dois fluxos
    └── app.test.ts                     # + cenários ponta a ponta

postman/collections/Financial Planner/Classifications/   # requests e testes
postman/collections/Financial Planner/Categories/        # requests e testes
```

**Structure Decision**: mesma estrutura de camadas das features anteriores, com arquivos paralelos por entidade (sem `index.ts` de re-export, sem `types.ts`). Cada entidade tem o próprio schema de `:id`, como em contas.

## Mudanças em código existente

- `routesIndex.ts`: `RoutesDependencies` ganha `classification` e `category`; remove os comentários de `categoryRoutes`; `app.test.ts` e `index.ts` acompanham.
- `errors.ts`: classes novas, as existentes não mudam:

  | Classe | Código | HTTP | Mensagem |
  |--------|--------|------|----------|
  | `ClassificationNotFoundError` | `CLASSIFICATION_NOT_FOUND` | 404 | Classificação não encontrada |
  | `UsedClassificationNameError` | `USED_CLASSIFICATION_NAME` | 409 | Já existe uma classificação com este nome |
  | `ClassificationAlreadyActiveError` | `CLASSIFICATION_ALREADY_ACTIVE` | 409 | Classificação já está ativa |
  | `CategoryNotFoundError` | `CATEGORY_NOT_FOUND` | 404 | Categoria não encontrada |
  | `UsedCategoryNameError` | `USED_CATEGORY_NAME` | 409 | Já existe uma categoria com este nome para este tipo |
  | `CategoryAlreadyActiveError` | `CATEGORY_ALREADY_ACTIVE` | 409 | Categoria já está ativa |
  | `InvalidClassificationError` | `INVALID_CLASSIFICATION` | 422 | Classificação não encontrada |

- `schema.sql`: ver [data-model.md](data-model.md). Bancos existentes precisam de `docker compose down -v` (destrutivo, só com confirmação).
- `CLAUDE.md`: atualizar estrutura, rotas e estado atual ao fim da implementação (tarefa própria).
- Comportamento público das rotas de usuário e de conta não muda.
