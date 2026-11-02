# Constitution - Financial Control

Princípios não-negociáveis que toda spec, plano, tarefa e código seguem.

1. Camadas explícitas. Routes -> Controllers -> Services -> Repositories. Dependências fluem só nesse sentido. Controller não acessa o banco; Repository não conhece HTTP; regra de negócio não faz IO direto.

2. Validação na fronteira. Toda entrada externa (body, params, query) é validada com zod antes de virar domínio. O error handler global traduz `ZodError` em 400.

3. Erros são de domínio. Falhas previsíveis (registro não encontrado, workspace de outro usuário, parcela inválida) viram classes de erro, traduzidas em status HTTP e mensagem em português na borda.

4. Funções puras por padrão. Cálculos de domínio (saldo, parcelamento, sentido entrada/saída) são funções puras. IO fica isolado em repositories e no pool do `pg`, injetados por parâmetro.

5. Integridade financeira. `value` é sempre positivo e o sentido vem de `categories.type`. Valores monetários nunca usam aritmética de ponto flutuante sem controle. Alterações que mexem em `accounts.balance` acontecem na mesma transação do lançamento. Exclusão é sempre soft delete (`isActive = FALSE`), e consultas filtram registros ativos.

6. Teste é parte da tarefa. Nenhuma lógica nova entra sem teste. Typecheck (`npx tsc`) e testes sempre verdes.

7. Segurança por padrão. Sem segredos no repo, nunca ler `.env`. SQL sempre parametrizado (`$1, $2`), nunca concatenado. Ações destrutivas (`docker compose down -v`, `DROP`, `DELETE` sem `WHERE`) passam por confirmação humana, não pela confiança no modelo.

8. Spec antes de código. Mudanças relevantes passam por `/speckit-specify` -> `/speckit-plan` -> `/speckit-tasks` -> `/speckit-implement`, registradas em `specs/NNN-nome/`, com revisão humana entre as fases.

9. Pequeno e reversível. Cada tarefa cabe em um commit no formato `Tipo: descrição`.

## Stack Obrigatória

Node 24 LTS, TypeScript ESM `strict` executado direto pelo Node (type stripping, imports com extensão `.ts`), zod, Jest 29 + ts-jest (ESM, testes em `src/**/*.test.ts`), Fastify 4, PostgreSQL 16 via `pg` com SQL puro (sem ORM). Frontend previsto: React + Vite.
