import { describe, it, expect } from '@jest/globals';
import { accountIdParamsSchema, createAccountSchema, updateAccountSchema } from './accountSchemas.ts';

const messagesOf = (result: { success: boolean; error?: { issues: Array<{ message: string }> } }) =>
  result.error?.issues.map((issue) => issue.message) ?? [];

describe('createAccountSchema', () => {
  const valid = { name: 'Nubank', type: 'BANK', balance: '1500.00' };

  it('aceita um corpo válido', () => {
    expect(createAccountSchema.parse(valid)).toEqual(valid);
  });

  it('remove espaços nas pontas do nome', () => {
    expect(createAccountSchema.parse({ ...valid, name: '  Nubank  ' }).name).toBe('Nubank');
  });

  it('usa saldo 0.00 quando não informado', () => {
    expect(createAccountSchema.parse({ name: 'Carteira', type: 'CASH' }).balance).toBe('0.00');
  });

  it.each(['-250.50', '0', '0.00', '10', '9999999999.99', '5.5'])('aceita o saldo %s', (balance) => {
    expect(createAccountSchema.parse({ ...valid, balance }).balance).toBe(balance);
  });

  it.each(['1,5', '1.234', 'abc', '', '12345678901', '-', '.5', '1e3', ' 1.00'])('recusa o saldo %p', (balance) => {
    const result = createAccountSchema.safeParse({ ...valid, balance });
    expect(result.success).toBe(false);
  });

  it('recusa saldo que não seja texto', () => {
    const result = createAccountSchema.safeParse({ ...valid, balance: 1500 });
    expect(result.success).toBe(false);
    expect(messagesOf(result)[0]).toContain('texto decimal');
  });

  it.each(['', '   '])('recusa nome vazio ou só com espaços (%p)', (name) => {
    const result = createAccountSchema.safeParse({ ...valid, name });
    expect(messagesOf(result)).toContain('Nome é obrigatório');
  });

  it('aceita nome com 100 e recusa com 101 caracteres', () => {
    expect(createAccountSchema.safeParse({ ...valid, name: 'a'.repeat(100) }).success).toBe(true);
    const result = createAccountSchema.safeParse({ ...valid, name: 'a'.repeat(101) });
    expect(messagesOf(result)).toContain('Nome deve ter no máximo 100 caracteres');
  });

  it.each(['XYZ', 'bank', '', 1])('recusa o tipo %p', (type) => {
    const result = createAccountSchema.safeParse({ ...valid, type });
    expect(messagesOf(result)).toContain('Tipo inválido (use BANK, INVESTMENT, CASH ou SAVINGS)');
  });

  it.each(['BANK', 'INVESTMENT', 'CASH', 'SAVINGS'])('aceita o tipo %s', (type) => {
    expect(createAccountSchema.parse({ ...valid, type }).type).toBe(type);
  });

  it('exige nome e tipo', () => {
    const result = createAccountSchema.safeParse({});
    expect(messagesOf(result)).toEqual(expect.arrayContaining(['Nome é obrigatório', 'Tipo é obrigatório']));
  });

  it.each(['id', 'workspaceId', 'isActive', 'createdAt', 'updatedAt'])('recusa o campo %s', (field) => {
    const result = createAccountSchema.safeParse({ ...valid, [field]: 'x' });
    expect(messagesOf(result)).toContain('Campo não permitido no cadastro de conta');
  });
});

describe('updateAccountSchema', () => {
  it('aceita só nome, só tipo ou os dois', () => {
    expect(updateAccountSchema.parse({ name: 'Santander Corrente' })).toEqual({ name: 'Santander Corrente' });
    expect(updateAccountSchema.parse({ type: 'SAVINGS' })).toEqual({ type: 'SAVINGS' });
    expect(updateAccountSchema.parse({ name: 'A', type: 'CASH' })).toEqual({ name: 'A', type: 'CASH' });
  });

  it('remove espaços nas pontas do nome', () => {
    expect(updateAccountSchema.parse({ name: '  Nubank PJ ' }).name).toBe('Nubank PJ');
  });

  it('recusa corpo vazio', () => {
    const result = updateAccountSchema.safeParse({});
    expect(messagesOf(result)).toContain('Informe ao menos um campo para alterar (name ou type)');
  });

  it.each(['balance', 'id', 'isActive', 'workspaceId', 'createdAt'])('recusa o campo %s', (field) => {
    const result = updateAccountSchema.safeParse({ name: 'Nubank', [field]: '10.00' });
    expect(messagesOf(result)).toContain('Campo não permitido na alteração de conta');
  });

  it('recusa nome e tipo inválidos', () => {
    expect(updateAccountSchema.safeParse({ name: '  ' }).success).toBe(false);
    expect(updateAccountSchema.safeParse({ type: 'XYZ' }).success).toBe(false);
  });
});

describe('accountIdParamsSchema', () => {
  it('aceita UUID', () => {
    const id = '6f1d3c1e-0c4b-4f0e-9d1a-2b7a8f3c9e10';
    expect(accountIdParamsSchema.parse({ id })).toEqual({ id });
  });

  it.each(['abc', '', '123'])('recusa %p com "Identificador inválido"', (id) => {
    const result = accountIdParamsSchema.safeParse({ id });
    expect(messagesOf(result)).toContain('Identificador inválido');
  });
});
