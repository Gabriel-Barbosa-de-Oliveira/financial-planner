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
  const publicUser = ({ passwordHash: _omitted, ...user }: User & { passwordHash: string }): User => user;
  const repository: UserRepository = {
    async create({ email, passwordHash }) {
      if (rows.some((row) => row.email === email && row.isActive)) throw new UsedEmailError();
      const now = new Date();
      const row = { id: crypto.randomUUID(), email, isActive: true, createdAt: now, updatedAt: now, passwordHash };
      rows.push(row);
      return publicUser(row);
    },

    async findAll() {
      return rows.filter((row) => row.isActive).map(publicUser);
    },

    async findById(id) {
      const row = rows.find((candidate) => candidate.id === id && candidate.isActive);
      return row ? publicUser(row) : null;
    },

    async update(id, { email, passwordHash }) {
      const row = rows.find((candidate) => candidate.id === id && candidate.isActive);
      if (!row) return null;
      if (email !== undefined && rows.some((other) => other.id !== id && other.isActive && other.email === email)) {
        throw new UsedEmailError();
      }
      if (email !== undefined) row.email = email;
      if (passwordHash !== undefined) row.passwordHash = passwordHash;
      row.updatedAt = new Date(Math.max(Date.now(), row.updatedAt.getTime() + 1));
      return publicUser(row);
    },

    async deactivate(id) {
      const row = rows.find((candidate) => candidate.id === id && candidate.isActive);
      if (!row) return false;
      row.isActive = false;
      row.updatedAt = new Date(Math.max(Date.now(), row.updatedAt.getTime() + 1));
      return true;
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
      async (instance) => registerRoutes(instance, { user: { controller: createUserController(service) } }),
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

  const get = (path: string) => app.inject({ method: 'GET', url: `/financial-control${path}` });
  const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

  describe('consulta', () => {
    it('lista vazia no início e depois só os ativos, em ordem de criação', async () => {
      expect((await get('/users')).json()).toEqual([]);

      await post({ email: 'ana@exemplo.com', password: PASSWORD });
      await post({ email: 'bia@exemplo.com', password: PASSWORD });
      await post({ email: 'caio@exemplo.com', password: PASSWORD });
      rows[1].isActive = false;

      const list = await get('/users');

      expect(list.statusCode).toBe(200);
      expect(list.json().map((user: { email: string }) => user.email)).toEqual(['ana@exemplo.com', 'caio@exemplo.com']);
    });

    it('consulta por id: 200 para ativo, 404 para desconhecido e desativado, 400 para id inválido', async () => {
      const { id } = (await post({ email: 'ana@exemplo.com', password: PASSWORD })).json();

      const found = await get(`/users/${id}`);
      expect(found.statusCode).toBe(200);
      expect(found.json()).toMatchObject({ id, email: 'ana@exemplo.com', isActive: true });

      expect((await get(`/users/${UNKNOWN_ID}`)).statusCode).toBe(404);
      expect((await get('/users/abc')).statusCode).toBe(400);

      rows[0].isActive = false;
      const deactivated = await get(`/users/${id}`);
      expect(deactivated.statusCode).toBe(404);
      expect(deactivated.json().message).toBe('Usuário não encontrado');
    });
  });

  describe('alteração', () => {
    const patch = (id: string, payload: object) =>
      app.inject({ method: 'PATCH', url: `/financial-control/users/${id}`, payload });

    const createUser = async (email: string) => (await post({ email, password: PASSWORD })).json();

    it('altera o e-mail (normalizado), mantém o id e renova updatedAt', async () => {
      const created = await createUser('ana@exemplo.com');

      const response = await patch(created.id, { email: '  Novo@Exemplo.com ' });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ id: created.id, email: 'novo@exemplo.com', isActive: true });
      expect(new Date(response.json().updatedAt).getTime()).toBeGreaterThan(new Date(created.updatedAt).getTime());
      expect(response.json().createdAt).toBe(created.createdAt);
    });

    it('altera a senha guardando apenas o novo hash', async () => {
      const created = await createUser('ana@exemplo.com');
      const oldHash = rows[0].passwordHash;

      const response = await patch(created.id, { password: 'nova-senha-123' });

      expect(response.statusCode).toBe(200);
      expect(rows[0].passwordHash).toMatch(/^scrypt\$/);
      expect(rows[0].passwordHash).not.toBe(oldHash);
      expect(rows[0].passwordHash).not.toContain('nova-senha-123');
      expect(response.body).not.toContain('nova-senha-123');
    });

    it('altera e-mail e senha juntos', async () => {
      const created = await createUser('ana@exemplo.com');
      const oldHash = rows[0].passwordHash;

      const response = await patch(created.id, { email: 'novo@exemplo.com', password: 'nova-senha-123' });

      expect(response.statusCode).toBe(200);
      expect(response.json().email).toBe('novo@exemplo.com');
      expect(rows[0].passwordHash).not.toBe(oldHash);
    });

    it('recusa com 409 o e-mail de outro usuário ativo e não altera nada', async () => {
      const ana = await createUser('ana@exemplo.com');
      await createUser('bia@exemplo.com');

      const response = await patch(ana.id, { email: 'BIA@exemplo.com' });

      expect(response.statusCode).toBe(409);
      expect(response.json().message).toBe('E-mail já está em uso');
      expect(rows[0].email).toBe('ana@exemplo.com');
    });

    it('aceita o próprio e-mail em outra caixa', async () => {
      const ana = await createUser('ana@exemplo.com');

      const response = await patch(ana.id, { email: 'ANA@Exemplo.com' });

      expect(response.statusCode).toBe(200);
      expect(response.json().email).toBe('ana@exemplo.com');
    });

    it('aceita o e-mail de um usuário desativado', async () => {
      const ana = await createUser('ana@exemplo.com');
      const bia = await createUser('bia@exemplo.com');
      rows[1].isActive = false;

      const response = await patch(ana.id, { email: bia.email });

      expect(response.statusCode).toBe(200);
      expect(response.json().email).toBe('bia@exemplo.com');
    });

    it('recusa corpo vazio e campos proibidos com 400', async () => {
      const ana = await createUser('ana@exemplo.com');

      expect((await patch(ana.id, {})).statusCode).toBe(400);
      expect((await patch(ana.id, { isActive: false })).statusCode).toBe(400);
      expect((await patch(ana.id, { email: 'novo@exemplo.com', id: UNKNOWN_ID })).statusCode).toBe(400);
      expect(rows[0].email).toBe('ana@exemplo.com');
      expect(rows[0].isActive).toBe(true);
    });

    it('responde 404 para id desconhecido ou de usuário desativado e 400 para id inválido', async () => {
      const ana = await createUser('ana@exemplo.com');

      expect((await patch(UNKNOWN_ID, { email: 'novo@exemplo.com' })).statusCode).toBe(404);
      expect((await patch('abc', { email: 'novo@exemplo.com' })).statusCode).toBe(400);

      rows[0].isActive = false;
      expect((await patch(ana.id, { email: 'novo@exemplo.com' })).statusCode).toBe(404);
    });
  });

  describe('desativação', () => {
    const remove = (id: string) => app.inject({ method: 'DELETE', url: `/financial-control/users/${id}` });
    const patch = (id: string, payload: object) =>
      app.inject({ method: 'PATCH', url: `/financial-control/users/${id}`, payload });
    const createUser = async (email: string) => (await post({ email, password: PASSWORD })).json();

    it('desativa com 204 e passa a tratar o usuário como inexistente, sem apagar o registro', async () => {
      const ana = await createUser('ana@exemplo.com');
      const bia = await createUser('bia@exemplo.com');

      const response = await remove(ana.id);

      expect(response.statusCode).toBe(204);
      expect(response.body).toBe('');
      expect((await get(`/users/${ana.id}`)).statusCode).toBe(404);
      expect((await patch(ana.id, { email: 'novo@exemplo.com' })).statusCode).toBe(404);
      expect((await remove(ana.id)).statusCode).toBe(404);
      expect((await get('/users')).json().map((user: { id: string }) => user.id)).toEqual([bia.id]);

      expect(rows).toHaveLength(2);
      expect(rows[0]).toMatchObject({ id: ana.id, isActive: false });
      expect(rows[1]).toMatchObject({ id: bia.id, isActive: true });
    });

    it('renova updatedAt na desativação', async () => {
      const ana = await createUser('ana@exemplo.com');
      const before = rows[0].updatedAt.getTime();

      await remove(ana.id);

      expect(rows[0].updatedAt.getTime()).toBeGreaterThan(before);
    });

    it('permite cadastrar de novo o e-mail do usuário desativado, com outro id', async () => {
      const ana = await createUser('ana@exemplo.com');
      await remove(ana.id);

      const again = await post({ email: 'ana@exemplo.com', password: PASSWORD });

      expect(again.statusCode).toBe(201);
      expect(again.json().id).not.toBe(ana.id);
      expect(rows).toHaveLength(2);
    });

    it('responde 400 para id inválido e 404 para id desconhecido', async () => {
      expect((await remove('abc')).statusCode).toBe(400);
      expect((await remove(UNKNOWN_ID)).statusCode).toBe(404);
    });
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
      await get('/users'),
      await get(`/users/${rows[0].id}`),
      await get('/users/abc'),
      await get(`/users/${UNKNOWN_ID}`),
      await app.inject({
        method: 'PATCH',
        url: `/financial-control/users/${rows[0].id}`,
        payload: { email: 'ana2@exemplo.com', password: 'outra-senha-123' },
      }),
      await app.inject({
        method: 'PATCH',
        url: `/financial-control/users/${rows[0].id}`,
        payload: { password: '123' },
      }),
      await app.inject({ method: 'DELETE', url: `/financial-control/users/${rows[0].id}` }),
      await app.inject({ method: 'DELETE', url: `/financial-control/users/${rows[0].id}` }),
    ];
    const everything = [...responses.map((response) => response.body), ...logs, ...consoleOutput].join('\n');

    expect(logs.length).toBeGreaterThan(0);
    expect(everything).not.toContain(PASSWORD);
    expect(everything).not.toContain('outra-senha-123');
    expect(everything).not.toContain(rows[0].passwordHash);
    expect(everything).not.toContain('password_hash');
  });
});
