# Feature Specification: Categorias e Classificações (Categories)

**Feature Branch**: `feature/categories`

**Created**: 2026-11-03

**Status**: Draft

**Input**: User description: "categories. CRUD de categorias e classificação de categorias. Por exemplo: Gasolina - Classificação: Automóvel; Supermercado - Classificação: Comidas; Futvôlei - Lazer"

## Clarifications

### Session 2026-11-03

- Q: As classificações devem ser cadastradas livremente (CRUD próprio) ou ser uma lista fixa? → A: Cadastradas livremente, com CRUD próprio (entidade própria, como já descrito).
- Q: O nome da categoria é único só dentro do tipo ou também pode repetir entre classificações? → A: Único por nome dentro do tipo, independente da classificação (FR-008 e edge case correspondente).
- Q: Toda categoria deve ter classificação obrigatória? → A: Não, a classificação é opcional; categoria sem classificação é válida e aparece como "Sem classificação" (FR-006, FR-007, FR-009, FR-011).
- Q: Ao desativar uma classificação com categorias ativas, recusar ou desativar? → A: Desativar a classificação e deixar suas categorias ativas "Sem classificação", na mesma operação (FR-005).
- Q: Deve existir reativação de categoria e classificação desativadas? → A: Sim, incluir reativação de ambas (User Story 5, FR-022 a FR-024).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cadastrar e consultar classificações (Priority: P1)

Quem controla as finanças da família cadastra as classificações, os grandes grupos usados para organizar as categorias (ex.: Automóvel, Comidas, Lazer), e consulta a lista ou uma classificação específica.

**Why this priority**: As classificações organizam as categorias. Sem elas, as categorias ficam sem agrupamento, mas continuam utilizáveis.

**Independent Test**: Cadastrar "Automóvel", listar e consultar por identificador, verificando que a classificação aparece com os dados informados.

**Acceptance Scenarios**:

1. **Given** o nome "Automóvel", **When** a classificação é cadastrada, **Then** ela é criada ativa, com identificador próprio e datas de criação e atualização.
2. **Given** três classificações ativas e uma desativada, **When** a lista é solicitada, **Then** aparecem só as três ativas, em ordem de criação.
3. **Given** nenhuma classificação ativa, **When** a lista é solicitada, **Then** o resultado é uma lista vazia, não um erro.
4. **Given** uma classificação ativa, **When** ela é consultada pelo identificador, **Then** retornam identificador, nome, situação ativa e datas.
5. **Given** uma classificação desativada ou identificador inexistente, **When** ela é consultada, **Then** o sistema responde "Classificação não encontrada".
6. **Given** identificador em formato inválido, **When** a classificação é consultada, **Then** o sistema recusa com "Identificador inválido".
7. **Given** uma classificação ativa "Comidas", **When** se cadastra outra ativa "comidas" (outra caixa ou espaços nas pontas), **Then** o cadastro é recusado com "Já existe uma classificação com este nome".
8. **Given** nome vazio ou acima do limite, ou campos não permitidos (identificador, situação ativa, datas), **When** a classificação é cadastrada, **Then** é recusada com mensagem em português por campo e nada é gravado.

---

### User Story 2 - Cadastrar e consultar categorias (Priority: P1)

Quem controla as finanças cadastra categorias de entrada ou de saída (ex.: Gasolina, Supermercado, Futvôlei, Salário), cada uma opcionalmente ligada a uma classificação, e consulta a lista ou uma categoria específica. A lista pode ser filtrada por classificação e por tipo.

**Why this priority**: Todo lançamento de entrada ou saída exige uma categoria, e é ela que define o sentido do lançamento. Sem categorias, nenhum lançamento é possível.

**Independent Test**: Cadastrar "Gasolina" (tipo saída, classificação "Automóvel"), listar e consultar por identificador, verificando que a categoria aparece com a classificação informada.

**Acceptance Scenarios**:

