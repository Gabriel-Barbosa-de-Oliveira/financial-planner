import Fastify from 'fastify';

// /**
//  * Variáveis de ambiente obrigatórias
//  * Lidas através da flag --env-file=.env do Node.js
//  */
// interface EnvConfig {
//   PORT: number;
//   NODE_ENV: 'development' | 'production' | 'test';
//   DB_HOST: string;
//   DB_PORT: number;
//   DB_NAME: string;
//   DB_USER: string;
//   DB_PASSWORD: string;
// }
 
// /**
//  * Valida e retorna as variáveis de ambiente
//  * Garante que todas as variáveis obrigatórias estão presentes
//  */
// function getEnvConfig(): EnvConfig {
//   const requiredEnvVars = [
//     'PORT',
//     'NODE_ENV',
//     'DB_HOST',
//     'DB_PORT',
//     'DB_NAME',
//     'DB_USER',
//     'DB_PASSWORD',
//   ];
 
//   const missingVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);
 
//   if (missingVars.length > 0) {
//     throw new Error(
//       `Variáveis de ambiente obrigatórias ausentes: ${missingVars.join(', ')}`
//     );
//   }
 
//   return {
//     PORT: parseInt(process.env.PORT || '3000', 10),
//     NODE_ENV: (process.env.NODE_ENV as EnvConfig['NODE_ENV']) || 'development',
//     DB_HOST: process.env.DB_HOST || '',
//     DB_PORT: parseInt(process.env.DB_PORT || '5432', 10),
//     DB_NAME: process.env.DB_NAME || '',
//     DB_USER: process.env.DB_USER || '',
//     DB_PASSWORD: process.env.DB_PASSWORD || '',
//   };
// }
 
export const createServer = async () => {
    const app = Fastify();
    return app;
}

 
/**
 * Graceful shutdown - encerra o servidor de forma segura
 * Útil para finalizar conexões com o banco de dados
 */
process.on('SIGTERM', async () => {
  console.log('SIGTERM recebido, encerrando gracefully...');
  process.exit(0);
});
 
process.on('SIGINT', async () => {
  console.log('SIGINT recebido, encerrando gracefully...');
  process.exit(0);
});
 

 