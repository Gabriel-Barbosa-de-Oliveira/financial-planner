-- ============================================
-- CONTROLE FINANCEIRO MVP - SCRIPT DE CRIAÇÃO
-- Database: PostgreSQL 12+
-- ============================================

-- 1. Extensão para UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABELA 1: USERS
-- ============================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  isActive BOOLEAN DEFAULT TRUE,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_isActive ON users(isActive);

-- ============================================
-- TABELA 2: WORKSPACES
-- ============================================
CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  userId UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  currency VARCHAR(3) DEFAULT 'BRL',
  isActive BOOLEAN DEFAULT TRUE,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_workspaces_userId ON workspaces(userId);
CREATE INDEX idx_workspaces_isActive ON workspaces(isActive);

-- ============================================
-- TABELA 3: MEMBERS
-- ============================================
CREATE TABLE members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspaceId UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  isActive BOOLEAN DEFAULT TRUE,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_members_workspaceId ON members(workspaceId);
CREATE INDEX idx_members_isActive ON members(isActive);
CREATE UNIQUE INDEX idx_members_unique_per_workspace 
  ON members(workspaceId, name) WHERE isActive = TRUE;

-- ============================================
-- TABELA 4: ACCOUNTS
-- ============================================
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspaceId UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  balance DECIMAL(12, 2) DEFAULT 0.00,
  type VARCHAR(50) NOT NULL, -- BANK, INVESTMENT, CASH, SAVINGS
  isActive BOOLEAN DEFAULT TRUE,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_accounts_workspaceId ON accounts(workspaceId);
CREATE INDEX idx_accounts_type ON accounts(type);
CREATE INDEX idx_accounts_isActive ON accounts(isActive);

-- ============================================
-- TABELA 5: CATEGORIES
-- ============================================
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspaceId UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL, -- ENTRADA ou SAÍDA
  isActive BOOLEAN DEFAULT TRUE,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_categories_workspaceId ON categories(workspaceId);
CREATE INDEX idx_categories_type ON categories(type);
CREATE INDEX idx_categories_isActive ON categories(isActive);
CREATE UNIQUE INDEX idx_categories_unique_per_workspace 
  ON categories(workspaceId, name, type) WHERE isActive = TRUE;

-- ============================================
-- TABELA 6: TRANSACTIONS
-- ============================================
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspaceId UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  memberId UUID NOT NULL REFERENCES members(id),
  categoryId UUID NOT NULL REFERENCES categories(id),
  fromAccountId UUID REFERENCES accounts(id),
  toAccountId UUID REFERENCES accounts(id),
  value DECIMAL(12, 2) NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  isInstallment BOOLEAN DEFAULT FALSE,
  installmentCount INT DEFAULT 1,
  isActive BOOLEAN DEFAULT TRUE,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_transactions_workspaceId ON transactions(workspaceId);
CREATE INDEX idx_transactions_memberId ON transactions(memberId);
CREATE INDEX idx_transactions_categoryId ON transactions(categoryId);
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_fromAccountId ON transactions(fromAccountId);
CREATE INDEX idx_transactions_toAccountId ON transactions(toAccountId);
CREATE INDEX idx_transactions_isActive ON transactions(isActive);
CREATE INDEX idx_transactions_isInstallment ON transactions(isInstallment);

-- ============================================
-- TABELA 7: INSTALLMENTS
-- ============================================
CREATE TABLE installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transactionId UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  installmentNumber INT NOT NULL,
  dueDate DATE NOT NULL,
  value DECIMAL(12, 2) NOT NULL,
  paid BOOLEAN DEFAULT FALSE,
  paidAt TIMESTAMP NULL,
  isActive BOOLEAN DEFAULT TRUE,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_installments_transactionId ON installments(transactionId);
CREATE INDEX idx_installments_dueDate ON installments(dueDate);
CREATE INDEX idx_installments_paid ON installments(paid);
CREATE INDEX idx_installments_isActive ON installments(isActive);
CREATE UNIQUE INDEX idx_installments_unique_per_transaction 
  ON installments(transactionId, installmentNumber) WHERE isActive = TRUE;

-- ============================================
-- TABELA 8: AUDIT_LOG (Histórico de mudanças)
-- ============================================
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tableName VARCHAR(100) NOT NULL,
  recordId UUID NOT NULL,
  action VARCHAR(20) NOT NULL, -- CREATE, UPDATE, DELETE
  oldValue JSONB,
  newValue JSONB,
  changedAt TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_log_tableName ON audit_log(tableName);
CREATE INDEX idx_audit_log_recordId ON audit_log(recordId);
CREATE INDEX idx_audit_log_changedAt ON audit_log(changedAt);

-- ============================================
-- CONSTRAINTS E VALIDAÇÕES
-- ============================================

-- Transactions: value sempre positivo
ALTER TABLE transactions 
  ADD CONSTRAINT check_positive_value CHECK (value > 0);

-- Transactions: date não pode ser no futuro
ALTER TABLE transactions 
  ADD CONSTRAINT check_date_not_future CHECK (date <= CURRENT_DATE);

-- Installments: value sempre positivo
ALTER TABLE installments 
  ADD CONSTRAINT check_installment_positive_value CHECK (value > 0);

-- Installments: dueDate não pode ser no passado
ALTER TABLE installments 
  ADD CONSTRAINT check_installment_date_not_past CHECK (dueDate >= CURRENT_DATE);

-- ============================================
-- FUNÇÃO DE AUDITORIA (Básica)
-- ============================================

CREATE OR REPLACE FUNCTION fn_audit_log()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (tableName, recordId, action, newValue)
    VALUES (TG_TABLE_NAME, NEW.id, 'CREATE', to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log (tableName, recordId, action, oldValue, newValue)
    VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW));
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log (tableName, recordId, action, oldValue)
    VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', to_jsonb(OLD));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGERS DE AUDITORIA
-- ============================================

CREATE TRIGGER trg_audit_users
AFTER INSERT OR UPDATE OR DELETE ON users
FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE TRIGGER trg_audit_workspaces
AFTER INSERT OR UPDATE OR DELETE ON workspaces
FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE TRIGGER trg_audit_members
AFTER INSERT OR UPDATE OR DELETE ON members
FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE TRIGGER trg_audit_accounts
AFTER INSERT OR UPDATE OR DELETE ON accounts
FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE TRIGGER trg_audit_categories
AFTER INSERT OR UPDATE OR DELETE ON categories
FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE TRIGGER trg_audit_transactions
AFTER INSERT OR UPDATE OR DELETE ON transactions
FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE TRIGGER trg_audit_installments
AFTER INSERT OR UPDATE OR DELETE ON installments
FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- ============================================
-- COMENTÁRIOS DESCRITIVOS
-- ============================================

COMMENT ON TABLE users IS 'Usuários do sistema (mono-tenant)';
COMMENT ON TABLE workspaces IS 'Espaços de controle financeiro (familiar)';
COMMENT ON TABLE members IS 'Pessoas que fazem lançamentos no workspace';
COMMENT ON TABLE accounts IS 'Contas onde dinheiro é armazenado (banco, investimento, carteira)';
COMMENT ON TABLE categories IS 'Categorias de ENTRADA ou SAÍDA';
COMMENT ON TABLE transactions IS 'Transações financeiras (movimentação de dinheiro)';
COMMENT ON TABLE installments IS 'Parcelas de transações parceladas';
COMMENT ON TABLE audit_log IS 'Histórico de todas as mudanças no banco';

-- ============================================
-- FIM DO SCRIPT
-- ============================================