1. **Given** a classificação ativa "Automóvel", **When** a categoria "Gasolina" do tipo SAÍDA é cadastrada nela, **Then** a categoria é criada ativa, com identificador próprio, ligada a "Automóvel" e com datas de criação e atualização.
2. **Given** as categorias "Gasolina" (Automóvel), "Supermercado" (Comidas), "Futvôlei" (Lazer) e "Salário" (sem classificação), **When** a lista é solicitada, **Then** cada categoria aparece com nome, tipo e a classificação a que pertence (ou "Sem classificação"), em ordem de criação.
3. **Given** categorias de várias classificações, **When** a lista é filtrada por uma classificação, **Then** aparecem só as categorias dela.
4. **Given** categorias de entrada e de saída, **When** a lista é filtrada por tipo, **Then** aparecem só as do tipo pedido.
5. **Given** nenhuma categoria ativa, **When** a lista é solicitada, **Then** o resultado é uma lista vazia, não um erro.
6. **Given** uma categoria ativa, **When** ela é consultada pelo identificador, **Then** retornam identificador, nome, tipo, classificação, situação ativa e datas.
7. **Given** uma categoria desativada ou identificador inexistente, **When** ela é consultada, **Then** o sistema responde "Categoria não encontrada".
8. **Given** identificador em formato inválido, **When** a categoria é consultada, **Then** o sistema recusa com "Identificador inválido".
9. **Given** uma categoria ativa "Gasolina" do tipo SAÍDA, **When** se cadastra outra ativa "gasolina" do mesmo tipo (outra caixa ou espaços nas pontas), **Then** o cadastro é recusado com "Já existe uma categoria com este nome para este tipo".
10. **Given** uma categoria ativa "Outros" do tipo SAÍDA, **When** se cadastra "Outros" do tipo ENTRADA, **Then** o cadastro é aceito, pois a unicidade é por nome dentro do tipo.
10a. **Given** nome "Salário" e tipo ENTRADA sem classificação, **When** a categoria é cadastrada, **Then** ela é criada ativa e sem classificação, e aparece como "Sem classificação".
11. **Given** uma classificação inexistente ou desativada, **When** se cadastra uma categoria nela, **Then** o cadastro é recusado com "Classificação não encontrada" e nada é gravado.
12. **Given** nome vazio ou acima do limite, tipo fora de ENTRADA e SAÍDA, classificação em formato inválido, ou campos não permitidos (identificador, situação ativa, datas), **When** a categoria é cadastrada, **Then** é recusada com mensagem em português por campo e nada é gravado.

---

### User Story 3 - Alterar categoria e classificação (Priority: P2)

Quem controla as finanças corrige o nome de uma classificação, ou o nome e a classificação de uma categoria (ex.: mover "Futvôlei" de "Lazer" para "Esportes"), mantendo o mesmo identificador e o histórico.

**Why this priority**: Mantém o cadastro organizado, mas o sistema já funciona sem edição.

**Independent Test**: Mover uma categoria ativa para outra classificação e, na consulta seguinte, ver a nova classificação, o mesmo identificador, o mesmo tipo e data de atualização posterior à de criação.

**Acceptance Scenarios**:

1. **Given** uma classificação ativa, **When** o nome é alterado para um nome livre, **Then** o novo nome vale, o identificador não muda, a data de atualização é renovada e as categorias dela passam a exibir o novo nome.
2. **Given** duas classificações ativas, **When** uma tenta usar o nome da outra, **Then** a alteração é recusada com "Já existe uma classificação com este nome" e nada muda.
3. **Given** uma categoria ativa, **When** o nome é alterado para um nome livre dentro do tipo, **Then** o novo nome vale e o identificador e o tipo não mudam.
4. **Given** uma categoria ativa, **When** ela é movida para outra classificação ativa, **Then** a nova classificação vale e lançamentos já feitos nela não são alterados.
4a. **Given** uma categoria ativa com classificação, **When** a classificação é removida da categoria, **Then** ela passa a "Sem classificação" e o resto não muda.
5. **Given** uma categoria ativa, **When** nome e classificação são alterados juntos, **Then** ambos valem em uma única operação.
6. **Given** duas categorias ativas do mesmo tipo, **When** uma tenta usar o nome da outra, **Then** a alteração é recusada com "Já existe uma categoria com este nome para este tipo" e nada muda.
7. **Given** uma categoria ou classificação ativa, **When** ela "altera" o nome para o próprio nome atual (mesmo em caixa diferente), **Then** a operação é aceita, sem erro de duplicidade.
8. **Given** uma categoria movida para uma classificação inexistente ou desativada, **When** a alteração é feita, **Then** é recusada com "Classificação não encontrada" e nada muda.
9. **Given** uma categoria ou classificação desativada ou inexistente, **When** se tenta alterá-la, **Then** o sistema responde "Categoria não encontrada" ou "Classificação não encontrada", conforme o caso.
10. **Given** uma categoria ativa, **When** a alteração vem sem nenhum campo, com valores fora das regras, ou tentando mudar o tipo, a situação ativa, o identificador ou as datas, **Then** é recusada com mensagem em português por campo e nada muda.

