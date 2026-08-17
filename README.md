# 💰 Financial Control - MVP

Sistema de controle financeiro familiar com **Node.js (HTTP Nativo) + React + PostgreSQL 16**.

Um projeto pessoal estruturado com arquitetura sólida desde o início, focado em rastreabilidade completa e saúde financeira familiar.

---

## 📋 Visão Geral

### O que é?

Financial Control é um sistema para gerenciar finanças de uma ou mais pessoas dentro de um workspace familiar:

- **Gabriel** lança R$ 12.000 de Salário → Santander Corrente
- **Larissa** lança R$ 200 de Supermercado → Santander Corrente
- Sistema calcula saldo líquido por pessoa
- Dashboard mostra saúde financeira (vermelho/azul)

### Conceitos-chave

| Conceito | O que é | Exemplo |
|----------|---------|---------|
| **User** | Autenticado no sistema | xpto@gmail.com (você) |
| **Workspace** | Espaço familiar compartilhado | "Finanças da Família Silva" |
| **Members** | Pessoas que lançam (não têm login) | Gabriel, Larissa |
| **Accounts** | Contas onde dinheiro fica | Santander, Tesouro Selic, Carteira |
| **Categories** | Tipos de movimentação | Salário (ENTRADA), Gasolina (SAÍDA) |
| **Transactions** | Movimentações de dinheiro | Lançamento de R$ 200 |
| **Installments** | Parcelas de transações | R$ 1.200 em 12x de R$ 100 |

---

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                  FRONTEND (React)                            │
│  - Dashboard (análise de gastos)                             │
│  - CRUDs (Transactions, Categories, Members, Accounts)      │
│  - Login                                                     │
└─────────────────────────┬──────────────────────────────────┘
                          │ HTTP REST
                          ↓
┌─────────────────────────────────────────────────────────────┐
│        BACKEND (Node.js - HTTP Server Nativo)                │
│  - Roteamento (Routes)                                       │
│  - Controllers (lógica requisição/resposta)                  │
│  - Services (regras de negócio)                              │
│  - Repositories (acesso aos dados)                           │
│  - Middlewares (autenticação, validação, CORS)              │
└─────────────────────────┬──────────────────────────────────┘
                          │
                          ↓
┌─────────────────────────────────────────────────────────────┐
│           DATABASE (PostgreSQL 16 Alpine)                    │
│  - 8 Tabelas (users, workspaces, members, accounts,         │
│               categories, transactions, installments,       │
│               audit_log)                                    │
│  - Soft delete (isActive em todas)                           │
│  - Auditoria automática (triggers + audit_log)              │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Pré-requisitos

- Docker e Docker Compose instalados
- Git (opcional, para versionamento)

### 1️⃣ Clonar/Preparar o projeto

```bash
# Se for um novo projeto
mkdir financial-control
cd financial-control

# Estrutura básica
mkdir -p backend/src frontend database
```

### 2️⃣ Estrutura de pastas

```
financial-control/
├─ database/
│  ├─ Dockerfile
│  └─ schema.sql
├─ backend/
│  ├─ src/
│  │  ├─ controllers/
│  │  ├─ services/
│  │  ├─ repositories/
│  │  ├─ middlewares/
│  │  ├─ utils/
│  │  └─ server.js
│  ├─ package.json
│  └─ Dockerfile (será criado depois)
├─ frontend/
│  ├─ src/
│  │  ├─ components/
│  │  ├─ pages/
│  │  ├─ services/
│  │  ├─ App.jsx
│  │  └─ main.jsx
│  └─ package.json
├─ docker-compose.yml
├─ .env.example
├─ .gitignore
└─ README.md
```

### 3️⃣ Subir os containers

```bash
# Subir PostgreSQL + CloudBeaver
docker-compose up -d

# Aguardar inicialização (~15 segundos)
sleep 15

# Verificar se estão rodando
docker ps
```

### 4️⃣ Verificar saúde do banco

```bash
# Logs do PostgreSQL
docker logs financial-control-db

# Deve conter: "database system is ready to accept connections"
```

### 5️⃣ Verificar se tabelas foram criadas

```bash
# Conectar ao banco
docker exec -it financial-control-db psql -U financial_user -d financial_control_db -c "\dt"

# Deve listar 8 tabelas:
# - users, workspaces, members, accounts, categories, transactions, installments, audit_log
```

