import { z } from 'zod'

export const loginSchema = z.object({
  username: z
    .string()
    .min(2, 'Mínimo 2 caracteres')
    .max(50, 'Máximo 50 caracteres')
    .regex(/^[a-z0-9_.]+$/i, 'Apenas letras, números, _ e .'),
  password: z
    .string()
    .min(6, 'Mínimo 6 caracteres')
    .max(100, 'Máximo 100 caracteres'),
})

export type LoginInput = z.infer<typeof loginSchema>

export const FAKE_EMAIL_DOMAIN = '@fertiflora.local'

export function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}${FAKE_EMAIL_DOMAIN}`
}

export function emailToUsername(email: string): string {
  return email.replace(FAKE_EMAIL_DOMAIN, '')
}