---

### User Story 4 - Desativar categoria e classificação (Priority: P3)

Quem controla as finanças deixa de usar uma categoria ou uma classificação. A remoção é sempre lógica: o registro continua guardado, marcado como inativo, preservando lançamentos passados e auditoria. Nada é apagado fisicamente.

**Why this priority**: Fecha o ciclo de vida, mas é a operação menos frequente.

**Independent Test**: Desativar uma categoria ativa e confirmar que some da lista e da consulta, mas o registro continua existindo marcado como inativo.

**Acceptance Scenarios**:

1. **Given** uma categoria ativa, **When** ela é removida, **Then** passa a ser inativa, some da lista e da consulta, e a data de atualização é renovada.
2. **Given** uma categoria com lançamentos associados, **When** ela é desativada, **Then** nenhum lançamento é apagado nem alterado.
3. **Given** uma classificação ativa sem categorias ativas, **When** ela é removida, **Then** passa a ser inativa e some da lista e da consulta.
4. **Given** uma classificação com categorias ativas, **When** ela é removida, **Then** passa a ser inativa e suas categorias continuam ativas, agora "Sem classificação", sem alterar nome, tipo nem lançamentos.
5. **Given** uma categoria ou classificação já desativada ou inexistente, **When** se tenta removê-la, **Then** o sistema responde "Categoria não encontrada" ou "Classificação não encontrada", conforme o caso.
6. **Given** uma categoria ou classificação desativada, **When** se cadastra outra com o mesmo nome (e tipo, no caso da categoria), **Then** o cadastro é aceito e cria outro registro, com outro identificador.

---

### User Story 5 - Reativar categoria e classificação (Priority: P3)

Quem controla as finanças volta a usar uma categoria ou classificação desativada (ex.: desativada por engano), mantendo o mesmo identificador e o histórico, em vez de criar outra.

**Why this priority**: Corrige desativações por engano sem perder o vínculo com lançamentos antigos, mas é a operação mais rara.

**Independent Test**: Desativar uma categoria, reativá-la e confirmar que volta à lista e à consulta com o mesmo identificador.

**Acceptance Scenarios**:

1. **Given** uma categoria ou classificação desativada, **When** ela é reativada, **Then** volta a ser ativa, com o mesmo identificador, reaparece na lista e na consulta, e a data de atualização é renovada.
2. **Given** uma categoria desativada cujo nome (no mesmo tipo) já é usado por outra categoria ativa, **When** ela é reativada, **Then** a reativação é recusada com "Já existe uma categoria com este nome para este tipo" e nada muda.
3. **Given** uma classificação desativada cujo nome já é usado por outra classificação ativa, **When** ela é reativada, **Then** a reativação é recusada com "Já existe uma classificação com este nome" e nada muda.
4. **Given** uma categoria desativada cuja classificação está desativada, **When** a categoria é reativada, **Then** ela volta ativa e "Sem classificação".
5. **Given** uma classificação reativada, **When** a lista de categorias é consultada, **Then** as categorias que ficaram "Sem classificação" na desativação continuam assim; o vínculo não é restaurado sozinho.
6. **Given** uma categoria ou classificação já ativa, **When** se tenta reativá-la, **Then** a operação é recusada com "Categoria já está ativa" ou "Classificação já está ativa", conforme o caso.
7. **Given** um identificador inexistente, **When** se tenta reativar, **Then** o sistema responde "Categoria não encontrada" ou "Classificação não encontrada"; identificador em formato inválido é recusado com "Identificador inválido".

---

### Edge Cases

