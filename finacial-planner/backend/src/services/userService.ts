import type { UserRepository, User } from '../repositories/userRepository.ts';
import type { PasswordHasher } from '../utils/passwordHasher.ts';

export type CreateUserInput = {
  email: string;
  password: string;
};

export type UserService = {
  createUser: (input: CreateUserInput) => Promise<User>;
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
  };
}
