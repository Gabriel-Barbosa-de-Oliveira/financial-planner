import { describe, it, expect } from '@jest/globals';
import {
  classificationIdParamsSchema,
  createClassificationSchema,
  updateClassificationSchema,
} from './classificationSchemas.ts';

const messagesOf = (result: { success: boolean; error?: { issues: Array<{ message: string }> } }) =>
  result.error?.issues.map((issue) => issue.message) ?? [];

describe.each([
  ['createClassificationSchema', createClassificationSchema, 'Campo não permitido no cadastro de classificação'],
  ['updateClassificationSchema', updateClassificationSchema, 'Campo não permitido na alteração de classificação'],
])('%s', (_name, schema, forbiddenMessage) => {
  it('aceita um nome válido e mantém acentos', () => {
    expect(schema.parse({ name: 'Automóvel' })).toEqual({ name: 'Automóvel' });
  });

  it('remove espaços nas pontas do nome', () => {
    expect(schema.parse({ name: '  Comidas  ' }).name).toBe('Comidas');
  });

  it('aceita nome com exatamente 100 caracteres e recusa 101', () => {
    expect(schema.safeParse({ name: 'a'.repeat(100) }).success).toBe(true);
    const result = schema.safeParse({ name: 'a'.repeat(101) });
    expect(messagesOf(result)).toEqual(['Nome deve ter no máximo 100 caracteres']);
  });

  it.each([{}, { name: '' }, { name: '   ' }])('recusa nome ausente ou vazio %p', (body) => {
    expect(messagesOf(schema.safeParse(body))).toEqual(['Nome é obrigatório']);
  });

  it('recusa nome que não é texto', () => {
    expect(messagesOf(schema.safeParse({ name: 10 }))).toEqual(['Nome deve ser um texto']);
  });

  it.each(['id', 'isActive', 'workspaceId', 'createdAt', 'updatedAt'])('recusa o campo proibido %s', (field) => {
    const result = schema.safeParse({ name: 'Lazer', [field]: 'x' });
    expect(messagesOf(result)).toContain(forbiddenMessage);
  });
});

describe('classificationIdParamsSchema', () => {
  it('aceita UUID', () => {
    const id = '6f1d3c1e-0c4b-4f0e-9d1a-2b7a8f3c9e10';
    expect(classificationIdParamsSchema.parse({ id })).toEqual({ id });
  });

  it.each(['abc', '', '123'])('recusa %p com "Identificador inválido"', (id) => {
    expect(messagesOf(classificationIdParamsSchema.safeParse({ id }))).toEqual(['Identificador inválido']);
  });

  it('recusa id ausente', () => {
    expect(messagesOf(classificationIdParamsSchema.safeParse({}))).toEqual(['Identificador inválido']);
  });
});
