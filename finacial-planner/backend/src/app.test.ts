import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Writable } from 'node:stream';
import { createServer } from './server.ts';
import { registerRoutes } from './routes/routesIndex.ts';
import { createUserController } from './controllers/userController.ts';
import { createUserService } from './services/userService.ts';
import { createAccountController } from './controllers/accountController.ts';
import { createAccountService } from './services/accountService.ts';
import type { Account, AccountRepository } from './repositories/accountRepository.ts';
import { createPasswordHasher } from './utils/passwordHasher.ts';
import { securityConfig } from './config/security.ts';
import { UsedAccountNameError, UsedEmailError } from './utils/errors.ts';
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

type AccountRow = Account;

function createInMemoryAccountRepository({ hasWorkspace = true }: { hasWorkspace?: boolean } = {}) {
  const rows: AccountRow[] = [];
  const sameName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  const touch = (row: AccountRow) => {
    row.updatedAt = new Date(Math.max(Date.now(), row.updatedAt.getTime() + 1));
  };
  const repository: AccountRepository = {
    async create({ name, type, balance }) {
      if (!hasWorkspace) return null;
      if (rows.some((row) => row.isActive && sameName(row.name, name))) throw new UsedAccountNameError();
      const now = new Date();
      const row: AccountRow = { id: crypto.randomUUID(), name, type, balance, isActive: true, createdAt: now, updatedAt: now };
      rows.push(row);
      return { ...row };
    },

    async findAll() {
      return rows.filter((row) => row.isActive).map((row) => ({ ...row }));
    },

    async findById(id) {
      const row = rows.find((candidate) => candidate.id === id && candidate.isActive);
      return row ? { ...row } : null;
    },

    async update(id, { name, type }) {
      const row = rows.find((candidate) => candidate.id === id && candidate.isActive);
      if (!row) return null;
      if (name !== undefined && rows.some((other) => other.id !== id && other.isActive && sameName(other.name, name))) {
        throw new UsedAccountNameError();
      }
      if (name !== undefined) row.name = name;
      if (type !== undefined) row.type = type;
      touch(row);
      return { ...row };
    },

    async deactivate(id) {
      const row = rows.find((candidate) => candidate.id === id && candidate.isActive);
      if (!row) return false;
      row.isActive = false;
      touch(row);
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
      async (instance) => registerRoutes(instance, {
        user: { controller: createUserController(service) },
        account: { controller: createAccountController(createAccountService({ repository: createInMemoryAccountRepository().repository })) },
      }),
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

describe('/financial-control/accounts (ponta a ponta, sem banco)', () => {
  let app: Awaited<ReturnType<typeof createServer>>;
  let rows: AccountRow[];
  let logs: string[];
  const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

  async function start({ hasWorkspace = true }: { hasWorkspace?: boolean } = {}) {
    const memory = createInMemoryAccountRepository({ hasWorkspace });
    rows = memory.rows;
    const stream = new Writable({
      write(chunk, _encoding, callback) {
        logs.push(chunk.toString());
        callback();
      },
    });
    const userService = createUserService({
      repository: createInMemoryRepository().repository,
      hasher: createPasswordHasher(securityConfig.scrypt),
    });
    app = await createServer({ level: 'trace', stream });
    await app.register(
      async (instance) => registerRoutes(instance, {
        user: { controller: createUserController(userService) },
        account: { controller: createAccountController(createAccountService({ repository: memory.repository })) },
      }),
      { prefix: '/financial-control' },
    );
    await app.ready();
  }

  beforeEach(async () => {
    logs = [];
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await start();
  });

  afterEach(async () => {
    await app.close();
    jest.restoreAllMocks();
  });

  const post = (payload: object) => app.inject({ method: 'POST', url: '/financial-control/accounts', payload });
  const get = (path: string) => app.inject({ method: 'GET', url: `/financial-control/accounts${path}` });
  const patch = (id: string, payload: object) =>
    app.inject({ method: 'PATCH', url: `/financial-control/accounts/${id}`, payload });
  const remove = (id: string) => app.inject({ method: 'DELETE', url: `/financial-control/accounts/${id}` });
  const createAccount = async (name: string, extra: object = {}) =>
    (await post({ name, type: 'BANK', ...extra })).json();

  describe('cadastro', () => {
    it('cria ativa, com nome aparado e saldo como texto, sem expor o workspace', async () => {
      const response = await post({ name: '  Nubank ', type: 'BANK', balance: '1500.00' });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({ name: 'Nubank', type: 'BANK', balance: '1500.00', isActive: true });
      expect(response.json()).not.toHaveProperty('workspaceId');
      expect(response.json()).not.toHaveProperty('workspaceid');
    });

    it('usa saldo 0.00 quando não informado e aceita saldo negativo', async () => {
      expect((await createAccount('Carteira')).balance).toBe('0.00');
      expect((await createAccount('Cartão', { balance: '-250.50' })).balance).toBe('-250.50');
    });

    it('mantém o saldo como texto exato, sem arredondar', async () => {
      expect((await createAccount('Poupança', { type: 'SAVINGS', balance: '0.10' })).balance).toBe('0.10');
    });

    it('recusa nome repetido em outra caixa com 409', async () => {
      await createAccount('Nubank');

      const repeated = await post({ name: ' nubank ', type: 'CASH' });

      expect(repeated.statusCode).toBe(409);
      expect(repeated.json().message).toBe('Já existe uma conta com este nome');
      expect(rows).toHaveLength(1);
    });

    it('recusa entradas inválidas com 400 e issues por campo, sem gravar', async () => {
      const invalid = await post({ name: '', type: 'XYZ', balance: '1.234' });

      expect(invalid.statusCode).toBe(400);
      expect(invalid.json().issues.map((issue: { field: string }) => issue.field).sort()).toEqual([
        'balance',
        'name',
        'type',
      ]);
      expect((await post({ name: 'A', type: 'CASH', balance: 10 })).statusCode).toBe(400);
      expect((await post({ name: 'a'.repeat(101), type: 'CASH' })).statusCode).toBe(400);
      expect(rows).toHaveLength(0);
    });

    it('recusa campos proibidos', async () => {
      for (const extra of [{ id: UNKNOWN_ID }, { workspaceId: UNKNOWN_ID }, { isActive: false }, { createdAt: 'x' }]) {
        expect((await post({ name: 'A', type: 'CASH', ...extra })).statusCode).toBe(400);
      }
      expect(rows).toHaveLength(0);
    });

    it('responde 422 quando o workspace padrão não existe, sem gravar', async () => {
      await app.close();
      await start({ hasWorkspace: false });

      const response = await post({ name: 'Nubank', type: 'BANK' });

      expect(response.statusCode).toBe(422);
      expect(response.json().message).toBe('Workspace padrão não encontrado');
      expect(rows).toHaveLength(0);
    });
  });

  describe('consulta', () => {
    it('lista vazia no início e depois só as ativas, em ordem de criação', async () => {
      expect((await get('')).json()).toEqual([]);

      await createAccount('Santander');
      await createAccount('Nubank');
      await createAccount('Carteira');
      rows[1].isActive = false;

      const list = await get('');

      expect(list.statusCode).toBe(200);
      expect(list.json().map((account: { name: string }) => account.name)).toEqual(['Santander', 'Carteira']);
    });

    it('consulta por id: 200, 404 (desconhecido e desativado) e 400 (id inválido)', async () => {
      const { id } = await createAccount('Nubank', { balance: '10.00' });

      const found = await get(`/${id}`);
      expect(found.statusCode).toBe(200);
      expect(found.json()).toMatchObject({ id, name: 'Nubank', balance: '10.00' });

      expect((await get(`/${UNKNOWN_ID}`)).statusCode).toBe(404);
      const invalid = await get('/abc');
      expect(invalid.statusCode).toBe(400);
      expect(invalid.json().issues[0].message).toBe('Identificador inválido');

      rows[0].isActive = false;
      const deactivated = await get(`/${id}`);
      expect(deactivated.statusCode).toBe(404);
      expect(deactivated.json().message).toBe('Conta não encontrada');
    });
  });

  describe('alteração', () => {
    it('renomeia e muda o tipo mantendo id e saldo e renovando updatedAt', async () => {
      const created = await createAccount('Santander', { balance: '300.00' });

      const renamed = await patch(created.id, { name: '  Santander Corrente ' });
      expect(renamed.statusCode).toBe(200);
      expect(renamed.json()).toMatchObject({ id: created.id, name: 'Santander Corrente', balance: '300.00' });
      expect(new Date(renamed.json().updatedAt).getTime()).toBeGreaterThan(new Date(created.updatedAt).getTime());
      expect(renamed.json().createdAt).toBe(created.createdAt);

      const retyped = await patch(created.id, { type: 'SAVINGS' });
      expect(retyped.json()).toMatchObject({ type: 'SAVINGS', name: 'Santander Corrente', balance: '300.00' });

      const both = await patch(created.id, { name: 'Poupança', type: 'INVESTMENT' });
      expect(both.json()).toMatchObject({ name: 'Poupança', type: 'INVESTMENT' });
    });

    it('recusa com 409 o nome de outra conta ativa e não altera nada', async () => {
      const santander = await createAccount('Santander');
      await createAccount('Nubank');

      const response = await patch(santander.id, { name: 'NUBANK' });

      expect(response.statusCode).toBe(409);
      expect(response.json().message).toBe('Já existe uma conta com este nome');
      expect(rows[0].name).toBe('Santander');
    });

    it('aceita o próprio nome em outra caixa e o nome de uma conta desativada', async () => {
      const santander = await createAccount('Santander');
      const nubank = await createAccount('Nubank');

      expect((await patch(santander.id, { name: 'SANTANDER' })).statusCode).toBe(200);

      rows[1].isActive = false;
      const reuse = await patch(santander.id, { name: nubank.name });
      expect(reuse.statusCode).toBe(200);
      expect(reuse.json().name).toBe('Nubank');
    });

    it('recusa corpo vazio, balance e campos proibidos com 400, sem alterar o saldo', async () => {
      const created = await createAccount('Nubank', { balance: '500.00' });

      expect((await patch(created.id, {})).statusCode).toBe(400);
      expect((await patch(created.id, { balance: '10.00' })).statusCode).toBe(400);
      expect((await patch(created.id, { name: 'X', balance: '10.00' })).statusCode).toBe(400);
      expect((await patch(created.id, { isActive: false })).statusCode).toBe(400);
      expect((await patch(created.id, { type: 'XYZ' })).statusCode).toBe(400);
      expect(rows[0]).toMatchObject({ name: 'Nubank', balance: '500.00', isActive: true });
    });

    it('responde 404 para desconhecida ou desativada e 400 para id inválido', async () => {
      const created = await createAccount('Nubank');

      expect((await patch(UNKNOWN_ID, { name: 'X' })).statusCode).toBe(404);
      expect((await patch('abc', { name: 'X' })).statusCode).toBe(400);

      rows[0].isActive = false;
      expect((await patch(created.id, { name: 'X' })).statusCode).toBe(404);
    });
  });

  describe('desativação', () => {
    it('desativa com 204, trata como inexistente e não apaga o registro', async () => {
      const santander = await createAccount('Santander');
      const nubank = await createAccount('Nubank');
      const before = rows[0].updatedAt.getTime();

      const response = await remove(santander.id);

      expect(response.statusCode).toBe(204);
      expect(response.body).toBe('');
      expect((await get(`/${santander.id}`)).statusCode).toBe(404);
      expect((await patch(santander.id, { name: 'X' })).statusCode).toBe(404);
      expect((await remove(santander.id)).statusCode).toBe(404);
      expect((await get('')).json().map((account: { id: string }) => account.id)).toEqual([nubank.id]);

      expect(rows).toHaveLength(2);
      expect(rows[0]).toMatchObject({ id: santander.id, isActive: false });
      expect(rows[0].updatedAt.getTime()).toBeGreaterThan(before);
      expect(rows[1]).toMatchObject({ id: nubank.id, isActive: true });
    });

    it('permite cadastrar de novo o nome da conta desativada, com outro id', async () => {
      const old = await createAccount('Nubank');
      await remove(old.id);

      const again = await post({ name: 'nubank', type: 'BANK' });

      expect(again.statusCode).toBe(201);
      expect(again.json().id).not.toBe(old.id);
      expect(rows).toHaveLength(2);
    });

    it('responde 400 para id inválido e 404 para desconhecido', async () => {
      expect((await remove('abc')).statusCode).toBe(400);
      expect((await remove(UNKNOWN_ID)).statusCode).toBe(404);
    });
  });

  it('responde 500 genérico, sem detalhes internos, em erro inesperado', async () => {
    await app.close();
    const failing: AccountRepository = {
      create: async () => { throw new Error('connection refused to 10.0.0.1'); },
      findAll: async () => { throw new Error('connection refused to 10.0.0.1'); },
      findById: async () => { throw new Error('connection refused to 10.0.0.1'); },
      update: async () => { throw new Error('connection refused to 10.0.0.1'); },
      deactivate: async () => { throw new Error('connection refused to 10.0.0.1'); },
    };
    app = await createServer(false);
    await app.register(
      async (instance) => registerRoutes(instance, {
        user: { controller: createUserController(createUserService({
          repository: createInMemoryRepository().repository,
          hasher: createPasswordHasher(securityConfig.scrypt),
        })) },
        account: { controller: createAccountController(createAccountService({ repository: failing })) },
      }),
      { prefix: '/financial-control' },
    );
    await app.ready();

    const responses = [await post({ name: 'A', type: 'CASH' }), await get(''), await get(`/${UNKNOWN_ID}`)];

    responses.forEach((response) => {
      expect(response.statusCode).toBe(500);
      expect(response.body).not.toContain('10.0.0.1');
    });
  });
});
