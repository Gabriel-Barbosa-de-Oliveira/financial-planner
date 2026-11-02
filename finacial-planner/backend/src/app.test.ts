import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Writable } from 'node:stream';
import { createServer } from './server.ts';
import { registerRoutes } from './routes/routesIndex.ts';
import { createUserController } from './controllers/userController.ts';
import { createUserService } from './services/userService.ts';
import { createPasswordHasher } from './utils/passwordHasher.ts';
import { securityConfig } from './config/security.ts';
import { UsedEmailError } from './utils/errors.ts';
import type { User, UserRepository } from './repositories/userRepository.ts';

const PASSWORD = 'senha-segura-123';

function createInMemoryRepository() {
  const rows: Array<User & { passwordHash: string }> = [];
  const repository: UserRepository = {
    async create({ email, passwordHash }) {
      if (rows.some((row) => row.email === email && row.isActive)) throw new UsedEmailError();
      const now = new Date();
      const row = { id: crypto.randomUUID(), email, isActive: true, createdAt: now, updatedAt: now, passwordHash };
      rows.push(row);
      const { passwordHash: _omitted, ...user } = row;
      return user;
    },
  };
  return { repository, rows };
}

describe('POST /financial-control/users (ponta a ponta, sem banco)', () => {
  let app: Awaited<ReturnType<typeof createServer>>;
  let rows: ReturnType<typeof createInMemoryRepository>['rows'];
  let logs: string[];
  let consoleOutput: string[];

  beforeEach(async () => {
    logs = [];
    consoleOutput = [];
    const capture = (target: string[]) => (...args: unknown[]) => {
      target.push(args.map((arg) => (arg instanceof Error ? `${arg.message}\n${arg.stack}` : String(arg))).join(' '));
    };
    jest.spyOn(console, 'error').mockImplementation(capture(consoleOutput));
    jest.spyOn(console, 'log').mockImplementation(capture(consoleOutput));

    const stream = new Writable({
      write(chunk, _encoding, callback) {
        logs.push(chunk.toString());
        callback();
      },
    });
    const memory = createInMemoryRepository();
    rows = memory.rows;
    const service = createUserService({
      repository: memory.repository,
      hasher: createPasswordHasher(securityConfig.scrypt),
    });

    app = await createServer({ level: 'trace', stream });
    await app.register(
      async (instance) => registerRoutes(instance, { user: { createUser: createUserController(service) } }),
      { prefix: '/financial-control' },
    );
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    jest.restoreAllMocks();
  });

  const post = (payload: object) =>
    app.inject({ method: 'POST', url: '/financial-control/users', payload });

  it('cadastra, rejeita e-mail repetido e recusa dados inválidos', async () => {
    const created = await post({ email: ' Ana@Exemplo.com', password: PASSWORD });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ email: 'ana@exemplo.com', isActive: true });

    const repeated = await post({ email: 'ANA@exemplo.com ', password: PASSWORD });
    expect(repeated.statusCode).toBe(409);
    expect(repeated.json().message).toBe('E-mail já está em uso');

    const invalid = await post({ email: 'invalido', password: '123' });
    expect(invalid.statusCode).toBe(400);
    expect(rows).toHaveLength(1);
  });

  it('guarda apenas o hash, nunca a senha em texto puro', async () => {
    await post({ email: 'ana@exemplo.com', password: PASSWORD });

    expect(rows[0].passwordHash).toMatch(/^scrypt\$/);
    expect(rows[0].passwordHash).not.toContain(PASSWORD);
  });

  it('nunca expõe a senha nem o hash em respostas, logs do servidor ou console', async () => {
    const responses = [
      await post({ email: 'ana@exemplo.com', password: PASSWORD }),
      await post({ email: 'ana@exemplo.com', password: PASSWORD }),
      await post({ email: 'invalido', password: PASSWORD }),
      await post({ email: 'bia@exemplo.com', password: PASSWORD, isActive: false }),
    ];
    const everything = [...responses.map((response) => response.body), ...logs, ...consoleOutput].join('\n');

    expect(logs.length).toBeGreaterThan(0);
    expect(everything).not.toContain(PASSWORD);
    expect(everything).not.toContain(rows[0].passwordHash);
    expect(everything).not.toContain('password_hash');
  });
});
