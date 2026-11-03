# Data Model: Contas (Accounts)

## Entidade: Conta (`accounts`)

Tabela já existente em [schema.sql](../../finacial-planner/database/schema.sql). Colunas camelCase sem aspas ficam em minúsculas no Postgres.

| Coluna (Postgres) | Nome na API | Tipo | Regras |
|-------------------|-------------|------|--------|
| `id` | `id` | UUID | Gerado pelo banco; o cliente não define |
| `workspaceid` | (não exposto) | UUID | Definido pelo backend a partir do workspace padrão; FK para `workspaces` |
| `name` | `name` | VARCHAR(100) | Obrigatório; `trim`; 1 a 100 caracteres; único entre ativas do workspace, sem diferenciar caixa |
| `type` | `type` | VARCHAR(50) | Obrigatório; `BANK`, `INVESTMENT`, `CASH` ou `SAVINGS` |
| `balance` | `balance` | DECIMAL(12,2) | Texto decimal na API (`"1500.00"`); definido só no cadastro; padrão `0.00`; aceita negativo |
| `isactive` | `isActive` | BOOLEAN | Nasce `TRUE`; só vira `FALSE` na desativação |
| `createdat` | `createdAt` | TIMESTAMP | `NOW()` na criação |
| `updatedat` | `updatedAt` | TIMESTAMP | `NOW()` na criação e a cada alteração/desativação (backend preenche; sem trigger) |

Toda leitura e escrita filtra `isactive = TRUE` e o workspace padrão.

## Entradas validadas

| Entrada | Regra |
|---------|-------|
| `name` (POST) | string, `trim`, 1 a 100 caracteres, obrigatório |
| `type` (POST) | enum dos quatro tipos, obrigatório |
| `balance` (POST) | string opcional, `^-?\d{1,10}(\.\d{1,2})?$`; padrão `"0.00"` |
| corpo do POST | `strict`: `id`, `workspaceId`, `isActive`, datas e demais campos são recusados |
| `name`, `type` (PATCH) | opcionais, mesmas regras; ao menos um obrigatório |
| corpo do PATCH | `strict`: `balance`, `id`, `isActive`, datas e demais campos são recusados |
| `:id` | UUID; senão "Identificador inválido" |

## Mudanças no `schema.sql`

1. `balance DECIMAL(12, 2) NOT NULL DEFAULT 0.00` (hoje aceita `NULL`).
2. `CONSTRAINT check_account_type CHECK (type IN ('BANK', 'INVESTMENT', 'CASH', 'SAVINGS'))`.
3. `CREATE UNIQUE INDEX idx_accounts_name_active ON accounts(workspaceId, LOWER(name)) WHERE isActive = TRUE;`
4. Seed do workspace `familia` e do usuário dono: já incluído (FR-016 da spec).

Para reaplicar o schema é preciso `docker compose down -v` (o `schema.sql` só roda com volume vazio); passo destrutivo, que exige confirmação humana.

## Transições de estado

```text
(inexistente) --POST--> ATIVA
ATIVA --PATCH--> ATIVA (name/type novos, updatedAt renovado, balance intacto)
ATIVA --DELETE--> INATIVA (isActive = FALSE)
```

O nome de uma conta INATIVA pode ser reutilizado; a nova conta é outra linha, com outro `id`.

## Relacionamentos

`workspaces` 1—N `accounts`. `transactions.fromAccountId` e `toAccountId` apontam para `accounts` (fora do escopo; nenhuma regra sobre lançamentos é aplicada aqui).
