# 💰 Financial Planner - MVP

Sistema de controle financeiro familiar com Node.js + React + PostgreSQL.

## 🚀 Quick Start

### Pré-requisitos
- Docker e Docker Compose instalados

### Subir o banco
```bash
docker-compose up -d postgres
```

### Verificar se está rodando
```bash
docker ps
docker logs financial-control-db
```

### Conectar ao banco
```bash
docker exec -it financial-control-db psql -U financial_user -d financial_control_db
```

## 📁 Estrutura

- `backend/` - API Node.js
- `frontend/` - React
- `database/` - Scripts PostgreSQL

## 📝 Variáveis de Ambiente

Copie `.env.example` para `.env` e ajuste conforme necessário.

```bash
cp .env.example .env
```

## 🛑 Parar containers

```bash
docker-compose down
```