- Dois cadastros ou alterações simultâneos para o mesmo nome (e tipo): apenas um é aceito; o outro recebe a mensagem de duplicidade correspondente.
- Desativação de uma classificação simultânea ao cadastro de uma categoria nela: resultado consistente (categoria criada e depois desvinculada pela desativação, ou categoria recusada com "Classificação não encontrada"), nunca uma categoria ativa ligada a classificação inativa.
- Categoria sem classificação: válida; aparece como "Sem classificação" e não entra no filtro por classificação.
- Nome com espaços nas pontas: espaços removidos antes de validar e comparar; internos preservados. Acentos são mantidos e fazem parte da comparação.
- Mesmo nome em tipos diferentes (ex.: "Outros" em ENTRADA e em SAÍDA): permitido para categorias.
- Mesmo nome de categoria em classificações diferentes e no mesmo tipo: recusado, pois a unicidade é por nome dentro do tipo, não por classificação.
- Tipo da categoria não pode mudar depois do cadastro, pois ele define o sentido dos lançamentos já feitos.
- Nenhum workspace ativo disponível ao cadastrar: recusado com mensagem clara, sem gravar registro órfão.
- Banco já existente, criado antes desta feature: não recebe a estrutura de classificações sozinho; é preciso recriar o banco (apaga os dados), já que o MVP não usa migrações. Categorias antigas, se existissem, seriam válidas sem classificação.
- Falha de comunicação com o armazenamento: nenhuma operação é aplicada parcialmente; mensagem ao usuário genérica, sem detalhes internos.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST permitir cadastrar uma classificação apenas com nome, texto de 1 a 100 caracteres, sem espaços nas pontas.
- **FR-002**: O nome da classificação MUST ser único entre as classificações ativas do workspace, sem diferenciar maiúsculas de minúsculas; o nome de uma classificação desativada MUST poder ser reutilizado.
- **FR-003**: O sistema MUST permitir listar as classificações ativas, em ordem de criação, e consultar uma classificação ativa pelo identificador.
- **FR-004**: O sistema MUST permitir alterar o nome de uma classificação ativa; a data de atualização é renovada.
- **FR-005**: O sistema MUST permitir desativar uma classificação ativa por remoção lógica; as categorias ativas ligadas a ela MUST ficar "Sem classificação" na mesma operação, sem serem desativadas.
- **FR-006**: O sistema MUST permitir cadastrar uma categoria com nome e tipo obrigatórios e classificação opcional.
- **FR-007**: O nome da categoria MUST ser texto de 1 a 100 caracteres, sem espaços nas pontas; o tipo MUST ser ENTRADA ou SAÍDA; a classificação, quando informada, MUST ser uma classificação ativa existente; sem ela, a categoria fica "Sem classificação".
- **FR-008**: O nome da categoria MUST ser único entre as categorias ativas do workspace dentro do mesmo tipo, sem diferenciar maiúsculas de minúsculas; o nome de uma categoria desativada MUST poder ser reutilizado.
- **FR-009**: O sistema MUST permitir listar as categorias ativas, em ordem de criação, cada uma com sua classificação (identificador e nome), e consultar uma categoria ativa pelo identificador.
- **FR-010**: A listagem de categorias MUST aceitar filtro opcional por classificação e por tipo, combináveis; filtro com valor inválido MUST ser recusado com mensagem em português.
- **FR-011**: O sistema MUST permitir alterar parcialmente nome e classificação de uma categoria ativa, inclusive removendo a classificação (voltando a "Sem classificação"); só os campos enviados mudam, ao menos um é obrigatório e a data de atualização é renovada.
- **FR-012**: O tipo de uma categoria MUST NOT ser alterável após o cadastro.
- **FR-013**: O sistema MUST permitir desativar uma categoria ativa por remoção lógica, sem apagar fisicamente o registro nem lançamentos relacionados.
- **FR-014**: Classificação ou categoria desativada MUST ser tratada como inexistente em consulta, listagem, alteração e nova desativação (só a reativação a enxerga) ("Classificação não encontrada" / "Categoria não encontrada").
- **FR-015**: Identificador em formato inválido MUST ser recusado com "Identificador inválido" antes de qualquer consulta ao armazenamento.
- **FR-016**: Entradas com campos desconhecidos ou proibidos (identificador, workspace, situação ativa, datas; e tipo na alteração de categoria) MUST ser recusadas com erro de validação por campo, em português.
- **FR-017**: Toda classificação e categoria MUST pertencer ao workspace único do MVP; o cliente não informa o workspace, e o cadastro MUST ser recusado se esse workspace não existir ou estiver inativo.
- **FR-018**: Toda criação, alteração, desativação e reativação, de classificação e de categoria, MUST ficar registrada na auditoria existente com valores anteriores e novos.
- **FR-019**: Nenhuma resposta ou registro de auditoria MUST conter detalhes internos de falha; erros inesperados retornam mensagem genérica.
- **FR-020**: Mensagens ao usuário MUST ser em português.
- **FR-021**: O sistema MUST NOT criar classificações ou categorias iniciais automaticamente; o cadastro parte de uma lista vazia.
- **FR-022**: O sistema MUST permitir reativar uma classificação ou categoria desativada, preservando o identificador e renovando a data de atualização.
- **FR-023**: A reativação MUST ser recusada se o nome já estiver em uso por registro ativo (mesma regra de unicidade do cadastro) e se o registro já estiver ativo.
- **FR-024**: Ao reativar uma categoria cuja classificação esteja desativada, a categoria MUST voltar ativa e "Sem classificação"; reativar uma classificação MUST NOT religar categorias que foram desvinculadas.