---

## 🔧 Conexões ao Banco

### CloudBeaver Community (Recomendado)

```
URL: http://localhost:8978
Email: admin@cloudbeaver.local
Senha: cloudbeaver_admin_123
```

**Registrar servidor PostgreSQL:**

1. Clique em **"New Database Connection"**
2. Selecione **"PostgreSQL"**
3. Preencha os dados:
   - **Connection Name:** Financial Control DB
   - **Host:** postgres
   - **Port:** 5432
   - **Database:** financial_control_db
   - **Username:** financial_user
   - **Password:** secure_password_123
4. Clique em **"Test Connection"** ✅
5. Clique em **"Finish"**

### pgAdmin4 (Alternativa)

```
URL: http://localhost:5050
Email: admin@financial.local
Senha: pgadmin_password_123
```

**Registrar servidor:**

1. Menu esquerdo → **Servers** → Clique direito → **Register** → **Server**
2. Aba **"General"**:
   - Name: financial-control-db
3. Aba **"Connection"**:
   - Host: postgres
   - Port: 5432
   - Database: financial_control_db
   - Username: financial_user
   - Password: secure_password_123
4. Clique **"Save"**

### Conexão via Linha de Comando

```bash
# Conectar direto ao banco
docker exec -it financial-control-db psql -U financial_user -d financial_control_db

# Dentro do psql:
\dt                    # listar tabelas
\d transactions        # ver estrutura
SELECT * FROM users;   # ver dados
\q                     # sair
```

---

## 📊 Queries Úteis

### Dados de Exemplo (Inserção)

```sql
-- Criar usuário
INSERT INTO users (email, password_hash, isActive)
VALUES ('gabriel@family.com', 'hash_da_senha', TRUE);

-- Copiar o ID do usuário retornado (uuid)
-- Usar em {USER_ID} nas queries abaixo

-- Criar workspace
INSERT INTO workspaces (userId, name, currency, isActive)
VALUES ('{USER_ID}', 'Finanças Silva', 'BRL', TRUE);

-- Copiar o ID do workspace (uuid)
-- Usar em {WORKSPACE_ID}

-- Criar members
INSERT INTO members (workspaceId, name, isActive)
VALUES ('{WORKSPACE_ID}', 'Gabriel', TRUE);

INSERT INTO members (workspaceId, name, isActive)
VALUES ('{WORKSPACE_ID}', 'Larissa', TRUE);

-- Criar accounts
INSERT INTO accounts (workspaceId, name, balance, type, isActive)
VALUES ('{WORKSPACE_ID}', 'Santander Corrente', 0.00, 'BANK', TRUE);

INSERT INTO accounts (workspaceId, name, balance, type, isActive)
VALUES ('{WORKSPACE_ID}', 'Tesouro Selic', 0.00, 'INVESTMENT', TRUE);

INSERT INTO accounts (workspaceId, name, balance, type, isActive)
VALUES ('{WORKSPACE_ID}', 'Carteira', 0.00, 'CASH', TRUE);

-- Criar categorias ENTRADA
INSERT INTO categories (workspaceId, name, type, isActive)
VALUES ('{WORKSPACE_ID}', 'Salário', 'ENTRADA', TRUE);

INSERT INTO categories (workspaceId, name, type, isActive)
VALUES ('{WORKSPACE_ID}', 'Investimento', 'ENTRADA', TRUE);

-- Criar categorias SAÍDA
INSERT INTO categories (workspaceId, name, type, isActive)
VALUES ('{WORKSPACE_ID}', 'Gasolina', 'SAÍDA', TRUE);

INSERT INTO categories (workspaceId, name, type, isActive)
VALUES ('{WORKSPACE_ID}', 'Supermercado', 'SAÍDA', TRUE);
```

### Ver Todas as Tabelas

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;
```

### Ver Estrutura de Uma Tabela

```sql
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'transactions'
ORDER BY ordinal_position;
```

### Ver Todos os Usuários

```sql
SELECT id, email, isActive, createdAt 
FROM users
ORDER BY createdAt DESC;
```

### Ver Todos os Workspaces

```sql
SELECT id, userId, name, currency, isActive, createdAt
FROM workspaces
WHERE isActive = TRUE
ORDER BY createdAt DESC;
```

### Ver Membros de um Workspace

```sql
SELECT id, name, isActive, createdAt
FROM members
WHERE workspaceId = '{WORKSPACE_ID}'
  AND isActive = TRUE
