import Fastify from 'fastify';
import { testConnection, closePool } from './config/database.ts';

export const createServer = async () => {
  const app = Fastify({
    logger: true
  });

  await testConnection();
  
  // Middleware: CORS (quando implementar rotas frontend)
  // app.register(require('@fastify/cors'));

  // Middleware: Validação com Zod (será usado nos controllers)
  // Registramos aqui apenas para deixar preparado

  /**
   * Health check - rota básica para verificar se o servidor está rodando
   * Útil para testes de disponibilidade e health checks
   */
  app.get('/health', async (request, reply) => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  /**
   * Rotas da aplicação (serão organizadas em módulos)
   * Por enquanto deixamos como exemplo
   */
  app.get('/', async (request, reply) => {
    return { message: 'Bem-vindo ao Planejador/Controlador Financeiro' };
  });

  // Tratamento de rotas não encontradas
  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      error: 'Not Found',
      message: `A rota ${request.url} não existe`,
      statusCode: 404,
    });
  });

  // Tratamento global de erros
  app.setErrorHandler((error, request, reply) => {
    console.error(error);

    // Se for erro de validação do Zod, retornamos 400
    if (error.name === 'ZodError') {
      return reply.status(400).send({
        error: 'Validation Error',
        message: 'Dados enviados não passaram na validação',
        statusCode: 400,
      });
    }

    // Erro genérico
    reply.status(500).send({
      error: 'Internal Server Error',
      message: 'Algo deu errado no servidor',
      statusCode: 500,
    });
  });

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
