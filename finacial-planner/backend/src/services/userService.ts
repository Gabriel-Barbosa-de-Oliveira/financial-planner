import type { UserRepository, User } from '../repositories/userRepository.ts';
import type { PasswordHasher } from '../utils/passwordHasher.ts';
import { UserNotFoundError } from '../utils/errors.ts';

export type CreateUserInput = {
  email: string;
  password: string;
};

export type UpdateUserInput = {
  email?: string;
  password?: string;
};

export type UserService = {
  createUser: (input: CreateUserInput) => Promise<User>;
  listUsers: () => Promise<User[]>;
  getUser: (id: string) => Promise<User>;
  updateUser: (id: string, input: UpdateUserInput) => Promise<User>;
  deactivateUser: (id: string) => Promise<void>;
};

export type UserServiceDependencies = {
  repository: UserRepository;
  hasher: PasswordHasher;
};

export function createUserService({ repository, hasher }: UserServiceDependencies): UserService {
  return {
    async createUser({ email, password }) {
      const passwordHash = await hasher.hash(password);
      return repository.create({ email, passwordHash });
    },

    listUsers() {
      return repository.findAll();
    },

    async getUser(id) {
      const user = await repository.findById(id);
      if (!user) throw new UserNotFoundError();
      return user;
    },

    async updateUser(id, { email, password }) {
      const passwordHash = password === undefined ? undefined : await hasher.hash(password);
      const user = await repository.update(id, { email, passwordHash });
      if (!user) throw new UserNotFoundError();
      return user;
    },

    async deactivateUser(id) {
      const deactivated = await repository.deactivate(id);
      if (!deactivated) throw new UserNotFoundError();
    },
  };
}
