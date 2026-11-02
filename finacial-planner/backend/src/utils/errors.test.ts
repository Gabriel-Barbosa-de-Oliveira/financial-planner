import { describe, it, expect } from '@jest/globals';
import { DomainError, UsedEmailError } from './errors.ts';

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
