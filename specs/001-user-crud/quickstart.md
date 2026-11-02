# Quickstart: validar o cadastro de usuário

Guia de validação ponta a ponta. Contrato: [create-user.openapi.yaml](contracts/create-user.openapi.yaml). Modelo: [data-model.md](data-model.md).

## Pré-requisitos

- Docker rodando e `finacial-planner/backend/.env` criado a partir do `.env.example` (não commitar).
- Banco com o `schema.sql` já atualizado. Para reaplicar o schema é necessário `docker compose down -v` em `finacial-planner/`, que **apaga os dados do banco**: confirme antes de rodar.

## Subir

```bash
cd finacial-planner && docker compose up -d
cd backend && npm run dev
```

## Verificações automáticas

```bash
cd finacial-planner/backend
npx tsc
npm test
```

Esperado: typecheck sem erros e todos os testes passando.

## Cenários manuais

| # | Ação | Esperado |
|---|------|----------|
| 1 | `POST /financial-control/users` com `{"email":"  Ana@Exemplo.com ","password":"senha-segura-123"}` | 201; `email` = `ana@exemplo.com`; `isActive` = `true`; sem `password`/hash |
| 2 | Repetir o cenário 1 | 409, mensagem "E-mail já está em uso" |
| 3 | E-mail `invalido` | 400 com `issues` apontando `email` |
| 4 | Senha com 7 e com 73 caracteres | 400 com `issues` apontando `password` |
| 5 | Corpo com `"isActive": false` ou `"id": "..."` | 400 (campo não permitido) |
| 6 | Dois POST simultâneos com o mesmo e-mail novo | Um 201 e um 409 |
| 7 | Desativar à mão (`UPDATE users SET isActive = FALSE WHERE email = ...`) e cadastrar o mesmo e-mail | 201 (reuso permitido) |

## Conferir no banco

```bash
docker exec -it financial-control-db psql -U financial_user -d financial_control_db
```

```sql
SELECT id, email, isactive, left(password_hash, 7) AS formato FROM users;      -- formato = 'scrypt$'
SELECT action, newvalue ? 'password_hash' AS vazou FROM audit_log
 WHERE tablename = 'users';                                                      -- vazou = false em todas
```

Esperado: nenhuma linha de `audit_log` contém `password_hash`, e não há `DELETE` em `users`.
