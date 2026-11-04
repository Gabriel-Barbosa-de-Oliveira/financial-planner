import { describe, it, expect } from '@jest/globals';
import {
  categoryIdParamsSchema,
  createCategorySchema,
  listCategoriesQuerySchema,
  updateCategorySchema,
} from './categorySchemas.ts';

const CLASSIFICATION_ID = '0b9f4f55-6a47-4c53-9d0a-6a1b0f6a2c11';

const messagesOf = (result: { success: boolean; error?: { issues: Array<{ message: string }> } }) =>
  result.error?.issues.map((issue) => issue.message) ?? [];

describe('createCategorySchema', () => {
  const valid = { name: 'Gasolina', type: 'SAIDA', classificationId: CLASSIFICATION_ID };

  it('aceita um corpo válido com classificação', () => {
    expect(createCategorySchema.parse(valid)).toEqual(valid);
  });

  it('aceita sem classificação e com classificação null', () => {
    expect(createCategorySchema.parse({ name: 'Salário', type: 'ENTRADA' })).toEqual({ name: 'Salário', type: 'ENTRADA' });
    expect(createCategorySchema.parse({ name: 'Salário', type: 'ENTRADA', classificationId: null }).classificationId).toBeNull();
  });

  it('remove espaços nas pontas do nome', () => {
    expect(createCategorySchema.parse({ ...valid, name: '  Gasolina ' }).name).toBe('Gasolina');
  });

  it.each(['XYZ', 'SAÍDA', 'saida', ''])('recusa o tipo %p', (type) => {
    expect(messagesOf(createCategorySchema.safeParse({ ...valid, type }))).toEqual(['Tipo inválido (use ENTRADA ou SAIDA)']);
  });

  it('recusa tipo ausente', () => {
    expect(messagesOf(createCategorySchema.safeParse({ name: 'A' }))).toEqual(['Tipo é obrigatório']);
  });

  it.each([{ type: 'SAIDA' }, { name: '', type: 'SAIDA' }, { name: '   ', type: 'SAIDA' }])('recusa nome ausente ou vazio %p', (body) => {
    expect(messagesOf(createCategorySchema.safeParse(body))).toEqual(['Nome é obrigatório']);
  });

  it('recusa nome com 101 caracteres', () => {
    expect(messagesOf(createCategorySchema.safeParse({ ...valid, name: 'a'.repeat(101) }))).toEqual([
      'Nome deve ter no máximo 100 caracteres',
    ]);
  });

  it.each(['abc', '', 10])('recusa classificationId inválido %p', (classificationId) => {
    expect(messagesOf(createCategorySchema.safeParse({ ...valid, classificationId }))).toEqual(['Classificação inválida']);
  });

  it.each(['id', 'isActive', 'workspaceId', 'createdAt', 'updatedAt'])('recusa o campo proibido %s', (field) => {
    expect(messagesOf(createCategorySchema.safeParse({ ...valid, [field]: 'x' }))).toContain(
      'Campo não permitido no cadastro de categoria',
    );
  });
});

describe('updateCategorySchema', () => {
  it('aceita só nome, só classificação, ambos e classificação null', () => {
    expect(updateCategorySchema.parse({ name: ' Combustível ' })).toEqual({ name: 'Combustível' });
    expect(updateCategorySchema.parse({ classificationId: CLASSIFICATION_ID })).toEqual({ classificationId: CLASSIFICATION_ID });
    expect(updateCategorySchema.parse({ name: 'A', classificationId: CLASSIFICATION_ID })).toEqual({
      name: 'A',
      classificationId: CLASSIFICATION_ID,
    });
    expect(updateCategorySchema.parse({ classificationId: null })).toEqual({ classificationId: null });
  });

  it('recusa corpo vazio', () => {
    expect(messagesOf(updateCategorySchema.safeParse({}))).toEqual([
      'Informe ao menos um campo para alterar (name ou classificationId)',
    ]);
  });

  it.each(['type', 'id', 'isActive', 'workspaceId', 'createdAt', 'updatedAt'])('recusa o campo proibido %s', (field) => {
    expect(messagesOf(updateCategorySchema.safeParse({ name: 'A', [field]: 'x' }))).toContain(
      'Campo não permitido na alteração de categoria',
    );
  });

  it('recusa valores fora das regras', () => {
    expect(updateCategorySchema.safeParse({ name: '' }).success).toBe(false);
    expect(updateCategorySchema.safeParse({ classificationId: 'abc' }).success).toBe(false);
  });
});

describe('listCategoriesQuerySchema', () => {
  it('aceita sem filtros, com cada filtro e com os dois', () => {
    expect(listCategoriesQuerySchema.parse({})).toEqual({});
    expect(listCategoriesQuerySchema.parse({ type: 'ENTRADA' })).toEqual({ type: 'ENTRADA' });
    expect(listCategoriesQuerySchema.parse({ classificationId: CLASSIFICATION_ID })).toEqual({ classificationId: CLASSIFICATION_ID });
    expect(listCategoriesQuerySchema.parse({ classificationId: CLASSIFICATION_ID, type: 'SAIDA' })).toEqual({
      classificationId: CLASSIFICATION_ID,
      type: 'SAIDA',
    });
  });

  it('recusa valores inválidos e filtros desconhecidos', () => {
    expect(messagesOf(listCategoriesQuerySchema.safeParse({ type: 'XYZ' }))).toEqual(['Tipo inválido (use ENTRADA ou SAIDA)']);
    expect(messagesOf(listCategoriesQuerySchema.safeParse({ classificationId: 'abc' }))).toEqual(['Classificação inválida']);
    expect(messagesOf(listCategoriesQuerySchema.safeParse({ name: 'x' }))).toContain('Filtro não permitido');
  });
});

describe('categoryIdParamsSchema', () => {
  it('aceita UUID e recusa o resto com "Identificador inválido"', () => {
    expect(categoryIdParamsSchema.parse({ id: CLASSIFICATION_ID })).toEqual({ id: CLASSIFICATION_ID });
    for (const id of ['abc', '', '123']) {
      expect(messagesOf(categoryIdParamsSchema.safeParse({ id }))).toEqual(['Identificador inválido']);
    }
    expect(messagesOf(categoryIdParamsSchema.safeParse({}))).toEqual(['Identificador inválido']);
  });
});
