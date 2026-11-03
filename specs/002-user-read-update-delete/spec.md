# Feature Specification: Consulta, Alteração e Desativação de Usuário

**Feature Branch**: `feature/create-user`

**Created**: 2026-11-02

**Status**: Draft

**Input**: User description: "Get/update/delete usuario. Complete o crud de usuário. Get users, Get user by id, Update user by id, Delete user by id"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consultar usuários (Priority: P1)

Quem opera o sistema lista os usuários cadastrados ou consulta um usuário específico pelo identificador, para conferir cadastros e obter o identificador usado nas demais operações.

**Why this priority**: É a base das outras operações (alterar e desativar precisam de um identificador) e permite conferir o resultado do cadastro, entregue na feature anterior.

**Independent Test**: Com usuários ativos e desativados no sistema, listar e consultar por identificador, verificando que só os ativos aparecem e que nenhuma resposta traz senha.

**Acceptance Scenarios**:

1. **Given** três usuários ativos e um desativado, **When** a lista é solicitada, **Then** aparecem os três ativos, em ordem de criação, sem o desativado e sem senha.
2. **Given** nenhum usuário ativo, **When** a lista é solicitada, **Then** o resultado é uma lista vazia, não um erro.
3. **Given** um usuário ativo, **When** ele é consultado pelo identificador, **Then** retornam identificador, e-mail, situação ativa, data de criação e data de atualização, sem senha.
4. **Given** um usuário desativado ou um identificador que não existe, **When** ele é consultado, **Then** o sistema responde "Usuário não encontrado".
5. **Given** um identificador em formato inválido, **When** ele é consultado, **Then** o sistema recusa com "Identificador inválido", sem procurar no armazenamento.

---

### User Story 2 - Alterar usuário (Priority: P2)

O usuário muda seu e-mail e/ou sua senha, mantendo o mesmo cadastro e o mesmo identificador.

**Why this priority**: Mantém o cadastro correto ao longo do tempo, mas o sistema já funciona sem edição.

**Independent Test**: Alterar o e-mail de um usuário ativo e, na consulta seguinte, ver o novo e-mail e uma data de atualização posterior à de criação.

**Acceptance Scenarios**:

1. **Given** um usuário ativo, **When** o e-mail é alterado para um e-mail livre, **Then** o novo e-mail passa a valer, o identificador não muda e a data de atualização é renovada.
2. **Given** um usuário ativo, **When** a senha é alterada para uma senha válida, **Then** a nova senha passa a valer, o resultado não contém senha e a data de atualização é renovada.
3. **Given** um usuário ativo, **When** e-mail e senha são alterados juntos, **Then** os dois valem a partir daí, em uma única operação.
4. **Given** dois usuários ativos, **When** um tenta trocar o e-mail para o do outro, **Then** a alteração é recusada com "E-mail já está em uso" e nada muda.
5. **Given** um usuário ativo, **When** ele "altera" o e-mail para o próprio e-mail atual (mesmo em caixa diferente), **Then** a operação é aceita, sem erro de duplicidade.
6. **Given** o e-mail de um usuário desativado, **When** um usuário ativo troca o próprio e-mail para ele, **Then** a alteração é aceita.
7. **Given** um usuário desativado ou inexistente, **When** se tenta alterá-lo, **Then** o sistema responde "Usuário não encontrado".
8. **Given** um usuário ativo, **When** a alteração é enviada sem nenhum campo, ou com e-mail/senha fora das regras, ou com campos não permitidos, **Then** ela é recusada com mensagem em português por campo e nada muda.

---

### User Story 3 - Desativar usuário (Priority: P3)

Quem opera o sistema remove um cadastro. A remoção é sempre lógica: o registro continua guardado, marcado como inativo, preservando histórico e auditoria. Nada é apagado fisicamente.

**Why this priority**: Fecha o ciclo de vida do cadastro, mas é a operação menos frequente.

**Independent Test**: Desativar um usuário ativo e confirmar que ele some das consultas e listas, mas o registro continua existindo marcado como inativo.

**Acceptance Scenarios**:

1. **Given** um usuário ativo, **When** ele é removido, **Then** passa a ser inativo, some da lista e da consulta por identificador, e a data de atualização é renovada.
2. **Given** um usuário já desativado ou inexistente, **When** se tenta removê-lo, **Then** o sistema responde "Usuário não encontrado".
3. **Given** um usuário com workspaces e lançamentos, **When** ele é desativado, **Then** nenhum dado relacionado é apagado nem desativado.
4. **Given** um usuário desativado, **When** alguém cadastra novamente o mesmo e-mail, **Then** o cadastro é aceito e cria um novo usuário, com outro identificador.

---

### Edge Cases

