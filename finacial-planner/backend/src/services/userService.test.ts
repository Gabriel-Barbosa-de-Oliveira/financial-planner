import { describe, it, expect, jest } from '@jest/globals';
import { createUserService } from './userService.ts';
import type { UserRepository, User } from '../repositories/userRepository.ts';
import type { PasswordHasher } from '../utils/passwordHasher.ts';
import { UsedEmailError, UserNotFoundError } from '../utils/errors.ts';

const user: User = {
  id: '6f1d3c1e-0c4b-4f0e-9d1a-2b7a8f3c9e10',
  email: 'ana@exemplo.com',
  isActive: true,
  createdAt: new Date('2026-11-02T10:00:00Z'),
  updatedAt: new Date('2026-11-02T10:00:00Z'),
};

function setup() {
  const repository = {
    create: jest.fn<UserRepository['create']>().mockResolvedValue(user),
    findAll: jest.fn<UserRepository['findAll']>().mockResolvedValue([user]),
    findById: jest.fn<UserRepository['findById']>().mockResolvedValue(user),
    update: jest.fn<UserRepository['update']>().mockResolvedValue(user),
    deactivate: jest.fn<UserRepository['deactivate']>().mockResolvedValue(true),
  };
  const hasher = { hash: jest.fn<PasswordHasher['hash']>().mockResolvedValue('scrypt$fake-hash') };
  const service = createUserService({ repository, hasher });
  return { repository, hasher, service };
}

describe('createUserService', () => {
  it('envia ao repository o hash, nunca a senha em texto puro', async () => {
    const { repository, hasher, service } = setup();

    await service.createUser({ email: 'ana@exemplo.com', password: 'senha-segura-123' });

    expect(hasher.hash).toHaveBeenCalledWith('senha-segura-123');
    expect(repository.create).toHaveBeenCalledWith({
      email: 'ana@exemplo.com',
      passwordHash: 'scrypt$fake-hash',
    });
    expect(JSON.stringify(repository.create.mock.calls)).not.toContain('senha-segura-123');
  });

  it('devolve o usuário sem campo de senha ou hash', async () => {
    const { service } = setup();

    const created = await service.createUser({ email: 'ana@exemplo.com', password: 'senha-segura-123' });

    expect(created).toEqual(user);
    expect(created).not.toHaveProperty('password');
    expect(created).not.toHaveProperty('passwordHash');
  });

  it('propaga UsedEmailError vindo do repository', async () => {
    const { repository, service } = setup();
    repository.create.mockRejectedValue(new UsedEmailError());

    await expect(
      service.createUser({ email: 'ana@exemplo.com', password: 'senha-segura-123' }),
    ).rejects.toBeInstanceOf(UsedEmailError);
  });

  describe('listUsers', () => {
    it('repassa a lista do repository, inclusive vazia', async () => {
      const { repository, service } = setup();

      await expect(service.listUsers()).resolves.toEqual([user]);

      repository.findAll.mockResolvedValue([]);
      await expect(service.listUsers()).resolves.toEqual([]);
    });
  });

  describe('getUser', () => {
    it('devolve o usuário sem campo de senha ou hash', async () => {
      const { repository, service } = setup();

      const found = await service.getUser(user.id);

      expect(repository.findById).toHaveBeenCalledWith(user.id);
      expect(found).toEqual(user);
      expect(found).not.toHaveProperty('password');
      expect(found).not.toHaveProperty('passwordHash');
    });

    it('lança UserNotFoundError quando o repository devolve null', async () => {
      const { repository, service } = setup();
      repository.findById.mockResolvedValue(null);

      await expect(service.getUser(user.id)).rejects.toBeInstanceOf(UserNotFoundError);
    });
  });

  describe('updateUser', () => {
    it('alterando só o e-mail, não usa o hasher nem envia hash', async () => {
      const { repository, hasher, service } = setup();

      await service.updateUser(user.id, { email: 'novo@exemplo.com' });

      expect(hasher.hash).not.toHaveBeenCalled();
      expect(repository.update).toHaveBeenCalledWith(user.id, { email: 'novo@exemplo.com', passwordHash: undefined });
    });

    it('alterando só a senha, envia o hash e nunca a senha em texto puro', async () => {
      const { repository, hasher, service } = setup();

      await service.updateUser(user.id, { password: 'nova-senha-123' });

      expect(hasher.hash).toHaveBeenCalledWith('nova-senha-123');
      expect(repository.update).toHaveBeenCalledWith(user.id, { email: undefined, passwordHash: 'scrypt$fake-hash' });
      expect(JSON.stringify(repository.update.mock.calls)).not.toContain('nova-senha-123');
    });

    it('alterando e-mail e senha juntos, envia os dois', async () => {
      const { repository, service } = setup();

      await service.updateUser(user.id, { email: 'novo@exemplo.com', password: 'nova-senha-123' });

      expect(repository.update).toHaveBeenCalledWith(user.id, {
        email: 'novo@exemplo.com',
        passwordHash: 'scrypt$fake-hash',
      });
    });

    it('devolve o usuário sem campo de senha ou hash', async () => {
      const { service } = setup();

      const updated = await service.updateUser(user.id, { email: 'novo@exemplo.com' });

      expect(updated).toEqual(user);
      expect(updated).not.toHaveProperty('password');
      expect(updated).not.toHaveProperty('passwordHash');
    });

    it('lança UserNotFoundError quando o repository devolve null', async () => {
      const { repository, service } = setup();
      repository.update.mockResolvedValue(null);

      await expect(service.updateUser(user.id, { email: 'novo@exemplo.com' })).rejects.toBeInstanceOf(
        UserNotFoundError,
      );
    });

    it('propaga UsedEmailError vindo do repository', async () => {
      const { repository, service } = setup();
      repository.update.mockRejectedValue(new UsedEmailError());

      await expect(service.updateUser(user.id, { email: 'outro@exemplo.com' })).rejects.toBeInstanceOf(
        UsedEmailError,
      );
    });
  });

  describe('deactivateUser', () => {
    it('desativa pelo repository e não devolve nada', async () => {
      const { repository, service } = setup();

      await expect(service.deactivateUser(user.id)).resolves.toBeUndefined();
      expect(repository.deactivate).toHaveBeenCalledWith(user.id);
    });

    it('lança UserNotFoundError quando nenhuma linha foi desativada', async () => {
      const { repository, service } = setup();
      repository.deactivate.mockResolvedValue(false);

      await expect(service.deactivateUser(user.id)).rejects.toBeInstanceOf(UserNotFoundError);
    });
  });
});
