# Feature Specification: Cadastro de Usuário (primeira entrega do CRUD)

**Feature Branch**: `feature/create-user`

**Created**: 2026-11-02

**Status**: Draft

**Input**: User description: "Crud para usuario. Não utilizar deleção fisica. Apenas deleção logica atraves de atribudo ativo boolean."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cadastrar usuário (Priority: P1)

Uma pessoa que quer controlar as finanças da família cria uma conta informando e-mail e senha. A partir daí ela passa a existir no sistema e pode, em features futuras, gerenciar seu workspace.

**Why this priority**: Sem usuário cadastrado nenhuma outra parte do sistema (workspaces, contas, lançamentos) pode existir. É o menor pedaço que entrega valor.

**Independent Test**: Cadastrar um usuário com e-mail e senha válidos e confirmar que ele é devolvido com identificador, e-mail, situação ativa e datas, sem a senha.

**Acceptance Scenarios**:

1. **Given** nenhum usuário com o e-mail `ana@exemplo.com`, **When** a pessoa se cadastra com esse e-mail e uma senha válida, **Then** o usuário é criado como ativo e os dados retornados não contêm a senha.
2. **Given** um usuário ativo com o e-mail `ana@exemplo.com`, **When** alguém tenta se cadastrar com `ANA@exemplo.com `, **Then** o cadastro é recusado informando que o e-mail já está em uso.
3. **Given** qualquer estado, **When** o cadastro é enviado com e-mail em formato inválido ou senha fora das regras, **Then** o cadastro é recusado com mensagem em português indicando cada campo inválido.

---

### Edge Cases

- E-mail com letras maiúsculas ou espaços nas pontas: é normalizado (minúsculas, sem espaços) antes de qualquer comparação ou gravação.
- Dois cadastros simultâneos com o mesmo e-mail: apenas um é aceito; o outro recebe "e-mail já está em uso".
- Cadastro com o e-mail de um usuário desativado: permitido; só e-mails de usuários ativos contam como "em uso".
- Campos desconhecidos enviados no cadastro (ex.: tentar definir a situação ativa ou o identificador): são recusados com erro de validação, nunca gravados.
- Falha de comunicação com o armazenamento: a operação não é parcialmente aplicada e o usuário recebe mensagem genérica em português, sem detalhes internos.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE permitir cadastrar um usuário com e-mail e senha.
- **FR-002**: O sistema DEVE validar o e-mail (formato válido, até 255 caracteres) e a senha (mínimo de 8 e máximo de 72 caracteres) antes de qualquer gravação, devolvendo mensagens em português por campo inválido.
- **FR-003**: O sistema DEVE normalizar o e-mail (minúsculas, sem espaços nas pontas) antes de validar unicidade e gravar.
- **FR-004**: O sistema DEVE garantir que não existam dois usuários ativos com o mesmo e-mail, recusando com a mensagem "E-mail já está em uso". O e-mail de um usuário desativado pode ser reutilizado.
- **FR-005**: O sistema DEVE guardar a senha apenas de forma irreversível (hash com salt), nunca em texto puro.
- **FR-006**: O sistema NUNCA DEVE devolver a senha nem seu hash em nenhuma resposta, mensagem de erro ou log.
- **FR-007**: O cadastro DEVE devolver identificador, e-mail, situação ativa, data de criação e data de atualização do usuário criado.
- **FR-008**: O sistema NÃO DEVE permitir que o cliente defina o identificador, a situação ativa ou as datas; todo usuário nasce ativo.
- **FR-009**: O cadastro DEVE ficar registrado na trilha de auditoria já existente.
- **FR-010**: Esta feature NÃO DEVE incluir nenhuma operação de exclusão física. Quando a remoção for implementada (feature futura), será exclusivamente lógica (situação ativa = falso).

### Key Entities

- **Usuário**: pessoa que possui login no sistema e gerencia workspaces. Atributos: identificador único, e-mail (único entre ativos), senha protegida, situação ativa, data de criação, data de atualização. Um usuário pode ter vários workspaces (fora do escopo desta feature).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Uma pessoa conclui o cadastro em menos de 1 minuto, preenchendo apenas e-mail e senha.
- **SC-002**: 100% das tentativas de cadastro com e-mail já usado por um usuário ativo são recusadas, inclusive quando simultâneas.
- **SC-003**: Em 0% das respostas, mensagens de erro ou registros de log aparecem a senha ou seu hash.
- **SC-004**: 0 registros de usuário são apagados fisicamente por qualquer operação do sistema.
- **SC-005**: O cadastro responde em menos de 1 segundo com até 10.000 usuários já cadastrados.
- **SC-006**: Toda resposta de erro traz mensagem em português que indica o que corrigir, sem expor detalhes internos.

## Assumptions

- **Escopo desta entrega: somente o cadastro (Create).** Consulta, listagem, alteração e desativação lógica ficam para uma feature seguinte, depois da autenticação, porque sem login qualquer cliente poderia ler, alterar ou desativar qualquer usuário.
- A regra de remoção já está definida para essa feature futura: apenas desativação lógica pelo atributo booleano de situação ativa, nunca exclusão física.
- Login, autenticação, recuperação de senha e confirmação de e-mail ficam fora do escopo.
- Criação automática de workspace no cadastro fica fora do escopo; o cadastro cria apenas o usuário.
- O cadastro fica aberto a qualquer cliente no MVP; esta rota não é pensada para produção sem a proteção de cadastro definida junto com o login.
- Os únicos dados do usuário são e-mail e senha (não há nome nesta versão).
- A trilha de auditoria existente registra automaticamente as escritas na tabela de usuários.
