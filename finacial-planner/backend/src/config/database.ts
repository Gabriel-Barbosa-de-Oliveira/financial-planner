import pg from 'pg';
import type { QueryResult, QueryResultRow } from 'pg';
import { environmentConfig } from './env.ts';

// Pool de conexões (reutiliza conexões)
export const pool = new pg.Pool({
  host: environmentConfig.DB_HOST,
  port: environmentConfig.DB_PORT,
  user: environmentConfig.DB_USER,
  password: environmentConfig.DB_PASSWORD,
  database: environmentConfig.DB_NAME,
  max: 20,           // Máximo de conexões
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Eventos do pool
pool.on('error', (err) => {
  console.error('Pool erro:', err);
});

pool.on('connect', () => {
  console.log('✅ Novo cliente conectado ao pool');
});

// Testar conexão ao iniciar
export async function testConnection(): Promise<boolean> {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('✅ Banco de dados conectado:', result.rows[0].now);
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('❌ Erro ao conectar ao banco:', message);
    throw err;
  }
}

// Função auxiliar para queries
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<QueryResult<T>> {
  try {
    const result = await pool.query<T>(text, params);
    return result;
  } catch (err) {
    console.error('Query erro:', err);
    throw err;
  }
}

// Fechar pool (usar em shutdown)
export async function closePool(): Promise<void> {
  await pool.end();
  console.log('Pool fechado');
}

export default pool;