ORDER BY name;
```

### Ver Contas de um Workspace

```sql
SELECT id, name, balance, type, isActive, createdAt
FROM accounts
WHERE workspaceId = '{WORKSPACE_ID}'
  AND isActive = TRUE
ORDER BY name;
```

### Ver Categorias de um Workspace

```sql
SELECT id, name, type, isActive, createdAt
FROM categories
WHERE workspaceId = '{WORKSPACE_ID}'
  AND isActive = TRUE
ORDER BY type, name;
```

### Ver Transações (Exemplos)

```sql
-- Todas as transações ativas
SELECT 
  t.id,
  m.name as membro,
  c.name as categoria,
  t.value,
  t.date,
  t.isInstallment,
  t.createdAt
FROM transactions t
JOIN members m ON t.memberId = m.id
JOIN categories c ON t.categoryId = c.id
WHERE t.workspaceId = '{WORKSPACE_ID}'
  AND t.isActive = TRUE
ORDER BY t.date DESC;

-- Transações de um membro
SELECT 
  t.id,
  c.name as categoria,
  t.value,
  t.date
FROM transactions t
JOIN categories c ON t.categoryId = c.id
JOIN members m ON t.memberId = m.id
WHERE t.workspaceId = '{WORKSPACE_ID}'
  AND m.name = 'Gabriel'
  AND t.isActive = TRUE
ORDER BY t.date DESC;

-- Transações por categoria
SELECT 
  c.name as categoria,
  c.type,
  COUNT(*) as quantidade,
  SUM(t.value) as total
FROM transactions t
JOIN categories c ON t.categoryId = c.id
WHERE t.workspaceId = '{WORKSPACE_ID}'
  AND t.isActive = TRUE
GROUP BY c.id, c.name, c.type
ORDER BY total DESC;
```

### Saúde Financeira por Pessoa

```sql
-- Saldo de ENTRADA por pessoa
SELECT 
  m.name,
  SUM(t.value) as total_entrada
FROM transactions t
JOIN members m ON t.memberId = m.id
JOIN categories c ON t.categoryId = c.id
WHERE t.workspaceId = '{WORKSPACE_ID}'
  AND c.type = 'ENTRADA'
  AND t.isActive = TRUE
GROUP BY m.id, m.name
ORDER BY total_entrada DESC;

-- Saldo de SAÍDA por pessoa
SELECT 
  m.name,
  SUM(t.value) as total_saida
FROM transactions t
JOIN members m ON t.memberId = m.id
JOIN categories c ON t.categoryId = c.id
WHERE t.workspaceId = '{WORKSPACE_ID}'
  AND c.type = 'SAÍDA'
  AND t.isActive = TRUE
GROUP BY m.id, m.name
ORDER BY total_saida DESC;

-- Saldo LÍQUIDO por pessoa (AZUL ou VERMELHO)
SELECT 
  m.name,
  COALESCE(entrada.total, 0) as entradas,
  COALESCE(saida.total, 0) as saidas,
  COALESCE(entrada.total, 0) - COALESCE(saida.total, 0) as saldo_liquido,
  CASE 
    WHEN COALESCE(entrada.total, 0) - COALESCE(saida.total, 0) >= 0 THEN '✅ AZUL (Positivo)'
    ELSE '❌ VERMELHO (Negativo)'
  END as status
FROM members m
LEFT JOIN (
  SELECT memberId, SUM(value) as total 
  FROM transactions t
  JOIN categories c ON t.categoryId = c.id
  WHERE c.type = 'ENTRADA' AND t.isActive = TRUE
  GROUP BY memberId
) entrada ON m.id = entrada.memberId
LEFT JOIN (
  SELECT memberId, SUM(value) as total 
  FROM transactions t
  JOIN categories c ON t.categoryId = c.id
  WHERE c.type = 'SAÍDA' AND t.isActive = TRUE
  GROUP BY memberId
) saida ON m.id = saida.memberId
WHERE m.workspaceId = '{WORKSPACE_ID}'
  AND m.isActive = TRUE
