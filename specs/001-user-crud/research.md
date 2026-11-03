# Research: Cadastro de Usuário

Nenhum item ficou como "NEEDS CLARIFICATION" no Technical Context. As decisões abaixo fecham as escolhas técnicas.

## 1. Algoritmo de hash da senha

- **Decision**: `scrypt` do `node:crypto` (assíncrono), salt aleatório de 16 bytes, chave de 64 bytes, parâmetros padrão do Node (N=16384, r=8, p=1) mantidos em `config/security.ts`. Formato guardado: `scrypt$N$r$p$<salt base64>$<hash base64>`, que cabe em `VARCHAR(255)` e permite aumentar o custo no futuro sem quebrar hashes antigos.
- **Rationale**: sem dependência nova (a constitution exige justificar cada uma); algoritmo memory-hard recomendado pela OWASP; já disponível no Node 24.
- **Alternatives considered**: `bcrypt` (dependência nativa, limite de 72 bytes); `argon2` (melhor, mas dependência nativa e compilação). Ambos podem substituir o hasher depois, pois ele é injetado.

## 2. Limite de 72 caracteres na senha

- **Decision**: manter o máximo de 72 do spec (FR-002), medido em caracteres.
- **Rationale**: limita o custo de CPU de entradas gigantes e mantém compatibilidade se o hash migrar para `bcrypt`. O `scrypt` em si não tem esse limite.
- **Alternatives considered**: sem máximo (abre brecha para DoS por senha enorme); 128 (sem ganho real para uso familiar).

## 3. Unicidade do e-mail entre ativos

- **Decision**: trocar `email ... UNIQUE` por `CREATE UNIQUE INDEX ... ON users(email) WHERE isActive = TRUE`. O service não faz "SELECT antes de INSERT"; o repository faz o INSERT e traduz o erro `23505` (`unique_violation`) em `UsedEmailError`.
- **Rationale**: a verificação prévia tem condição de corrida (cadastros simultâneos, SC-002); o índice é a única garantia real. Também permite reusar o e-mail de usuário desativado (decisão do spec).
- **Alternatives considered**: manter `UNIQUE` global (bloqueia reuso); checagem só na aplicação (corrida).

## 4. Hash de senha no `audit_log`

- **Decision**: alterar `fn_audit_log()` para gravar `to_jsonb(NEW) - 'password_hash'` (e `OLD`).
- **Rationale**: o trigger atual grava a linha inteira, então o hash iria para `audit_log.newValue`, contradizendo FR-006. O operador `- 'chave'` é inofensivo nas tabelas sem essa coluna.
- **Alternatives considered**: trigger específico para `users` (duplica a função); aceitar o hash na auditoria (viola o requisito). Sem migrations (CLAUDE.md): a mudança vai direto no `schema.sql` e exige `docker compose down -v` para reaplicar.

## 5. Normalização e validação do e-mail

- **Decision**: no zod, `z.string().trim().toLowerCase().email().max(255)`. A normalização acontece no schema (fronteira), então o service e o repository já recebem o valor normalizado.
- **Rationale**: uma só passagem, pura e testável; atende FR-002 e FR-003.
- **Alternatives considered**: normalizar no service (espalha a regra); `citext` no Postgres (extensão nova).

## 6. Campos desconhecidos no corpo

- **Decision**: schema `.strict()`; campos extras (`isActive`, `id`, `createdAt` etc.) resultam em 400.
- **Rationale**: FR-008 diz que o cliente não define esses campos; recusar é mais seguro e mais claro que ignorar em silêncio.
- **Alternatives considered**: `.strip()` (ignora sem avisar).

## 7. Mapeamento de colunas

- **Decision**: o `INSERT ... RETURNING id, email, isactive AS "isActive", createdat AS "createdAt", updatedat AS "updatedAt"` já devolve camelCase e nunca seleciona `password_hash`.
- **Rationale**: o Postgres guarda `isActive` como `isactive` (sem aspas); o alias evita um mapeador separado e garante que o hash não saia do repository.
- **Alternatives considered**: `RETURNING *` com mapeamento posterior (arrisca vazar o hash).

## 8. Erros e mensagens

- **Decision**: `DomainError` (`code`, `statusCode`, `message` em português) como base; `UsedEmailError` com 409 e mensagem "E-mail já está em uso". O error handler devolve `{ error, message, statusCode }` (formato já usado) e, para validação, acrescenta `issues: [{ field, message }]`. Erros inesperados continuam em 500 genérico, sem detalhes internos e sem logar corpo da requisição.
- **Rationale**: constitution (princípio 3) e FR-002/SC-006.
- **Alternatives considered**: `@fastify/sensible` (dependência nova sem necessidade).

## 9. Estratégia de testes

- **Decision**: testes unitários com fakes injetados (repository fake no service, `query` fake no repository, service fake no controller via `app.inject`). Sem banco real no `npm test`; a validação ponta a ponta contra o Postgres fica no [quickstart.md](quickstart.md).
- **Rationale**: o projeto usa Jest em ESM, onde mock de módulo é trabalhoso; injeção de dependência evita isso e roda sem Docker.
- **Alternatives considered**: teste de integração automatizado com Postgres (exigiria Docker no CI; fica como evolução).
