# Quickstart: validar o CRUD de contas

Contrato: [accounts.openapi.yaml](contracts/accounts.openapi.yaml). Modelo: [data-model.md](data-model.md).

## Pré-requisitos

- Docker rodando e `finacial-planner/backend/.env` criado a partir do `.env.example` (não commitar).
- Banco criado com o `schema.sql` atualizado (constraints de `accounts` e seed do workspace `familia`). Para reaplicar o schema é necessário `docker compose down -v` em `finacial-planner/`, que **apaga os dados do banco**: confirme antes de rodar.

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

Base: `/financial-control/accounts`.

| # | Ação | Esperado |
|---|------|----------|
| 1 | `POST` `{"name":"  Nubank ","type":"BANK","balance":"1500.00"}` | 201; `name` = `Nubank`; `balance` = `"1500.00"`; `isActive` = `true`; sem `workspaceId` |
| 2 | `POST` `{"name":"Carteira","type":"CASH"}` | 201; `balance` = `"0.00"` |
| 3 | `POST` `{"name":"nubank","type":"BANK"}` | 409, "Já existe uma conta com este nome" |
| 4 | `POST` com tipo `XYZ`, nome vazio, nome com 101 caracteres, `balance` `"1,5"`, `"1.234"` ou 11 dígitos inteiros | 400 com `issues` apontando o campo |
| 5 | `POST` com `isActive`, `id` ou `workspaceId` | 400 (campo não permitido) |
| 6 | `GET` lista e `GET /:id` | Só ativas, por ordem de criação; `balance` como texto |
| 7 | `GET /:id` com `abc` e com UUID inexistente | 400 "Identificador inválido" / 404 "Conta não encontrada" |
| 8 | `PATCH` `{"name":"Nubank PJ"}`, depois `{"type":"SAVINGS"}` | 200; `balance` e `id` iguais; `updatedAt` maior |
| 9 | `PATCH` `{"balance":"10.00"}` e `PATCH` `{}` | 400 em ambos |
| 10 | `PATCH` para o nome de outra conta ativa / para o próprio nome em outra caixa | 409 / 200 |
| 11 | `DELETE /:id` e repetir | 204 / 404; some da lista |
| 12 | `POST` com o nome da conta desativada | 201 (nova conta, outro `id`) |
| 13 | Vários `POST` simultâneos com o mesmo nome novo | Exatamente um 201, os demais 409 |

## Conferir no banco

```bash
docker exec -it financial-control-db psql -U financial_user -d financial_control_db
```

```sql
SELECT name, isactive FROM workspaces;                                          -- familia | t
SELECT name, type, balance, isactive FROM accounts ORDER BY createdat;          -- desativadas continuam, isactive = f
SELECT action, newvalue->>'isactive' FROM audit_log WHERE tablename = 'accounts';  -- CREATE/UPDATE, nunca DELETE
```

Esperado: nenhuma conta apagada fisicamente e `balance` inalterado após os PATCH.

## Fora do escopo

Alterações de saldo por lançamentos, cadastro de workspace e autenticação.