ORDER BY saldo_liquido DESC;
```

### Histórico de Auditoria

```sql
-- Ver todas as mudanças
SELECT 
  tableName,
  action,
  changedAt,
  newValue
FROM audit_log
ORDER BY changedAt DESC
LIMIT 50;

-- Ver mudanças em uma tabela específica
SELECT 
  recordId,
  action,
  changedAt,
  oldValue,
  newValue
FROM audit_log
WHERE tableName = 'transactions'
ORDER BY changedAt DESC
LIMIT 20;

-- Ver histórico de um registro específico
SELECT 
  action,
  changedAt,
  oldValue,
  newValue
FROM audit_log
WHERE recordId = '{RECORD_ID}'
ORDER BY changedAt DESC;
```

---

## 🔧 Soft Delete (Deleções Lógicas)

### Deletar um registro (marcar como inativo)

```sql
-- Deletar transação
UPDATE transactions 
SET isActive = FALSE, updatedAt = NOW()
WHERE id = '{TRANSACTION_ID}';

-- Deletar membro
UPDATE members 
SET isActive = FALSE, updatedAt = NOW()
WHERE id = '{MEMBER_ID}';

-- Deletar conta
UPDATE accounts 
SET isActive = FALSE, updatedAt = NOW()
WHERE id = '{ACCOUNT_ID}';

-- Deletar categoria
UPDATE categories 
SET isActive = FALSE, updatedAt = NOW()
WHERE id = '{CATEGORY_ID}';
```

### Recuperar um registro deletado

```sql
-- Reativar transação
UPDATE transactions 
SET isActive = TRUE, updatedAt = NOW()
WHERE id = '{TRANSACTION_ID}' AND isActive = FALSE;

-- Reativar membro
UPDATE members 
SET isActive = TRUE, updatedAt = NOW()
WHERE id = '{MEMBER_ID}' AND isActive = FALSE;
```

### Ver registros deletados

```sql
-- Transações deletadas
SELECT * FROM transactions 
WHERE isActive = FALSE
ORDER BY updatedAt DESC;

-- Membros deletados
SELECT * FROM members 
WHERE isActive = FALSE
ORDER BY updatedAt DESC;
```

---

## 📝 Variáveis de Ambiente

Copie `.env.example` para `.env`:

```bash
cp .env.example .env
```

Conteúdo do `.env`:

```bash
# DATABASE
DB_HOST=postgres
DB_PORT=5432
DB_USER=financial_user
DB_PASSWORD=secure_password_123
DB_NAME=financial_control_db

# CLOUDBEAVER
CLOUDBEAVER_URL=http://localhost:8978
CLOUDBEAVER_EMAIL=admin@cloudbeaver.local
CLOUDBEAVER_PASSWORD=cloudbeaver_admin_123

# PGADMIN (Opcional)
PGADMIN_EMAIL=admin@financial.local
PGADMIN_PASSWORD=pgadmin_password_123

# BACKEND (Futuro)
NODE_ENV=development
PORT=3000
JWT_SECRET=sua_chave_secreta_aqui_mude_depois

# FRONTEND (Futuro)
VITE_API_URL=http://localhost:3000/api
```

---

## 🔥 Comandos Úteis

### Docker

```bash
# Subir tudo
docker-compose up -d

# Ver status
docker ps

# Ver logs
docker logs financial-control-db
docker logs financial-control-cloudbeaver

# Logs em tempo real
docker logs -f financial-control-db

# Descer tudo
docker-compose down

# Descer e remover volumes (reset completo)
docker-compose down -v

# Rebuild das imagens
docker-compose up -d --build
```

### PostgreSQL (via CLI)

```bash
# Conectar ao banco
docker exec -it financial-control-db psql -U financial_user -d financial_control_db

# Dentro do psql:
\dt                           # listar tabelas
\d {table_name}               # ver estrutura
\d+ {table_name}              # ver estrutura com detalhes
SELECT * FROM {table};        # ver dados
\q                            # sair

# Executar query diretamente
docker exec -it financial-control-db psql -U financial_user -d financial_control_db -c "SELECT * FROM users;"

