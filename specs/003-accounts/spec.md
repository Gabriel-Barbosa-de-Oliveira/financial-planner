# Feature Specification: Contas (Accounts)

**Feature Branch**: `feature/accounts`

**Created**: 2026-11-02

**Status**: Draft

**Input**: User description: "CRUD Contas de banco (accounts). Contas onde o dinheiro fica. Exemplo: Santander, Carteira, Nubank."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cadastrar e consultar contas (Priority: P1)

Quem controla as finanças da família cadastra as contas onde o dinheiro fica (ex.: Santander, Nubank, Carteira), informando nome, tipo e saldo inicial, e consulta a lista de contas ou uma conta específica.

**Why this priority**: Toda entrada, saída e transferência acontece em uma conta. Sem contas cadastradas, nenhum lançamento é possível.

**Independent Test**: Cadastrar "Nubank" (tipo banco, saldo inicial 1.500,00), listar e consultar por identificador, verificando que a conta aparece com os dados informados.

**Acceptance Scenarios**:

1. **Given** nome "Nubank", tipo "BANK" e saldo inicial 1500.00, **When** a conta é cadastrada, **Then** ela é criada ativa, com identificador próprio, saldo 1500.00 e datas de criação e atualização.
2. **Given** nome e tipo sem saldo inicial, **When** a conta é cadastrada, **Then** o saldo começa em 0.00.
3. **Given** três contas ativas e uma desativada, **When** a lista é solicitada, **Then** aparecem só as três ativas, em ordem de criação.
4. **Given** nenhuma conta ativa, **When** a lista é solicitada, **Then** o resultado é uma lista vazia, não um erro.
5. **Given** uma conta ativa, **When** ela é consultada pelo identificador, **Then** retornam identificador, nome, tipo, saldo, situação ativa e datas.
6. **Given** uma conta desativada ou identificador inexistente, **When** ela é consultada, **Then** o sistema responde "Conta não encontrada".
7. **Given** identificador em formato inválido, **When** a conta é consultada, **Then** o sistema recusa com "Identificador inválido".
8. **Given** uma conta ativa chamada "Nubank", **When** se cadastra outra conta ativa "nubank" (outra caixa ou espaços nas pontas), **Then** o cadastro é recusado com "Já existe uma conta com este nome".
9. **Given** nome vazio ou acima do limite, tipo fora da lista permitida, saldo inicial não numérico, ou campos não permitidos (identificador, situação ativa, datas), **When** a conta é cadastrada, **Then** é recusada com mensagem em português por campo e nada é gravado.

---

### User Story 2 - Alterar conta (Priority: P2)

Quem controla as finanças corrige o nome ou o tipo de uma conta (ex.: renomear "Santander" para "Santander Corrente"), mantendo o mesmo identificador e o histórico.

**Why this priority**: Mantém o cadastro correto, mas o sistema já funciona sem edição.

**Independent Test**: Renomear uma conta ativa e, na consulta seguinte, ver o novo nome, o mesmo identificador, o mesmo saldo e data de atualização posterior à de criação.

**Acceptance Scenarios**:

1. **Given** uma conta ativa, **When** o nome é alterado para um nome livre, **Then** o novo nome vale, identificador e saldo não mudam e a data de atualização é renovada.
2. **Given** uma conta ativa, **When** o tipo é alterado para outro tipo permitido, **Then** o novo tipo vale.
3. **Given** uma conta ativa, **When** nome e tipo são alterados juntos, **Then** ambos valem em uma única operação.
4. **Given** duas contas ativas, **When** uma tenta usar o nome da outra, **Then** a alteração é recusada com "Já existe uma conta com este nome" e nada muda.
5. **Given** uma conta ativa, **When** ela "altera" o nome para o próprio nome atual (mesmo em caixa diferente), **Then** a operação é aceita, sem erro de duplicidade.
6. **Given** uma conta desativada ou inexistente, **When** se tenta alterá-la, **Then** o sistema responde "Conta não encontrada".
7. **Given** uma conta ativa, **When** a alteração vem sem nenhum campo, com valores fora das regras, ou tentando mudar saldo, situação ativa, identificador ou datas, **Then** é recusada com mensagem em português por campo e nada muda.

