import { z } from 'zod';
import { securityConfig } from '../../../config/security.ts';

const { email, password } = securityConfig;

export const createUserSchema = z
  .object({
    email: z
      .string({ required_error: 'E-mail é obrigatório', invalid_type_error: 'E-mail deve ser um texto' })
      .trim()
      .toLowerCase()
      .email('E-mail inválido')
      .max(email.maxLength, `E-mail deve ter no máximo ${email.maxLength} caracteres`),
    password: z
      .string({ required_error: 'Senha é obrigatória', invalid_type_error: 'Senha deve ser um texto' })
      .min(password.minLength, `Senha deve ter no mínimo ${password.minLength} caracteres`)
      .max(password.maxLength, `Senha deve ter no máximo ${password.maxLength} caracteres`),
  })
  .strict('Campo não permitido no cadastro de usuário');

export type CreateUserBody = z.infer<typeof createUserSchema>;
