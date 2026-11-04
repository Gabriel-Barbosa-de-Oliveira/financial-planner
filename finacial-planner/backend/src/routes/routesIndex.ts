import type { FastifyInstance } from 'fastify';
import { userRoutes } from './userRoutes.ts';
import type { UserRoutesOptions } from './userRoutes.ts';
import { accountRoutes } from './accountRoutes.ts';
import type { AccountRoutesOptions } from './accountRoutes.ts';
import { classificationRoutes } from './classificationRoutes.ts';
import type { ClassificationRoutesOptions } from './classificationRoutes.ts';
import { categoryRoutes } from './categoryRoutes.ts';
import type { CategoryRoutesOptions } from './categoryRoutes.ts';
// import { transactionRoutes } from './transactionRoutes.ts';

export type RoutesDependencies = {
  user: UserRoutesOptions;
  account: AccountRoutesOptions;
  classification: ClassificationRoutesOptions;
  category: CategoryRoutesOptions;
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

  // Registra as rotas de conta
  await app.register(accountRoutes, { prefix: '/accounts', ...dependencies.account });

  // Registra as rotas de classificação
  await app.register(classificationRoutes, { prefix: '/classifications', ...dependencies.classification });

  // Registra as rotas de categoria
  await app.register(categoryRoutes, { prefix: '/categories', ...dependencies.category });

//   // Registra as rotas de transações
//   await app.register(transactionRoutes, { prefix: '/transactions' });
}
