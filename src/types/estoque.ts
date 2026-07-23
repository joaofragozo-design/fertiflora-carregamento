export type NivelEstoque = 'perigo' | 'cuidado' | 'tudo_bem' | 'bem_tranquilo'

export interface EstoqueAtual {
  materia_prima_key: string
  quantidade_ton:    number
  updated_at:        string
}

export interface EstoqueConfig {
  materia_prima_key:  string
  limite_perigo:      number
  limite_cuidado:      number
  limite_confortavel: number
  updated_at:         string
}

export const NIVEL_LABEL: Record<NivelEstoque, string> = {
  perigo:         'Perigo',
  cuidado:        'Cuidado',
  tudo_bem:       'Tudo bem',
  bem_tranquilo:  'Bem tranquilo',
}

/** Nível do "termômetro" — comparação simples do saldo atual contra os
 *  limites configurados pra essa matéria-prima (sem config = sempre "tudo bem"). */
export function calcularNivel(quantidadeTon: number, config: EstoqueConfig | undefined): NivelEstoque {
  if (!config) return 'tudo_bem'
  if (quantidadeTon <= config.limite_perigo) return 'perigo'
  if (quantidadeTon <= config.limite_cuidado) return 'cuidado'
  if (quantidadeTon <= config.limite_confortavel) return 'tudo_bem'
  return 'bem_tranquilo'
}

/**
 * Alerta extra (independente do nível acima): quanto do estoque atual será
 * consumido HOJE pelo que já está programado/em andamento pra carregar.
 * Retorna a razão 0-1 (ou mais, se for consumir mais do que existe).
 */
export function razaoConsumoHoje(estoqueAtual: number, consumoHojeTon: number): number {
  if (estoqueAtual <= 0) return consumoHojeTon > 0 ? Infinity : 0
  return consumoHojeTon / estoqueAtual
}

export const LIMIAR_ALERTA_CONSUMO_HOJE = 0.7 // acima de 70% do estoque consumido hoje, acende alerta
