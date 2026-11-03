import { z } from 'zod';
import { securityConfig } from '../../../config/security.ts';

const { email, password } = securityConfig;

const emailField = z
  .string({ required_error: 'E-mail é obrigatório', invalid_type_error: 'E-mail deve ser um texto' })
  .trim()
  .toLowerCase()
  .email('E-mail inválido')
  .max(email.maxLength, `E-mail deve ter no máximo ${email.maxLength} caracteres`);

const passwordField = z
  .string({ required_error: 'Senha é obrigatória', invalid_type_error: 'Senha deve ser um texto' })
  .min(password.minLength, `Senha deve ter no mínimo ${password.minLength} caracteres`)
  .max(password.maxLength, `Senha deve ter no máximo ${password.maxLength} caracteres`);

export const createUserSchema = z
  .object({ email: emailField, password: passwordField })
  .strict('Campo não permitido no cadastro de usuário');

export const userIdParamsSchema = z.object({
  id: z.string({ required_error: 'Identificador inválido', invalid_type_error: 'Identificador inválido' })
    .uuid('Identificador inválido'),
});

export const updateUserSchema = z
  .object({ email: emailField.optional(), password: passwordField.optional() })
  .strict('Campo não permitido na alteração de usuário')
  .refine((body) => body.email !== undefined || body.password !== undefined, {
    message: 'Informe ao menos um campo para alterar (email ou password)',
  });

export type CreateUserBody = z.infer<typeof createUserSchema>;
export type UpdateUserBody = z.infer<typeof updateUserSchema>;
