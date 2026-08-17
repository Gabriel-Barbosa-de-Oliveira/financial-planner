import Fastify from 'fastify';
import { testConnection, closePool } from './config/database.ts';

export const createServer = async () => {
    const app = Fastify();

    await testConnection();

    return app;
}

/**
 * Graceful shutdown - encerra o servidor de forma segura
 * Útil para finalizar conexões com o banco de dados
 */
process.on('SIGTERM', async () => {
  console.log('SIGTERM recebido, encerrando gracefully...');
  await closePool();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT recebido, encerrando gracefully...');
  await closePool();
  process.exit(0);
});
