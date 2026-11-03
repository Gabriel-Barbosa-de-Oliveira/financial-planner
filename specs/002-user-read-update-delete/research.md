# Research: Consulta, Alteração e Desativação de Usuário

Nenhum item ficou como "NEEDS CLARIFICATION" no Technical Context. Decisões herdadas de [001-user-crud/research.md](../001-user-crud/research.md) (scrypt, índice único parcial, auditoria sem `password_hash`, `DomainError`, testes com fakes injetados) continuam valendo e não são repetidas aqui. As decisões abaixo são as que o `/speckit-clarify` deixou para o plano.

## 1. Verbo da alteração

- **Decision**: `PATCH /users/:id` com alteração parcial.
- **Rationale**: a spec define alteração parcial (só muda o que for enviado), que é a semântica do `PATCH`. `PUT` exigiria enviar o recurso inteiro, e o cliente nem tem a senha para reenviar.
- **Alternatives considered**: `PUT` (semântica de substituição total, não casa com o requisito).

## 2. Resposta da desativação

- **Decision**: `DELETE /users/:id` responde `204 No Content`, sem corpo.
- **Rationale**: o usuário passa a ser tratado como inexistente (FR-011), então não há representação útil a devolver. É o padrão REST para remoção e simplifica o contrato e os testes. A prova de que o registro continua existindo fica na auditoria e no banco, não na resposta.
- **Alternatives considered**: `200` com o usuário desativado (devolveria um recurso que a própria API passa a negar com 404).

## 3. Concorrência

- **Decision**: cada operação de escrita é uma única instrução SQL com `WHERE id = $1 AND isactive = TRUE ... RETURNING`. Sem transação explícita, sem lock otimista e sem coluna de versão. Quando nenhuma linha é afetada, o service responde `UserNotFoundError`. A violação do índice único (`23505` em `idx_users_email_active`) vira `UsedEmailError`.
- **Rationale**: uma instrução é atômica no Postgres. Alteração e desativação simultâneas do mesmo usuário se serializam sozinhas: quem chega depois enxerga o estado já alterado, e uma desativação seguida de alteração devolve "não encontrado" (edge case da spec). Dois usuários trocando para o mesmo e-mail ao mesmo tempo: o índice deixa só um passar (SC-004).
- **Alternatives considered**: `SELECT ... FOR UPDATE` dentro de transação (mais código sem ganho); versão/ETag (exagero para uso familiar).

## 4. Alterar para o próprio e-mail

- **Decision**: não precisa de tratamento especial no código.
- **Rationale**: o `UPDATE` reescreve a mesma linha com o mesmo valor, e o índice único parcial não conflita consigo mesmo. A normalização (minúsculas, sem espaços) já ocorre no schema, então "ANA@x.com" e "ana@x.com" chegam iguais ao banco. O trabalho aqui é só garantir isso com teste.
- **Alternatives considered**: ler o usuário antes e comparar o e-mail (uma consulta a mais e uma janela de corrida, sem benefício).

## 5. Alteração parcial sem montar SQL

- **Decision**: instrução estática `UPDATE users SET email = COALESCE($2, email), password_hash = COALESCE($3, password_hash), updatedat = NOW() WHERE id = $1 AND isactive = TRUE RETURNING ...`, passando `null` para o campo não enviado.
- **Rationale**: SQL fixo e parametrizado (constitution, princípio 7), sem lista de colunas montada em tempo de execução. Também cumpre FR-009: `updatedat = NOW()` é preenchido pelo backend, já que o banco não tem trigger para isso.
- **Alternatives considered**: montar o `SET` dinamicamente só com os campos enviados (SQL variável, mais superfície para erro e injeção).

## 6. Validação de `:id` e do corpo

- **Decision**: `userIdParamsSchema` (`id` como UUID, mensagem "Identificador inválido") e `updateUserSchema` (`email` e `password` opcionais, `.strict()`, com regra de pelo menos um campo), ambos em `controllers/schemas/user/userSchemas.ts`. Os campos `email` e `password` reaproveitam as mesmas definições do cadastro para as regras nunca divergirem.
- **Rationale**: FR-003, FR-004, FR-005 e FR-008. Validar o UUID antes evita o erro `22P02` do Postgres ao receber um id malformado. A ordem das respostas é: 400 (id ou corpo inválido) antes de 404 (usuário inexistente).
- **Alternatives considered**: deixar o Postgres rejeitar o id (vira 500 genérico e quebra FR-003).

## 7. Formato da listagem

- **Decision**: `GET /users` devolve um array simples de usuários, ordenado por `createdat ASC, id ASC` (o `id` desempata).
- **Rationale**: a spec não prevê paginação; um array é o contrato mínimo. A ordem determinística deixa testes estáveis.
- **Alternatives considered**: envelope `{ data, total }` (prepararia paginação futura, mas é contrato a mais que ninguém pediu; se paginar, será uma mudança deliberada de contrato).

## 8. Erro de domínio novo

- **Decision**: `UserNotFoundError extends DomainError`, código `USER_NOT_FOUND`, 404, mensagem "Usuário não encontrado". O repository devolve `null` quando nenhuma linha casa; quem lança o erro é o service.
- **Rationale**: o repository continua sem conhecer regras de negócio nem HTTP; o handler global já traduz qualquer `DomainError`.
- **Alternatives considered**: lançar no repository (mistura camadas).

## 9. Índices e desempenho

- **Decision**: nenhum índice novo.
- **Rationale**: consulta, alteração e desativação usam a chave primária. A listagem filtra por `isactive` (já indexado) e ordena no máximo ~1.000 linhas, ordem de grandeza em que a ordenação em memória é trivial para o limite de 1 s do SC-005.
- **Alternatives considered**: índice composto `(isactive, createdat)` (ganho irrelevante nesse volume).

## 10. Auditoria

- **Decision**: nenhuma mudança. O trigger `fn_audit_log()` já registra UPDATE com `old` e `new` sem `password_hash`.
- **Rationale**: FR-013 e SC-003 já são atendidos pelo schema da feature 001. A desativação é um UPDATE (`isactive` de `true` para `false`), então aparece como `UPDATE`, nunca como `DELETE`.
- **Alternatives considered**: nenhuma.
