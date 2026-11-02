# Data Model: Cadastro de Usuário

## Entidade: Usuário (`users`)

Tabela já existente em [schema.sql](../../finacial-planner/database/schema.sql). Colunas camelCase sem aspas ficam em minúsculas no Postgres.

| Coluna (Postgres) | Nome na API | Tipo | Regras |
|-------------------|-------------|------|--------|
| `id` | `id` | UUID | Gerado pelo banco (`gen_random_uuid()`); o cliente não define |
| `email` | `email` | VARCHAR(255) | Obrigatório; normalizado (trim + minúsculas); formato válido; único entre usuários ativos |
| `password_hash` | (nunca exposto) | VARCHAR(255) | Obrigatório; formato `scrypt$N$r$p$salt$hash`; nunca devolvido nem auditado |
| `isactive` | `isActive` | BOOLEAN | Nasce `TRUE`; o cliente não define; única forma de remoção é virar `FALSE` (feature futura) |
| `createdat` | `createdAt` | TIMESTAMP | `NOW()` na criação |
| `updatedat` | `updatedAt` | TIMESTAMP | `NOW()` na criação; sem trigger, o backend preenche nas alterações futuras |

## Entrada validada (cadastro)

| Campo | Regra |
|-------|-------|
| `email` | string, `trim` + minúsculas, formato de e-mail, 1 a 255 caracteres |
| `password` | string, 8 a 72 caracteres, sem alteração (não é trimada) |
| outros campos | proibidos (`strict`) |

## Mudanças no `schema.sql`

1. **E-mail único só entre ativos**
   - Remover `UNIQUE` de `users.email` e o índice `idx_users_email`.
   - Criar `CREATE UNIQUE INDEX idx_users_email_active ON users(email) WHERE isActive = TRUE;`
2. **Auditoria sem senha**
   - Em `fn_audit_log()`, trocar `to_jsonb(NEW)` por `to_jsonb(NEW) - 'password_hash'` e o mesmo para `OLD`.

Para reaplicar o schema é preciso `docker compose down -v` (o `schema.sql` só roda com volume vazio); passo destrutivo, que exige confirmação humana (constitution, princípio 7).

## Transições de estado

```text
(inexistente) --cadastro--> ATIVO (isActive = TRUE)
ATIVO --desativação lógica--> INATIVO (isActive = FALSE)   # feature futura
```

Um e-mail de usuário INATIVO pode ser cadastrado de novo; o novo registro é outra linha, com outro `id`.

## Relacionamentos

`users` 1—N `workspaces` (fora do escopo desta feature; nenhum workspace é criado no cadastro).
