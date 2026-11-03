import type { FastifyInstance } from 'fastify';
import { userRoutes } from './userRoutes.ts';
import type { UserRoutesOptions } from './userRoutes.ts';
// import { categoryRoutes } from './categoryRoutes.ts';
// import { transactionRoutes } from './transactionRoutes.ts';

export type RoutesDependencies = {
  user: UserRoutesOptions;
};

/**
 * Registra todas as rotas da aplicação
 *
 * Neste arquivo centralizamos o registro de rotas.
 * Cada rota é um arquivo separado que importamos aqui.
 */
export async function registerRoutes(app: FastifyInstance, dependencies: RoutesDependencies) {
  // Registra as rotas de usuário
  await app.register(userRoutes, { prefix: '/users', ...dependencies.user });

//   // Registra as rotas de categoria
//   await app.register(categoryRoutes, { prefix: '/categories' });

//   // Registra as rotas de transações
//   await app.register(transactionRoutes, { prefix: '/transactions' });
}