- Duas alterações simultâneas de usuários diferentes para o mesmo e-mail: apenas uma é aceita; a outra recebe "E-mail já está em uso".
- Alteração e desativação simultâneas do mesmo usuário: o resultado é consistente (a alteração é aplicada antes da desativação, ou recebe "Usuário não encontrado"), nunca um estado parcial.
- Identificador em formato inválido em qualquer operação: recusado antes de consultar o armazenamento.
- E-mail com maiúsculas ou espaços nas pontas na alteração: normalizado (minúsculas, sem espaços) antes de comparar e gravar, como no cadastro.
- Campos desconhecidos ou proibidos na alteração (identificador, situação ativa, datas): recusados com erro de validação, nunca gravados.
- Falha de comunicação com o armazenamento: nenhuma operação é aplicada parcialmente e a mensagem ao usuário é genérica, sem detalhes internos.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE listar os usuários ativos, com identificador, e-mail, situação ativa, data de criação e data de atualização, em ordem de criação (mais antigo primeiro). Sem usuários ativos, a lista é vazia.
- **FR-002**: O sistema DEVE permitir consultar um usuário ativo pelo identificador, devolvendo os mesmos campos de FR-001.
- **FR-003**: O sistema DEVE recusar identificadores em formato inválido com a mensagem "Identificador inválido", sem consultar o armazenamento.
- **FR-004**: O sistema DEVE permitir alterar e-mail e/ou senha de um usuário ativo, exigindo ao menos um dos dois campos. Campos não informados permanecem como estão.
- **FR-005**: O sistema DEVE aplicar na alteração as mesmas regras do cadastro: e-mail normalizado, com formato válido e até 255 caracteres; senha de 8 a 72 caracteres, com mensagens em português por campo inválido.
- **FR-006**: O sistema DEVE garantir que, após a alteração, não existam dois usuários ativos com o mesmo e-mail, recusando com "E-mail já está em uso". Alterar para o próprio e-mail atual NÃO é conflito, e o e-mail de um usuário desativado pode ser usado.
- **FR-007**: O sistema DEVE guardar a senha alterada apenas de forma irreversível (hash com salt) e NUNCA devolver senha nem hash em nenhuma resposta, mensagem de erro ou log.
- **FR-008**: O sistema NÃO DEVE permitir que o cliente altere o identificador, a situação ativa ou as datas; campos fora de e-mail e senha são recusados.
- **FR-009**: O sistema DEVE renovar a data de atualização a cada alteração e a cada desativação, e manter a data de criação inalterada.
- **FR-010**: O sistema DEVE implementar a remoção de usuário exclusivamente como desativação lógica (situação ativa = falso). Nenhuma operação desta feature apaga fisicamente um registro.
- **FR-011**: O sistema DEVE tratar usuários desativados como inexistentes em listagem, consulta, alteração e nova desativação, respondendo "Usuário não encontrado".
- **FR-012**: A desativação NÃO DEVE apagar nem desativar dados relacionados ao usuário (workspaces, membros, contas, lançamentos).
- **FR-013**: Alteração e desativação DEVEM ficar registradas na trilha de auditoria já existente, sem nunca gravar senha ou hash nela.
- **FR-014**: No MVP, listar, consultar, alterar e desativar usuários ficam abertos a qualquer cliente, sem autenticação, como já ocorre no cadastro. Essas rotas NÃO DEVEM ir para produção sem a proteção definida junto com o login.
- **FR-015**: Toda resposta de erro DEVE trazer mensagem em português que indique o que corrigir, sem expor detalhes internos.

### Key Entities

- **Usuário**: pessoa que possui conta no sistema e gerencia workspaces. Atributos: identificador único, e-mail (único entre ativos), senha protegida, situação ativa, data de criação, data de atualização. Já existe desde a feature de cadastro; esta feature só consulta, altera e desativa.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% das operações de consulta, alteração e desativação sobre um usuário desativado ou inexistente respondem "Usuário não encontrado".
- **SC-002**: 0 registros de usuário são apagados fisicamente por qualquer operação do sistema; após desativar, o registro continua existindo marcado como inativo.
- **SC-003**: Em 0% das respostas, mensagens de erro, registros de log e linhas da trilha de auditoria aparecem a senha ou seu hash.
- **SC-004**: 100% das alterações que levariam a dois usuários ativos com o mesmo e-mail são recusadas, inclusive quando simultâneas.
- **SC-005**: Consulta, alteração e desativação respondem em menos de 1 segundo com até 10.000 usuários cadastrados, e a listagem responde em menos de 1 segundo com até 1.000 usuários ativos.
- **SC-006**: Toda resposta de erro traz mensagem em português que indica o que corrigir, sem expor detalhes internos.

## Assumptions

- Esta feature completa o CRUD de usuário iniciado em `specs/001-user-crud` (cadastro). As regras de e-mail e senha são as mesmas de lá.
- As operações são abertas a qualquer cliente no MVP (decisão do responsável); a proteção de acesso vem com a feature de login.
- Login, autenticação, recuperação de senha, confirmação de e-mail e reativação de usuário desativado ficam fora do escopo.
- Como não há login, a alteração de senha não exige informar a senha atual.
- A listagem não tem paginação nem filtros no MVP (uso familiar, volume baixo).
- "Excluir" significa desativar: o atributo booleano de situação ativa passa a falso, conforme a regra definida desde a primeira feature.
- Desativar um usuário não desativa seus workspaces nem dados relacionados; o tratamento deles fica para quando houver autenticação e regras de propriedade.
- A trilha de auditoria existente registra automaticamente as escritas na tabela de usuários, e já omite a senha.
- A alteração é parcial: só os campos enviados mudam.
