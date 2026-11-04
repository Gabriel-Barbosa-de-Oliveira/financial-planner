import { environmentConfig } from './config/env.ts';
import { securityConfig } from './config/security.ts';
import { defaultWorkspaceConfig } from './config/workspace.ts';
import { query, testConnection } from './config/database.ts';
import { createServer } from './server.ts';
import { healthController } from './controllers/healthController.ts';
import { createUserController } from './controllers/userController.ts';
import { createAccountController } from './controllers/accountController.ts';
import { createClassificationController } from './controllers/classificationController.ts';
import { createCategoryController } from './controllers/categoryController.ts';
import { registerRoutes } from './routes/routesIndex.ts';
import { createUserRepository } from './repositories/userRepository.ts';
import { createUserService } from './services/userService.ts';
import { createAccountRepository } from './repositories/accountRepository.ts';
import { createAccountService } from './services/accountService.ts';
import { createClassificationRepository } from './repositories/classificationRepository.ts';
import { createClassificationService } from './services/classificationService.ts';
import { createCategoryRepository } from './repositories/categoryRepository.ts';
import { createCategoryService } from './services/categoryService.ts';
import { createPasswordHasher } from './utils/passwordHasher.ts';


/**
 * Função principal que inicia o servidor
 */
async function start() {
  const controllersPrefix = '/financial-control';
  try {
    // Carrega configurações de ambiente
    // const config = getEnvConfig();
 
    console.log(`🚀 Iniciando servidor em ambiente ${environmentConfig.NODE_ENV}...`);
 
    // Constrói a aplicação Fastify
    const app = await createServer();

    // Falha cedo se o banco estiver indisponível
    await testConnection();

    // Registra os controllers
    await app.register(healthController, { prefix: controllersPrefix  });

    // Monta as dependências (composition root) e registra as rotas
    const userService = createUserService({
      repository: createUserRepository(query),
      hasher: createPasswordHasher(securityConfig.scrypt),
    });
    const accountService = createAccountService({
      repository: createAccountRepository(query, defaultWorkspaceConfig.name),
    });
    const classificationRepository = createClassificationRepository(query, defaultWorkspaceConfig.name);
    const classificationService = createClassificationService({ repository: classificationRepository });
    const categoryService = createCategoryService({
      repository: createCategoryRepository(query, defaultWorkspaceConfig.name),
      classificationRepository,
    });
    await app.register(
      async (instance) => registerRoutes(instance, {
        user: { controller: createUserController(userService) },
        account: { controller: createAccountController(accountService) },
        classification: { controller: createClassificationController(classificationService) },
        category: { controller: createCategoryController(categoryService) },
      }),
      { prefix: controllersPrefix },
    );

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
