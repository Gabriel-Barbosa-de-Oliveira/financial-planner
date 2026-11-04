# Research: Categorias e Classificações

Nenhum item ficou como "NEEDS CLARIFICATION" no Technical Context. Decisões herdadas das features 001 a 003 (camadas, `DomainError`, SQL estático com `COALESCE`, concorrência por instrução única + índice, `PATCH` parcial, `DELETE` 204, array simples ordenado por `createdat, id`, workspace padrão resolvido no SQL por `defaultWorkspaceConfig`) continuam valendo e não são repetidas.

## 1. Classificação como tabela própria

- **Decision**: nova tabela `classifications` (`id`, `workspaceid`, `name`, `isactive`, `createdat`, `updatedat`) e coluna `categories.classificationid UUID NULL REFERENCES classifications(id)`.
- **Rationale**: a clarificação 1 exige CRUD próprio; a clarificação 3 torna o vínculo opcional, então a coluna é nula. A FK impede apontar para id inexistente mesmo por outras vias. Segue o padrão das demais tabelas (UUID, `isactive`, datas, trigger de auditoria).
- **Alternatives considered**: coluna de texto livre na categoria (descartada na clarificação 1); tabela de junção N—N (a spec limita a uma classificação por categoria).

## 2. Desativar classificação desvincula categorias na mesma operação

- **Decision**: uma única instrução com CTEs que modificam dados:

  ```text
  WITH deactivated AS (UPDATE classifications SET isactive = FALSE, updatedat = NOW()
                       WHERE id AND isactive = TRUE AND workspace RETURNING id),
       unlinked AS (UPDATE categories SET classificationid = NULL, updatedat = NOW()
                    WHERE isactive = TRUE AND classificationid IN (SELECT id FROM deactivated))
  SELECT id FROM deactivated
  ```

  Uma linha devolvida = desativada; zero = não encontrada. Só categorias **ativas** são desvinculadas.
- **Rationale**: o `pg` `Pool.query` não abre transação, e as features anteriores evitam `BEGIN`/`COMMIT` manual. Uma instrução é atômica por definição e cada linha alterada passa pelo trigger de auditoria (FR-018).
- **Alternatives considered**: transação com `client` do pool (nova infraestrutura só para este caso); `ON DELETE SET NULL` (só vale para `DELETE`, e a exclusão aqui é lógica); trigger no banco (a constitution mantém a regra no backend).

## 3. Corrida entre cadastro de categoria e desativação da classificação

- **Decision**: o service confere a classificação (ativa e do workspace) antes de gravar; a **leitura** de categoria faz `LEFT JOIN classifications c ON c.id = categories.classificationid AND c.isactive = TRUE`, então a classificação só aparece se estiver ativa. Se uma categoria for gravada no instante em que a classificação é desativada (a CTE da decisão 2 não enxerga linhas commitadas depois do seu início), ela aparece como "Sem classificação". A reativação da classificação zera todo vínculo que ainda aponte para ela (decisão 4).
- **Rationale**: garante SC-006 pelo lado da leitura, sem lock explícito nem transação. O estado residual no banco (vínculo apontando para classificação inativa) é invisível pela API e limpo na reativação.
- **Alternatives considered**: `SELECT ... FOR SHARE` na classificação (não resolve: a CTE de desativação usa o snapshot do início); `SERIALIZABLE` (exige transação e retentativa).

## 4. Reativação

- **Decision**: `POST /:id/reactivate`, só para registros com `isactive = FALSE`.
  - Classificação: `UPDATE classifications SET isactive = TRUE ...` com CTE que também faz `UPDATE categories SET classificationid = NULL WHERE classificationid = <id>` (ativas e inativas), para não religar o que foi desvinculado (FR-024).
  - Categoria: `UPDATE ... SET isactive = TRUE, classificationid = CASE WHEN EXISTS (classificação ativa com esse id) THEN classificationid ELSE NULL END`.
  - Violação do índice único ativo vira `UsedClassificationNameError` / `UsedCategoryNameError` (FR-023).
  - Zero linhas atualizadas: o repository consulta `findActiveState(id)` (`true`, `false` ou `null`) e o service lança `...AlreadyActiveError` (409) ou `...NotFoundError` (404).
- **Rationale**: verbo `POST` num sub-recurso de ação é o padrão REST para transição de estado que não é substituição do recurso; `PATCH` ficou restrito a nome/classificação, e `isActive` segue proibido no corpo (FR-016). A consulta extra só roda no caminho de erro.
- **Alternatives considered**: `PATCH` com `isActive: true` (quebra a regra de campos proibidos); `PUT /:id/active` (semântica menos clara); reativar de forma idempotente (a spec pede recusa se já ativa).