# Executar arquivo SQL
docker cp script.sql financial-control-db:/tmp/script.sql
docker exec -it financial-control-db psql -U financial_user -d financial_control_db -f /tmp/script.sql
```

### Backup e Restore

```bash
# Fazer backup do banco
docker exec financial-control-db pg_dump -U financial_user financial_control_db > backup.sql

# Restaurar banco de um backup
docker exec -i financial-control-db psql -U financial_user financial_control_db < backup.sql
```

---

## 🚨 Troubleshooting

### Tabelas não foram criadas

**Sintomas:** `\dt` retorna lista vazia

**Solução:**

```bash
# 1. Verifique se schema.sql existe
ls -la database/schema.sql

# 2. Limpe volumes antigos
docker-compose down -v

# 3. Rebuild
docker-compose up -d --build

# 4. Aguarde 15 segundos
sleep 15

# 5. Verifique novamente
docker exec -it financial-control-db psql -U financial_user -d financial_control_db -c "\dt"
```

### PostgreSQL não inicia

**Sintomas:** `docker logs financial-control-db` mostra erros

**Solução:**

```bash
# 1. Verifique o Dockerfile
cat database/Dockerfile

# 2. Limpe e recrie
docker-compose down -v
docker system prune -a
docker-compose up -d --build

# 3. Acompanhe os logs
docker logs -f financial-control-db
```

### CloudBeaver não conecta ao banco

**Sintomas:** Erro de conexão ao registrar servidor

**Solução:**

```bash
# 1. Use "postgres" como host (não "localhost")
# 2. Verifique se postgres está saudável
docker logs financial-control-db

# 3. Verifique se estão na mesma rede
docker network ls
docker network inspect financial-network

# 4. Reinicie tudo
docker-compose down
docker-compose up -d
```

### Espaço em disco cheio

**Sintomas:** Docker não consegue criar volumes

**Solução:**

```bash
# Limpar imagens e volumes não utilizados
docker system prune -a --volumes

# Verificar espaço
docker system df
```

---

## 📚 Recursos e Referências

### Tecnologias

- **PostgreSQL 16:** https://www.postgresql.org/docs/16/
- **Docker:** https://docs.docker.com/
- **CloudBeaver:** https://cloudbeaver.io/
- **Node.js:** https://nodejs.org/docs/

### Padrões Usados

- **Soft Delete (Logical Delete):** Marcar registros como inativos ao invés de deletar
- **Auditoria Automática:** Triggers PostgreSQL rastreiam todas as mudanças
- **Mono-repo:** Frontend, Backend e Database em um único repositório
- **Mono-tenant:** Um único usuário controla o sistema

---

## 🎯 Próximos Passos

- [ ] Estruturar backend (Node.js com HTTP nativo)
- [ ] Criar endpoints REST (/api/users, /api/transactions, etc)
- [ ] Estruturar frontend (React com Vite)
- [ ] Implementar autenticação JWT
- [ ] Integrar backend com frontend
- [ ] Adicionar validações
- [ ] Criar testes
- [ ] Deploy (AWS, Heroku, DigitalOcean, etc)

---

## 📝 Notas Importantes

### Segurança

- ⚠️ Passwords no docker-compose.yml são APENAS para desenvolvimento
- 🔐 Em produção, use variáveis de ambiente seguras
- 🔐 Mude JWT_SECRET para uma chave forte
- 🔐 Nunca commite `.env` com dados reais

### Performance

- ✅ Índices estão criados em colunas frequentemente consultadas
- ✅ Soft delete com índice em isActive melhora performance
- ✅ Para <500 transações/mês, não há problema de escalabilidade
- ⚠️ Monitore query performance conforme dados crescem

### Backup

- 💾 Dados persistem em volume Docker `postgres_data`
- 💾 Faça backups regulares: `docker exec financial-control-db pg_dump -U financial_user financial_control_db > backup.sql`
- 💾 Armazene backups em local seguro

---

## 📞 Suporte

Para dúvidas sobre:

- **Estrutura SQL:** Veja `/database/schema.sql`
- **Docker:** Consulte a [documentação oficial](https://docs.docker.com/)
- **Queries:** Use as templates neste README
- **Erros:** Verifique os logs: `docker logs financial-control-db`

---

**Última atualização:** Agosto de 2026

**Versão:** MVP 1.0

**Status:** ✅ Banco de dados estruturado e funcionando