---

### User Story 3 - Desativar conta (Priority: P3)

Quem controla as finanças deixa de usar uma conta (ex.: conta encerrada). A remoção é sempre lógica: o registro continua guardado, marcado como inativo, preservando lançamentos passados e auditoria. Nada é apagado fisicamente.

**Why this priority**: Fecha o ciclo de vida, mas é a operação menos frequente.

**Independent Test**: Desativar uma conta ativa e confirmar que some da lista e da consulta, mas o registro continua existindo marcado como inativo.

**Acceptance Scenarios**:

1. **Given** uma conta ativa, **When** ela é removida, **Then** passa a ser inativa, some da lista e da consulta, e a data de atualização é renovada.
2. **Given** uma conta já desativada ou inexistente, **When** se tenta removê-la, **Then** o sistema responde "Conta não encontrada".
3. **Given** uma conta com lançamentos associados, **When** ela é desativada, **Then** nenhum lançamento é apagado nem alterado.
4. **Given** uma conta desativada, **When** se cadastra uma nova conta com o mesmo nome, **Then** o cadastro é aceito e cria outra conta, com outro identificador.

---

### Edge Cases

- Dois cadastros ou alterações simultâneos para o mesmo nome: apenas um é aceito; o outro recebe "Já existe uma conta com este nome".
- Alteração e desativação simultâneas da mesma conta: resultado consistente (alteração aplicada antes da desativação, ou "Conta não encontrada"), nunca estado parcial.
- Saldo inicial negativo: aceito (conta no cheque especial ou cartão), dentro dos limites de valor suportados.
- Saldo inicial com mais de duas casas decimais ou acima do limite de valor suportado: recusado com mensagem por campo.
- Nome com espaços nas pontas: espaços removidos antes de validar e comparar; internos preservados.
- Nenhum workspace ativo disponível quando se cadastra uma conta (ex.: banco criado sem o seed): recusado com mensagem clara, sem gravar conta órfã.
- Banco já existente, criado antes do seed: não recebe o workspace sozinho; é preciso recriar o banco (apaga os dados) ou inserir o workspace à mão.
- Falha de comunicação com o armazenamento: nenhuma operação é aplicada parcialmente; mensagem ao usuário genérica, sem detalhes internos.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST permitir cadastrar uma conta com nome, tipo e saldo inicial opcional (padrão 0.00).
- **FR-002**: O nome MUST ser texto de 1 a 100 caracteres, sem espaços nas pontas; o tipo MUST ser um dentre BANK, INVESTMENT, CASH e SAVINGS.
- **FR-003**: O saldo inicial MUST aceitar valores positivos, zero ou negativos, com até duas casas decimais, dentro do limite de valor suportado pelo armazenamento (até 12 dígitos no total).
- **FR-004**: Toda conta MUST pertencer ao workspace único do MVP; o cliente não informa o workspace, e o cadastro MUST ser recusado se esse workspace não existir ou estiver inativo.
- **FR-005**: O nome MUST ser único entre as contas ativas do workspace, sem diferenciar maiúsculas de minúsculas; o nome de uma conta desativada MUST poder ser reutilizado.
- **FR-006**: O sistema MUST permitir listar as contas ativas, em ordem de criação, e consultar uma conta ativa pelo identificador.
- **FR-007**: O sistema MUST permitir alterar parcialmente nome e tipo de uma conta ativa; só os campos enviados mudam, ao menos um é obrigatório e a data de atualização é renovada.
- **FR-008**: O saldo MUST NOT ser alterável diretamente após o cadastro; mudanças de saldo virão de lançamentos (feature futura).
- **FR-009**: O sistema MUST permitir desativar uma conta ativa por remoção lógica (situação ativa = falso), sem apagar fisicamente o registro nem dados relacionados.
- **FR-010**: Conta desativada MUST ser tratada como inexistente em consulta, listagem, alteração e nova desativação ("Conta não encontrada").
- **FR-011**: Identificador em formato inválido MUST ser recusado com "Identificador inválido" antes de qualquer consulta ao armazenamento.
- **FR-012**: Entradas com campos desconhecidos ou proibidos (identificador, workspace, situação ativa, datas; e saldo na alteração) MUST ser recusadas com erro de validação por campo, em português.
- **FR-013**: Toda criação, alteração e desativação MUST ficar registrada na auditoria existente com valores anteriores e novos.
- **FR-014**: Nenhuma resposta ou registro de auditoria MUST conter detalhes internos de falha; erros inesperados retornam mensagem genérica.
- **FR-015**: Mensagens ao usuário MUST ser em português.
- **FR-016**: O banco MUST nascer com um seed que cria o workspace padrão chamado "familia", ativo, junto de um usuário dono sem senha utilizável (todo workspace exige um dono). O seed MUST ser registrado na auditoria e não pode criar contas, categorias, membros ou lançamentos.

