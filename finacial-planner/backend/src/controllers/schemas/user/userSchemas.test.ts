import { describe, it, expect } from '@jest/globals';
import { createUserSchema } from './userSchemas.ts';

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
