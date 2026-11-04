# Quickstart: validar categorias e classificações

Contratos: [classifications.openapi.yaml](contracts/classifications.openapi.yaml) e [categories.openapi.yaml](contracts/categories.openapi.yaml). Modelo: [data-model.md](data-model.md).

## Pré-requisitos

- Docker rodando e `finacial-planner/backend/.env` criado a partir do `.env.example` (não commitar).
- Banco criado com o `schema.sql` atualizado (tabela `classifications`, `categories.classificationid`, `CHECK` de tipo e novos índices). Para reaplicar o schema é necessário `docker compose down -v` em `finacial-planner/`, que **apaga os dados do banco**: confirme antes de rodar.

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

Base: `/financial-control`.

### Classificações (`/classifications`)

| # | Ação | Esperado |
|---|------|----------|
| 1 | `POST` `{"name":"  Automóvel "}`, depois "Comidas" e "Lazer" | 201; `name` sem espaços nas pontas; `isActive` = `true`; sem `workspaceId` |
| 2 | `POST` `{"name":"comidas"}` | 409, "Já existe uma classificação com este nome" |
| 3 | `POST` com nome vazio, 101 caracteres, ou com `isActive`/`id` | 400 com `issues` apontando o campo |
| 4 | `GET` lista, `GET /:id`; id `abc`; UUID inexistente | Só ativas por ordem de criação; 400 "Identificador inválido"; 404 "Classificação não encontrada" |
| 5 | `PATCH` `{"name":"Veículos"}`; `PATCH` para o nome de outra; `PATCH` para o próprio nome em outra caixa | 200; 409; 200 |

### Categorias (`/categories`)

| # | Ação | Esperado |
|---|------|----------|
| 6 | `POST` Gasolina (`SAIDA`, Automóvel), Supermercado (`SAIDA`, Comidas), Futvôlei (`SAIDA`, Lazer) | 201 cada; `classification` = `{id,name}` (os três exemplos do pedido, SC-007) |
| 7 | `POST` `{"name":"Salário","type":"ENTRADA"}` | 201; `classification` = `null` |
| 8 | `POST` `{"name":"gasolina","type":"SAIDA"}` | 409, "Já existe uma categoria com este nome para este tipo" |
| 9 | `POST` `{"name":"Gasolina","type":"ENTRADA"}` | 201 (mesmo nome, outro tipo) |
| 10 | `POST` com `classificationId` inexistente ou de classificação desativada | 422, "Classificação não encontrada"; nada gravado |
| 11 | `POST` com tipo `XYZ`/`SAÍDA`, nome vazio, `classificationId` inválido, ou com `isActive`/`id` | 400 com `issues` por campo |
| 12 | `GET` lista; `?classificationId=<Lazer>`; `?type=ENTRADA`; ambos; `?type=XYZ` | Todas; só de Lazer; só ENTRADA; interseção; 400 |
| 13 | `PATCH` `{"classificationId":"<Lazer>"}` na Gasolina; `{"classificationId":null}`; `{"type":"ENTRADA"}`; `{}` | 200 com nova classificação; 200 com `null`; 400; 400 |
| 14 | `PATCH` renomeando para nome já usado no mesmo tipo / para o próprio nome em outra caixa | 409 / 200 |

### Desativar e reativar

| # | Ação | Esperado |
|---|------|----------|
| 15 | `DELETE /categories/:id` e repetir | 204 / 404; some da lista |
| 16 | `POST /categories` com o nome da desativada | 201 (outro `id`) |
| 17 | `POST /categories/:id/reactivate` da antiga com o nome já em uso | 409, "Já existe uma categoria com este nome para este tipo" |
| 18 | `DELETE /classifications/:id` de uma com categorias ativas | 204; `GET /categories` mostra essas categorias ativas com `classification` = `null` |
| 19 | `POST /classifications/:id/reactivate` da desativada | 200; as categorias do item 18 continuam `null` (vínculo não volta) |
| 20 | `POST .../reactivate` num registro já ativo; num UUID inexistente; em `abc` | 409 "...já está ativa"; 404; 400 |
| 21 | Reativar categoria cuja classificação está desativada | 200; `classification` = `null` |
| 22 | Vários `POST` simultâneos com o mesmo nome (e tipo) novo | Exatamente um 201, os demais 409 |

## Conferir no banco

```bash
docker exec -it financial-control-db psql -U financial_user -d financial_control_db
```

```sql
SELECT name, isactive FROM classifications ORDER BY createdat;                 -- desativadas continuam, isactive = f
SELECT name, type, classificationid, isactive FROM categories ORDER BY createdat;
SELECT tablename, action FROM audit_log WHERE tablename IN ('classifications','categories') ORDER BY changedat;  -- CREATE/UPDATE, nunca DELETE
SELECT count(*) FROM categories c JOIN classifications k ON k.id = c.classificationid
 WHERE c.isactive AND NOT k.isactive;                                           -- 0 após as operações sequenciais (SC-006)
```

Esperado: nenhum registro apagado fisicamente; a desativação da classificação aparece na auditoria junto com o `UPDATE` das categorias desvinculadas.
