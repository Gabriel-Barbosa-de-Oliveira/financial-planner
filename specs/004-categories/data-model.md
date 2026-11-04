# Data Model: Categorias e Classificações

Colunas camelCase sem aspas ficam em minúsculas no Postgres. Toda leitura e escrita filtra o workspace padrão; leituras filtram `isactive = TRUE`.

## Entidade: Classificação (`classifications`, nova)

| Coluna (Postgres) | Nome na API | Tipo | Regras |
|-------------------|-------------|------|--------|
| `id` | `id` | UUID | Gerado pelo banco |
| `workspaceid` | (não exposto) | UUID | Workspace padrão; FK para `workspaces`, `ON DELETE CASCADE` |
| `name` | `name` | VARCHAR(100) | Obrigatório; `trim`; 1 a 100 caracteres; único entre ativas do workspace, sem diferenciar caixa |
| `isactive` | `isActive` | BOOLEAN | Nasce `TRUE`; `FALSE` na desativação; volta `TRUE` na reativação |
| `createdat` | `createdAt` | TIMESTAMP | `NOW()` na criação |
| `updatedat` | `updatedAt` | TIMESTAMP | `NOW()` na criação, alteração, desativação e reativação (backend preenche; sem trigger) |

## Entidade: Categoria (`categories`, existente, alterada)

| Coluna (Postgres) | Nome na API | Tipo | Regras |
|-------------------|-------------|------|--------|
| `id` | `id` | UUID | Gerado pelo banco |
| `workspaceid` | (não exposto) | UUID | Workspace padrão |
| `name` | `name` | VARCHAR(100) | Obrigatório; `trim`; 1 a 100 caracteres; único entre ativas do workspace **dentro do mesmo tipo**, sem diferenciar caixa |
| `type` | `type` | VARCHAR(20) | Obrigatório; `ENTRADA` ou `SAIDA`; **imutável** depois do cadastro |
| `classificationid` | `classification` | UUID NULL | **Nova.** Opcional; FK para `classifications`; na resposta vira `{ id, name }` ou `null` e só aparece se a classificação estiver ativa |
| `isactive` | `isActive` | BOOLEAN | Nasce `TRUE`; `FALSE` na desativação; volta `TRUE` na reativação |
| `createdat` | `createdAt` | TIMESTAMP | `NOW()` na criação |
| `updatedat` | `updatedAt` | TIMESTAMP | Idem classificação |

## Entradas validadas

| Entrada | Regra |
|---------|-------|
| `name` (POST/PATCH, ambas as entidades) | string, `trim`, 1 a 100 caracteres |
| `type` (POST categoria) | enum `ENTRADA`/`SAIDA`, obrigatório |
| `classificationId` (POST/PATCH categoria) | UUID ou `null`; POST: opcional; PATCH: opcional (`null` remove o vínculo) |
| corpo do POST de classificação | `strict`: só `name`; `id`, `workspaceId`, `isActive`, datas e demais campos são recusados |
| corpo do POST de categoria | `strict`: só `name`, `type`, `classificationId` |
| corpo do PATCH de classificação | `strict`: só `name`, obrigatório |
| corpo do PATCH de categoria | `strict`: `name` e/ou `classificationId`, ao menos um; `type` e demais campos são recusados |
| corpo do `reactivate` | ignorado (nenhum campo esperado) |
| query do `GET /categories` | `strict`: `classificationId` (UUID) e `type` (`ENTRADA`/`SAIDA`), opcionais |
| `:id` | UUID; senão "Identificador inválido" |

## Mudanças no `schema.sql`

1. Nova tabela `classifications` (antes de `categories`, que a referencia), com índices `idx_classifications_workspaceId`, `idx_classifications_isActive` e `CREATE UNIQUE INDEX idx_classifications_name_active ON classifications(workspaceId, LOWER(name)) WHERE isActive = TRUE`.
2. `categories`: `classificationId UUID REFERENCES classifications(id)` (nula), `CONSTRAINT check_category_type CHECK (type IN ('ENTRADA', 'SAIDA'))` e `CREATE INDEX idx_categories_classificationId ON categories(classificationId)`.
3. Trocar `idx_categories_unique_per_workspace` por `CREATE UNIQUE INDEX idx_categories_name_type_active ON categories(workspaceId, LOWER(name), type) WHERE isActive = TRUE`.
4. `CREATE TRIGGER trg_audit_classifications AFTER INSERT OR UPDATE OR DELETE ON classifications FOR EACH ROW EXECUTE FUNCTION fn_audit_log();` e `COMMENT ON TABLE classifications`.
5. Comentário de `categories.type` passa a citar `ENTRADA` ou `SAIDA`. O seed não muda (FR-021: nada de categorias ou classificações iniciais).

Para reaplicar o schema é preciso `docker compose down -v` (o `schema.sql` só roda com volume vazio); passo destrutivo, que exige confirmação humana.

## Transições de estado

```text
Classificação
(inexistente) --POST--> ATIVA
ATIVA --PATCH--> ATIVA (name novo)
ATIVA --DELETE--> INATIVA   (categorias ativas dela: classificationid = NULL, na mesma instrução)
INATIVA --reactivate--> ATIVA (categorias que ainda apontavam para ela: classificationid = NULL)

Categoria
(inexistente) --POST--> ATIVA (com ou sem classificação)
ATIVA --PATCH--> ATIVA (name e/ou classificação, inclusive removida)
ATIVA --DELETE--> INATIVA
INATIVA --reactivate--> ATIVA (classificação mantida só se ainda ativa; senão NULL)
```

O nome de um registro INATIVO pode ser reutilizado por outro novo; reativar o antigo depois falha com 409 se o nome estiver em uso. Reativar um registro já ativo falha com 409; id inexistente falha com 404.

## Relacionamentos

`workspaces` 1—N `classifications`; `workspaces` 1—N `categories`; `classifications` 1—N `categories` (opcional do lado da categoria). `transactions.categoryId` aponta para `categories` (fora do escopo; desativar categoria não toca em lançamentos).
