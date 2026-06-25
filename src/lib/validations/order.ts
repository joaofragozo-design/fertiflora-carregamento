import { z } from 'zod'

export const carregamentoStatusSchema = z.enum(['PENDENTE', 'CARREGANDO', 'CONCLUIDO', 'CANCELADO'])

export const createCarregamentoSchema = z.object({
  insumo: z
    .string({ required_error: 'Informe a matéria prima' })
    .min(2, 'Mínimo 2 caracteres')
    .max(150, 'Máximo 150 caracteres')
    .transform((v) => v.trim()),

  quantidade: z
    .string({ required_error: 'Informe a quantidade' })
    .min(1, 'Informe a quantidade')
    .pipe(
      z.coerce
        .number({ invalid_type_error: 'Quantidade inválida' })
        .positive('Deve ser maior que zero')
        .max(999_999, 'Valor muito alto')
    ),
})

// Alias para imports legados
export const createOrdemSchema      = createCarregamentoSchema
export const ordemStatusSchema      = carregamentoStatusSchema

export type CreateCarregamentoInput = z.infer<typeof createCarregamentoSchema>
export type CreateOrdemInput        = CreateCarregamentoInput
