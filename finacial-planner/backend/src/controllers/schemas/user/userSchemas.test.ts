import { describe, it, expect } from '@jest/globals';
import { createUserSchema, updateUserSchema, userIdParamsSchema } from './userSchemas.ts';

describe('createUserSchema', () => {
  it('normaliza o e-mail e mantém a senha intacta', () => {
    const result = createUserSchema.parse({ email: '  Ana@Exemplo.com ', password: ' senha-com-espaço ' });

    expect(result).toEqual({ email: 'ana@exemplo.com', password: ' senha-com-espaço ' });
  });

  it('recusa campos não permitidos', () => {
    const result = createUserSchema.safeParse({ email: 'ana@exemplo.com', password: 'senha-segura-123', isActive: false });

    expect(result.success).toBe(false);
  });

  it('aceita senha de 8 e de 72 caracteres e recusa 7 e 73', () => {
    const parse = (length: number) =>
      createUserSchema.safeParse({ email: 'ana@exemplo.com', password: 'a'.repeat(length) }).success;

    expect([parse(7), parse(8), parse(72), parse(73)]).toEqual([false, true, true, false]);
  });
});

describe('userIdParamsSchema', () => {
  it('aceita um UUID', () => {
    const id = '6f1d3c1e-0c4b-4f0e-9d1a-2b7a8f3c9e10';

    expect(userIdParamsSchema.parse({ id })).toEqual({ id });
  });

  it.each(['abc', '', '123', '6f1d3c1e-0c4b-4f0e-9d1a-2b7a8f3c9e1'])('recusa "%s" com Identificador inválido', (id) => {
    const result = userIdParamsSchema.safeParse({ id });

    expect(result.success).toBe(false);
    expect(!result.success && result.error.issues[0].message).toBe('Identificador inválido');
  });
});

describe('updateUserSchema', () => {
  it('aceita só e-mail, só senha ou os dois', () => {
    expect(updateUserSchema.parse({ email: 'novo@exemplo.com' })).toEqual({ email: 'novo@exemplo.com' });
    expect(updateUserSchema.parse({ password: 'nova-senha-123' })).toEqual({ password: 'nova-senha-123' });
    expect(updateUserSchema.parse({ email: 'novo@exemplo.com', password: 'nova-senha-123' })).toEqual({
      email: 'novo@exemplo.com',
      password: 'nova-senha-123',
    });
  });

  it('normaliza o e-mail', () => {
    expect(updateUserSchema.parse({ email: '  Ana@Exemplo.com ' })).toEqual({ email: 'ana@exemplo.com' });
  });

  it('recusa corpo vazio pedindo ao menos um campo', () => {
    const result = updateUserSchema.safeParse({});

    expect(result.success).toBe(false);
    expect(!result.success && result.error.issues[0].message).toBe(
      'Informe ao menos um campo para alterar (email ou password)',
    );
  });

  it.each(['id', 'isActive', 'createdAt', 'updatedAt'])('recusa o campo não permitido %s', (field) => {
    const result = updateUserSchema.safeParse({ email: 'novo@exemplo.com', [field]: 'x' });

    expect(result.success).toBe(false);
  });

  it('aplica os limites de senha: 7 e 73 recusadas, 8 e 72 aceitas', () => {
    const parse = (length: number) => updateUserSchema.safeParse({ password: 'a'.repeat(length) }).success;

    expect([parse(7), parse(8), parse(72), parse(73)]).toEqual([false, true, true, false]);
  });

  it('recusa e-mail inválido', () => {
    expect(updateUserSchema.safeParse({ email: 'invalido' }).success).toBe(false);
  });
});
