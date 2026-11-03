# Quickstart: validar consulta, alteração e desativação de usuário

Guia de validação ponta a ponta. Contrato: [user-read-update-delete.openapi.yaml](contracts/user-read-update-delete.openapi.yaml). Modelo: [data-model.md](data-model.md). O cadastro (`POST /users`) vem da feature [001](../001-user-crud/quickstart.md).

## Pré-requisitos

- Docker rodando e `finacial-planner/backend/.env` criado a partir do `.env.example` (não commitar).
- Banco já com o `schema.sql` da feature 001 (índice `idx_users_email_active` e auditoria sem `password_hash`). Esta feature **não** muda o schema, então não precisa de `docker compose down -v`. Se o banco ainda for o antigo, reaplicar o schema apaga os dados e exige confirmação.

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

Crie dois usuários com `POST /financial-control/users` (A e B) e guarde os `id`.

| # | Ação | Esperado |
|---|------|----------|
| 1 | `GET /users` | 200; array com A e B por ordem de criação; sem senha |
| 2 | `GET /users/{id de A}` | 200; `id`, `email`, `isActive`, `createdAt`, `updatedAt` |
| 3 | `GET /users/abc` | 400, `issues` com `field: id` e "Identificador inválido" |
| 4 | `GET /users/{uuid inexistente}` | 404, "Usuário não encontrado" |
| 5 | `PATCH /users/{A}` com `{"email":"  Novo@Exemplo.com "}` | 200; e-mail normalizado; `updatedAt` maior que `createdAt` |
| 6 | `PATCH /users/{A}` com `{"password":"nova-senha-123"}` | 200; resposta sem senha |
| 7 | `PATCH /users/{A}` com o e-mail de B | 409, "E-mail já está em uso"; A não muda |
| 8 | `PATCH /users/{A}` com o próprio e-mail atual (caixa diferente) | 200 |
| 9 | `PATCH /users/{A}` com `{}` e com `{"isActive":false}` | 400 em ambos |
| 10 | `DELETE /users/{A}` | 204 sem corpo |
| 11 | `GET`, `PATCH` e `DELETE` em `/users/{A}` de novo | 404 nos três |
| 12 | `GET /users` | só B |
| 13 | `POST /users` com o e-mail antigo de A | 201 (novo `id`) |
| 14 | `PATCH /users/{B}` para o e-mail do cenário 13 (de um usuário ativo) e depois para o e-mail do cenário 5 (de A, já desativado) | 409 no primeiro; 200 no segundo |
| 15 | Dois `PATCH` simultâneos de usuários diferentes para o mesmo e-mail novo | um 200 e um 409 |

## Conferir no banco

```bash
docker exec -it financial-control-db psql -U financial_user -d financial_control_db
```

```sql
SELECT id, email, isactive, updatedat > createdat AS alterado FROM users ORDER BY createdat;
SELECT action, newvalue ? 'password_hash' AS vazou_new, oldvalue ? 'password_hash' AS vazou_old
  FROM audit_log WHERE tablename = 'users';
```

Esperado: o usuário desativado continua na tabela com `isactive = false`; nenhuma linha de `audit_log` tem `password_hash`; a desativação aparece como `UPDATE`, e não existe nenhum `DELETE` em `users`.

## Postman

Com a API no ar:

```bash
postman collection run "postman/collections/Financial Planner" \
  -e "postman/environments/Financial Planner Environment.environment.yaml" -i Users
```
