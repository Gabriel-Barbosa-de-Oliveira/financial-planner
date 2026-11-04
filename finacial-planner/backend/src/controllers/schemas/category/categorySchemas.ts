import { z } from 'zod';
import { categoryConfig } from '../../../config/category.ts';

const nameField = z
  .string({ required_error: 'Nome é obrigatório', invalid_type_error: 'Nome deve ser um texto' })
  .trim()
  .min(1, 'Nome é obrigatório')
  .max(categoryConfig.name.maxLength, `Nome deve ter no máximo ${categoryConfig.name.maxLength} caracteres`);

const typeMessage = 'Tipo inválido (use ENTRADA ou SAIDA)';

const typeField = z.enum(categoryConfig.types, {
  errorMap: (issue, ctx) => ({
    message: ctx.data === undefined && issue.code === 'invalid_type' ? 'Tipo é obrigatório' : typeMessage,
  }),
});

const classificationIdField = z
  .string({ invalid_type_error: 'Classificação inválida' })
  .uuid('Classificação inválida')
  .nullable();

export const createCategorySchema = z
  .object({
    name: nameField,
    type: typeField,
    classificationId: classificationIdField.optional(),
  })
  .strict('Campo não permitido no cadastro de categoria');

// type não entra: o tipo da categoria é imutável. classificationId: null remove o vínculo
export const updateCategorySchema = z
  .object({ name: nameField.optional(), classificationId: classificationIdField.optional() })
  .strict('Campo não permitido na alteração de categoria')
  .refine((body) => body.name !== undefined || body.classificationId !== undefined, {
    message: 'Informe ao menos um campo para alterar (name ou classificationId)',
  });

export const listCategoriesQuerySchema = z
  .object({
    classificationId: z
      .string({ invalid_type_error: 'Classificação inválida' })
      .uuid('Classificação inválida')
      .optional(),
    type: z.enum(categoryConfig.types, { errorMap: () => ({ message: typeMessage }) }).optional(),
  })
  .strict('Filtro não permitido');

export const categoryIdParamsSchema = z.object({
  id: z.string({ required_error: 'Identificador inválido', invalid_type_error: 'Identificador inválido' })
    .uuid('Identificador inválido'),
});

export type CreateCategoryBody = z.infer<typeof createCategorySchema>;
export type UpdateCategoryBody = z.infer<typeof updateCategorySchema>;
export type ListCategoriesQuery = z.infer<typeof listCategoriesQuerySchema>;
