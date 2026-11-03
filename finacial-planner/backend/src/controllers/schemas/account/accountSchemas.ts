import { z } from 'zod';
import { accountConfig } from '../../../config/account.ts';

const nameField = z
  .string({ required_error: 'Nome é obrigatório', invalid_type_error: 'Nome deve ser um texto' })
  .trim()
  .min(1, 'Nome é obrigatório')
  .max(accountConfig.name.maxLength, `Nome deve ter no máximo ${accountConfig.name.maxLength} caracteres`);

const typeField = z.enum(accountConfig.types, {
  errorMap: (issue, ctx) => ({
    message: ctx.data === undefined && issue.code === 'invalid_type'
      ? 'Tipo é obrigatório'
      : 'Tipo inválido (use BANK, INVESTMENT, CASH ou SAVINGS)',
  }),
});

// Saldo é texto decimal: nunca passa por number, para não usar ponto flutuante
const balanceField = z
  .string({ invalid_type_error: 'Saldo deve ser um texto decimal, ex.: "1500.00"' })
  .regex(accountConfig.balance.pattern, 'Saldo deve ser um valor decimal com até 10 dígitos inteiros e 2 casas');

export const createAccountSchema = z
  .object({
    name: nameField,
    type: typeField,
    balance: balanceField.default(accountConfig.balance.default),
  })
  .strict('Campo não permitido no cadastro de conta');

export const updateAccountSchema = z
  .object({ name: nameField.optional(), type: typeField.optional() })
  .strict('Campo não permitido na alteração de conta')
  .refine((body) => body.name !== undefined || body.type !== undefined, {
    message: 'Informe ao menos um campo para alterar (name ou type)',
  });

export const accountIdParamsSchema = z.object({
  id: z.string({ required_error: 'Identificador inválido', invalid_type_error: 'Identificador inválido' })
    .uuid('Identificador inválido'),
});

export type CreateAccountBody = z.infer<typeof createAccountSchema>;
export type UpdateAccountBody = z.infer<typeof updateAccountSchema>;
