import { environmentConfig } from './config/env.ts';
import { createServer } from './server.ts';


/**
 * Função principal que inicia o servidor
 */
async function start() {
  try {
    // Carrega configurações de ambiente
    // const config = getEnvConfig();
 
    console.log(`🚀 Iniciando servidor em ambiente ${environmentConfig.NODE_ENV}...`);
 
    // Constrói a aplicação Fastify
    const app = await createServer();
 
    // Inicia o servidor
    app.listen({ port: environmentConfig.PORT, host: '0.0.0.0' });
 
    console.log(`✅ Servidor rodando em http://localhost:${environmentConfig.PORT}`);
    // console.log(`📦 Banco de dados: ${config.DB_HOST}:${config.DB_PORT}/${config.DB_NAME}`);
  } catch (error) {
    console.error('❌ Erro ao iniciar servidor:', error);
    process.exit(1);
  }
}

start();
