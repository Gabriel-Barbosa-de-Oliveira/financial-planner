# Research: Contas (Accounts)

Nenhum item ficou como "NEEDS CLARIFICATION" no Technical Context. Decisões herdadas das features 001 e 002 (camadas, `DomainError`, SQL estático com `COALESCE`, concorrência por instrução única + índice, `PATCH` parcial, `DELETE` 204, array simples ordenado por `createdat, id`) continuam valendo e não são repetidas.

## 1. Como localizar o workspace padrão

- **Decision**: `src/config/workspace.ts` exporta `defaultWorkspaceConfig = { name: 'familia' }`. O repository recebe o nome na factory (`createAccountRepository(query, workspaceName)`) e usa a subconsulta `SELECT id FROM workspaces WHERE name = $n AND isactive = TRUE ORDER BY createdat ASC, id ASC LIMIT 1` dentro de cada instrução (insert, select, update, deactivate).
- **Rationale**: o spec manda o cliente não informar o workspace. Resolver no SQL evita uma consulta extra e uma janela de corrida, e escopa também as leituras e escritas ao workspace. O nome fica em config (nada hardcoded na lógica) e o seed garante que existe.
- **Alternatives considered**: ler o `id` no startup e injetá-lo (falha o boot se o seed faltar e obriga reiniciar a API após recriar o banco); variável de ambiente com o UUID (quebra o "banco novo funciona sem ação manual", SC-007); índice único em `workspaces(name)` (restringiria workspaces futuros de outros usuários sem necessidade).

## 2. Workspace ausente

- **Decision**: o `INSERT ... SELECT` não insere nada quando o workspace não existe; o repository devolve `null` e o service lança `WorkspaceUnavailableError` (`WORKSPACE_UNAVAILABLE`, 422, "Workspace padrão não encontrado"). Leituras simplesmente não encontram nada (lista vazia / "Conta não encontrada").
- **Rationale**: não grava conta órfã e dá mensagem clara (edge case da spec). 422 porque a requisição é válida mas o estado do sistema não permite processá-la; não é 500, pois é previsível.
- **Alternatives considered**: 500 genérico (esconde a causa); 404 (confunde com "conta não encontrada").

## 3. Saldo sem ponto flutuante

- **Decision**: o saldo trafega como **string decimal** no JSON (`"1500.00"`). Entrada: regex `^-?\d{1,10}(\.\d{1,2})?$` (cabe em `DECIMAL(12,2)`, aceita negativo, zero e inteiro). Padrão `"0.00"`. O `pg` já devolve `DECIMAL` como string, então a saída é repassada sem conversão.
- **Rationale**: constitution, princípio 5 (sem aritmética de ponto flutuante). Number JSON perderia exatidão em valores como 0.1 + 0.2 no cliente. A regex garante o limite de 12 dígitos e as duas casas antes de o Postgres rejeitar com erro 500.
- **Alternatives considered**: aceitar number JSON e converter (risco de arredondar sem aviso); guardar centavos como inteiro (muda o schema existente).

## 4. Validação de nome e tipo

- **Decision**: `name` com `trim`, 1 a 100 caracteres (limite de `VARCHAR(100)`); `type` por `z.enum(['BANK','INVESTMENT','CASH','SAVINGS'])`. Tipos e limites em `src/config/account.ts`, usados pelos schemas. O banco ganha `CHECK (type IN (...))` como defesa em profundidade.
- **Rationale**: a lista vem do comentário do schema; um enum no código sozinho deixaria o banco aceitar lixo por outras vias.
- **Alternatives considered**: tabela de tipos (exagero para quatro valores fixos).

## 5. Unicidade do nome

- **Decision**: `CREATE UNIQUE INDEX idx_accounts_name_active ON accounts(workspaceId, LOWER(name)) WHERE isActive = TRUE`. Violação `23505` nesse índice vira `UsedAccountNameError` (`USED_ACCOUNT_NAME`, 409, "Já existe uma conta com este nome"), no create e no update.
- **Rationale**: mesmo padrão de `idx_users_email_active` e `idx_members_unique_per_workspace`. A comparação sem caixa vem do `LOWER`, e o `trim` do zod cobre os espaços. SC-004 (100 cadastros simultâneos, 1 aceito) fica garantido pelo índice. "Alterar para o próprio nome" não conflita consigo mesmo.
- **Alternatives considered**: checar antes com SELECT (corrida); `citext` (extensão a mais).

## 6. Saldo imutável no PATCH

- **Decision**: `updateAccountSchema` é `.strict()` com `name` e `type` opcionais e regra de pelo menos um campo; `balance` enviado cai em "Campo não permitido". O SQL do `UPDATE` nem referencia `balance`.
- **Rationale**: FR-008. Duas barreiras (schema e SQL) tornam o SC-006 trivialmente verificável.
- **Alternatives considered**: aceitar `balance` no PATCH (quebraria a regra de que saldo vem de lançamentos).

## 7. `balance` nulo no banco

- **Decision**: `balance DECIMAL(12,2) NOT NULL DEFAULT 0.00` no `schema.sql`.
- **Rationale**: hoje a coluna aceita `NULL`, o que quebraria a promessa de saldo sempre numérico na resposta.
- **Alternatives considered**: tratar `NULL` como zero no SELECT (esconde dado inválido).

## 8. Erros de domínio e auditoria

- **Decision**: três classes novas em `errors.ts`; auditoria sem mudança, pois `trg_audit_accounts` já registra criação e alteração com `old`/`new`. A desativação é UPDATE de `isactive`.
- **Rationale**: FR-013 já atendido pelo schema. Contas não têm campo sensível a omitir.
- **Alternatives considered**: nenhuma.

## 9. Índices e desempenho

- **Decision**: nenhum índice além do de nome. O filtro por workspace e `isactive` usa `idx_accounts_workspaceId`.
- **Rationale**: 1.000 contas ordenadas em memória estão muito abaixo de 1 s (SC-002).
- **Alternatives considered**: índice composto `(workspaceId, isActive, createdAt)` (ganho irrelevante).