### Key Entities *(include if feature involves data)*

- **Conta**: lugar onde o dinheiro fica. Atributos: identificador, nome, tipo (BANK, INVESTMENT, CASH, SAVINGS), saldo, situação ativa, datas de criação e atualização. Pertence a um workspace; é origem ou destino de lançamentos (feature futura).
- **Workspace**: espaço da família que agrupa contas, categorias, membros e lançamentos. Nesta feature é único e chamado "familia", criado pelo seed do banco (FR-016); seu cadastro pela API está fora do escopo.
- **Usuário dono do seed**: usuário técnico criado junto do workspace "familia", sem senha utilizável; existe só para satisfazer a regra de que todo workspace tem dono.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Quem usa o sistema cadastra uma conta em uma única operação, e ela aparece na lista imediatamente.
- **SC-002**: Com até 1.000 contas ativas, listagem, consulta, alteração e desativação respondem em menos de 1 segundo.
- **SC-003**: 100% das criações, alterações e desativações geram registro de auditoria; 0 contas são apagadas fisicamente.
- **SC-004**: Em 100 tentativas simultâneas de cadastrar o mesmo nome, exatamente 1 é aceita e as demais recebem a mensagem de nome duplicado.
- **SC-005**: 100% das entradas inválidas retornam mensagem em português que identifica o campo, sem gravar nada.
- **SC-006**: O saldo de uma conta nunca muda por alteração de cadastro: 0 divergências em testes de alteração.
- **SC-007**: Um banco novo, sem nenhuma ação manual, já permite cadastrar a primeira conta: 1 workspace "familia" ativo e nenhuma outra linha de domínio criada pelo seed.

## Assumptions

- Existe exatamente um workspace ativo no MVP, chamado "familia", criado pelo seed do banco (FR-016); a API o usa implicitamente. A forma de localizá-lo (por nome ou configuração) é decisão de planejamento.
- Cadastro de workspace, categorias, membros e lançamentos estão fora do escopo; o saldo só muda por lançamentos, que virão em feature futura.
- Os tipos permitidos seguem o esquema de dados existente: BANK, INVESTMENT, CASH, SAVINGS.
- Sem autenticação nesta fase: as rotas ficam abertas no MVP, como nas features de usuário, e não devem ir para produção assim; a proteção vem com a feature de login.
- Sem paginação na listagem; o volume familiar é pequeno (dezenas de contas).
- Moeda única do workspace (padrão BRL); não há conversão entre moedas.
- Desativar uma conta com saldo diferente de zero ou com lançamentos é permitido; regras de transferência de saldo ficam para features futuras.
