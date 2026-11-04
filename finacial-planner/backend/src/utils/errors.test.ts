import { describe, it, expect } from '@jest/globals';
import {
  AccountNotFoundError,
  CategoryAlreadyActiveError,
  CategoryNotFoundError,
  ClassificationAlreadyActiveError,
  ClassificationNotFoundError,
  InvalidClassificationError,
  UsedCategoryNameError,
  UsedClassificationNameError,
  DomainError,
  UsedAccountNameError,
  UsedEmailError,
  UserNotFoundError,
  WorkspaceUnavailableError,
} from './errors.ts';

describe('UsedEmailError', () => {
  const error = new UsedEmailError();

  it('traduz para conflito com mensagem em português', () => {
    expect(error.code).toBe('USED_EMAIL');
    expect(error.statusCode).toBe(409);
    expect(error.message).toBe('E-mail já está em uso');
  });

  it('é um DomainError e um Error', () => {
    expect(error).toBeInstanceOf(DomainError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('UsedEmailError');
  });
});

describe('UserNotFoundError', () => {
  const error = new UserNotFoundError();

  it('traduz para não encontrado com mensagem em português', () => {
    expect(error.code).toBe('USER_NOT_FOUND');
    expect(error.statusCode).toBe(404);
    expect(error.message).toBe('Usuário não encontrado');
  });

  it('é um DomainError e um Error', () => {
    expect(error).toBeInstanceOf(DomainError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('UserNotFoundError');
  });
});

describe.each([
  [AccountNotFoundError, 'ACCOUNT_NOT_FOUND', 404, 'Conta não encontrada'],
  [UsedAccountNameError, 'USED_ACCOUNT_NAME', 409, 'Já existe uma conta com este nome'],
  [WorkspaceUnavailableError, 'WORKSPACE_UNAVAILABLE', 422, 'Workspace padrão não encontrado'],
  [ClassificationNotFoundError, 'CLASSIFICATION_NOT_FOUND', 404, 'Classificação não encontrada'],
  [UsedClassificationNameError, 'USED_CLASSIFICATION_NAME', 409, 'Já existe uma classificação com este nome'],
  [ClassificationAlreadyActiveError, 'CLASSIFICATION_ALREADY_ACTIVE', 409, 'Classificação já está ativa'],
  [CategoryNotFoundError, 'CATEGORY_NOT_FOUND', 404, 'Categoria não encontrada'],
  [UsedCategoryNameError, 'USED_CATEGORY_NAME', 409, 'Já existe uma categoria com este nome para este tipo'],
  [CategoryAlreadyActiveError, 'CATEGORY_ALREADY_ACTIVE', 409, 'Categoria já está ativa'],
  [InvalidClassificationError, 'INVALID_CLASSIFICATION', 422, 'Classificação não encontrada'],
])('%p', (ErrorClass, code, statusCode, message) => {
  const error = new ErrorClass();

  it('traduz para o status certo com mensagem em português', () => {
    expect(error.code).toBe(code);
    expect(error.statusCode).toBe(statusCode);
    expect(error.message).toBe(message);
  });

  it('é um DomainError e um Error', () => {
    expect(error).toBeInstanceOf(DomainError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe(ErrorClass.name);
  });
});