### Key Entities *(include if feature involves data)*

- **Classificação**: grande grupo que organiza categorias (ex.: Automóvel, Comidas, Lazer). Atributos: identificador, nome, situação ativa, datas de criação e atualização. Pertence a um workspace; agrupa zero ou mais categorias.
- **Categoria**: motivo de uma entrada ou saída de dinheiro (ex.: Gasolina, Supermercado, Futvôlei, Salário). Atributos: identificador, nome, tipo (ENTRADA ou SAÍDA), classificação, situação ativa, datas de criação e atualização. Pertence a um workspace e a no máximo uma classificação (opcional); é usada por lançamentos (feature futura), e é ela que define o sentido do lançamento.
- **Workspace**: espaço da família que agrupa contas, categorias, classificações, membros e lançamentos. Único no MVP, chamado "familia", criado pelo seed do banco.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Quem usa o sistema cadastra uma classificação ou uma categoria em uma única operação, e ela aparece na lista imediatamente.
- **SC-002**: Com até 1.000 categorias e 100 classificações ativas, listagem (com ou sem filtro), consulta, alteração e desativação respondem em menos de 1 segundo.
- **SC-003**: 100% das criações, alterações e desativações geram registro de auditoria; 0 registros são apagados fisicamente.
- **SC-004**: Em 100 tentativas simultâneas de cadastrar o mesmo nome (e tipo), exatamente 1 é aceita e as demais recebem a mensagem de duplicidade.
- **SC-005**: 100% das entradas inválidas retornam mensagem em português que identifica o campo, sem gravar nada.
- **SC-006**: 0 categorias ativas ligadas a classificações inativas ou inexistentes, em qualquer sequência de operações testada.
- **SC-007**: Os três exemplos do pedido (Gasolina em Automóvel, Supermercado em Comidas, Futvôlei em Lazer) são cadastrados e listados com a classificação correta, sem ajuda técnica.

## Assumptions

- Classificação é uma entidade própria, com cadastro e ciclo de vida próprios, e não um texto livre na categoria. Isso evita variações de grafia ("Automovel", "Automóvel") e permite renomear um grupo em um só lugar.
- Cada categoria tem no máximo uma classificação, e ela é opcional (decisão da clarificação de 2026-11-03). Não há hierarquia (classificação dentro de classificação) nem categorias em mais de uma classificação.
- Categorias têm tipo ENTRADA ou SAÍDA, conforme o esquema de dados existente; o valor trafegado e gravado é escrito sem acento (`SAIDA`), e as mensagens ao usuário escrevem "SAÍDA". Os exemplos do pedido são todos de saída; o tipo é informado no cadastro.
- Existe exatamente um workspace ativo no MVP, chamado "familia", usado implicitamente pela API, como na feature de contas.
- Sem autenticação nesta fase: as rotas ficam abertas no MVP, como nas features de usuário e conta, e não devem ir para produção assim.
- Sem paginação nas listagens; o volume familiar é pequeno (dezenas de categorias).
- Lançamentos estão fora do escopo; esta feature não valida o uso de categorias em lançamentos. Desativar uma categoria já usada em lançamentos é permitido e não os altera.
- Sem categorias ou classificações pré-cadastradas (FR-021); o usuário monta o próprio plano.
- O tipo da categoria é imutável; para mudar o sentido, desativa-se a categoria e cria-se outra.
