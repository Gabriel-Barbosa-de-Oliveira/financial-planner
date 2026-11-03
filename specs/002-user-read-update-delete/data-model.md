# Data Model: Consulta, Alteração e Desativação de Usuário

Sem mudança de schema. A entidade e as colunas são as de [001-user-crud/data-model.md](../001-user-crud/data-model.md); aqui ficam só as regras novas.

## Entidade: Usuário (`users`)

| Coluna (Postgres) | Nome na API | Leitura | Alteração (PATCH) | Desativação |
|-------------------|-------------|---------|-------------------|-------------|
| `id` | `id` | devolvido | proibido | filtro (`WHERE id = $1`) |
| `email` | `email` | devolvido | opcional, mesmas regras do cadastro | inalterado |
| `password_hash` | (nunca exposto) | nunca selecionado | opcional; recebe novo hash | inalterado |
| `isactive` | `isActive` | devolvido (sempre `true` nas leituras) | proibido | passa a `FALSE` |
| `createdat` | `createdAt` | devolvido | proibido | inalterado |
| `updatedat` | `updatedAt` | devolvido | `NOW()` a cada alteração | `NOW()` |

Toda leitura e escrita filtra `isactive = TRUE`: usuário desativado é tratado como inexistente.

## Entradas validadas

| Entrada | Regra |
|---------|-------|
| `:id` (todas as rotas com id) | UUID; caso contrário "Identificador inválido" |
| `email` (PATCH) | opcional; `trim` + minúsculas, formato válido, até 255 caracteres |
| `password` (PATCH) | opcional; 8 a 72 caracteres |
| corpo do PATCH | `strict` (campos extras recusados) e com pelo menos um de `email` ou `password` |

## Transições de estado

```text
ATIVO --PATCH--> ATIVO (e-mail e/ou senha novos, updatedAt renovado)
ATIVO --DELETE--> INATIVO (isActive = FALSE, updatedAt renovado)
INATIVO --qualquer operação--> "Usuário não encontrado"
```

Não existe transição de INATIVO para ATIVO (reativação fora do escopo). O e-mail de um usuário INATIVO pode ser cadastrado de novo ou usado em um PATCH; isso cria ou altera outra linha.

## Relacionamentos

`users` 1—N `workspaces`. A desativação não toca nos workspaces nem em nada abaixo deles (FR-012).

## Saídas

Usuário público: `{ id, email, isActive, createdAt, updatedAt }`. `GET /users` devolve um array desses objetos; `DELETE /users/:id` devolve 204 sem corpo.