## 5. Tipo ENTRADA / SAIDA

- **Decision**: valores aceitos e gravados: `ENTRADA` e `SAIDA` (sem acento), em `src/config/category.ts`; `CHECK (type IN ('ENTRADA','SAIDA'))` no banco. Mensagens ao usuário escrevem "SAÍDA".
- **Rationale**: o comentário atual do schema fala "SAÍDA", mas enum com acento exige cuidado com normalização Unicode (NFC/NFD) em cliente, JSON e SQL, e é identificador de contrato, que a constitution manda manter em ASCII/inglês. O `CHECK` fecha a porta para outros valores.
- **Alternatives considered**: `INCOME`/`EXPENSE` (traduz demais um termo do domínio e do schema); manter `SAÍDA` com acento (risco de duas grafias no banco).

## 6. Unicidade

- **Decision**:
  - `idx_classifications_name_active ON classifications(workspaceid, LOWER(name)) WHERE isactive = TRUE`.
  - `idx_categories_name_type_active ON categories(workspaceid, LOWER(name), type) WHERE isactive = TRUE`, **substituindo** `idx_categories_unique_per_workspace` (que comparava o nome exatamente, com caixa).
  - Violação `23505` em cada índice vira o erro de nome usado (create, update e reactivate).
- **Rationale**: mesma abordagem de `idx_accounts_name_active`; SC-004 fica garantido pelo índice, sem SELECT prévio. O `trim` do zod cobre espaços.
- **Alternatives considered**: checar antes com SELECT (corrida); `citext` (extensão a mais).

## 7. Alteração parcial de categoria com `classificationId` nulo

- **Decision**: `updateCategorySchema` é `.strict()` com `name` (opcional) e `classificationId` (opcional, `uuid` ou `null`), ao menos um campo. O SQL usa um parâmetro booleano: `classificationid = CASE WHEN $5 THEN $4 ELSE classificationid END`, onde `$5` indica "campo enviado". `type` no corpo cai em "Campo não permitido" (FR-012/FR-016).
- **Rationale**: `COALESCE` não distingue "não enviado" de "enviar `null` para limpar". O flag mantém a instrução estática e parametrizada.
- **Alternatives considered**: montar o SQL dinamicamente (viola "SQL estático"); endpoint separado para desvincular (superfície maior sem ganho).

## 8. Quem valida a classificação de uma categoria

- **Decision**: `createCategoryService({ repository, classificationRepository })`. No cadastro e na alteração com `classificationId` string, o service chama `classificationRepository.findById`; se vier `null`, lança `InvalidClassificationError` (422, "Classificação não encontrada") antes de gravar. `findById` já filtra ativas e o workspace.
- **Rationale**: cada repository continua dono de uma tabela e fácil de testar com fake; a regra de negócio fica no service. 422 (não 404) porque o recurso endereçado pela rota existe, o que está inválido é a referência no corpo.
- **Alternatives considered**: subconsulta de validação dentro do `INSERT` (zero linhas ambíguas: workspace ausente ou classificação inválida, exigindo consulta extra para distinguir); reutilizar `ClassificationNotFoundError` com 404 (confunde "rota não achada" com "corpo inválido").

## 9. Filtros da listagem de categorias

- **Decision**: query `classificationId` (UUID) e `type` (`ENTRADA` ou `SAIDA`), validados por `listCategoriesQuerySchema` (`.strict()`, mensagens em português), combináveis, ambos opcionais. SQL estático: `AND ($2::uuid IS NULL OR c.id = $2) AND ($3::text IS NULL OR categories.type = $3)`, onde `c` é a classificação ativa do join da decisão 3. Filtro por classificação inexistente devolve lista vazia, não erro.
- **Rationale**: filtrar pela classificação "efetiva" (a do join) mantém a listagem coerente com o que a resposta mostra. Lista vazia para id desconhecido é o comportamento padrão de filtro e evita consulta extra.
- **Alternatives considered**: 404 para classificação desconhecida (consulta extra sem valor para o usuário); filtro "sem classificação" (fora da spec).

## 10. Formato da resposta de categoria

- **Decision**: `{ id, name, type, classification: { id, name } | null, isActive, createdAt, updatedAt }`. O repository seleciona `c.id AS "classificationId"` e `c.name AS "classificationName"`; um mapeador puro monta o objeto aninhado. A API não expõe `workspaceId`.
- **Rationale**: atende FR-009 ("Sem classificação" = `null`; o rótulo textual fica para o cliente) sem segunda chamada. Mapeador puro é testável sozinho (princípio 4).
- **Alternatives considered**: devolver só `classificationId` (obriga o cliente a cruzar listas); texto "Sem classificação" no JSON (mistura apresentação com dado).
