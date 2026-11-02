import { describe, it, expect, jest } from '@jest/globals';
import { createUserService } from './userService.ts';
import type { UserRepository, User } from '../repositories/userRepository.ts';
import type { PasswordHasher } from '../utils/passwordHasher.ts';
import { UsedEmailError } from '../utils/errors.ts';

const user: User = {
  id: '6f1d3c1e-0c4b-4f0e-9d1a-2b7a8f3c9e10',
  email: 'ana@exemplo.com',
  isActive: true,
  createdAt: new Date('2026-11-02T10:00:00Z'),
  updatedAt: new Date('2026-11-02T10:00:00Z'),
};

function setup() {
  const repository = { create: jest.fn<UserRepository['create']>().mockResolvedValue(user) };
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
});
