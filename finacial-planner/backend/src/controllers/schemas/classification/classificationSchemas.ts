import { z } from 'zod';
import { classificationConfig } from '../../../config/classification.ts';

const nameField = z
  .string({ required_error: 'Nome é obrigatório', invalid_type_error: 'Nome deve ser um texto' })
  .trim()
  .min(1, 'Nome é obrigatório')
  .max(classificationConfig.name.maxLength, `Nome deve ter no máximo ${classificationConfig.name.maxLength} caracteres`);

export const createClassificationSchema = z
  .object({ name: nameField })
  .strict('Campo não permitido no cadastro de classificação');

export const updateClassificationSchema = z
  .object({ name: nameField })
  .strict('Campo não permitido na alteração de classificação');

export const classificationIdParamsSchema = z.object({
  id: z.string({ required_error: 'Identificador inválido', invalid_type_error: 'Identificador inválido' })
    .uuid('Identificador inválido'),
});

export type CreateClassificationBody = z.infer<typeof createClassificationSchema>;
export type UpdateClassificationBody = z.infer<typeof updateClassificationSchema>;
