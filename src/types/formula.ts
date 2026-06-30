export interface Formula {
  id:                 number
  nome:               string
  mo:                 number
  map:                number
  calcario_concha:    number
  sulfato_amonia:     number
  carbonato_ca_mg:    number
  ureia:              number
  cloreto_potassio:   number
  boro:               number
  enxofre_pastilhado: number
  fte_br_12:          number
  oxmag_s:            number
  tsp:                number
  caltimag:           number
  hiphos_25:          number
  ativo:              boolean
  created_at:         string
  updated_at:         string
}

export type Embalagem = 'SACOS' | 'BAG_750' | 'BAG_1000'

export type StatusOrdem = 'AGUARDANDO' | 'EM_ANDAMENTO' | 'FINALIZADO'

export interface OrdemDiaria {
  id:          string
  data:        string
  sequencia:   number
  cliente:     string
  placa:       string
  envelopar:   boolean
  quantidade:  number
  embalagem:   Embalagem
  tons:        number
  formula_id:  number | null
  formula?:    Formula
  iniciado:      boolean
  finalizado:    boolean
  iniciado_em:   string | null
  finalizado_em: string | null
  created_at:    string
  updated_at:    string
}

/** Formata uma duração em ms como "1h 23m" ou "12m" ou "45s". */
export function formatDuracao(ms: number): string {
  if (ms <= 0) return '—'
  const totalMin = Math.floor(ms / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m`
  return `${Math.floor(ms / 1000)}s`
}

/** Ritmo de carregamento em toneladas por hora. */
export function tonPorHora(tons: number, ms: number): number {
  const horas = ms / 3_600_000
  if (horas <= 0) return 0
  return +(tons / horas).toFixed(2)
}

export type OrdemDiariaInsert = Omit<OrdemDiaria, 'id' | 'tons' | 'formula' | 'iniciado_em' | 'finalizado_em' | 'created_at' | 'updated_at'>
export type OrdemDiariaUpdate = Partial<OrdemDiariaInsert>

export const INGREDIENTES = [
  { key: 'mo',                 label: 'M.O.'          },
  { key: 'map',                label: 'MAP'           },
  { key: 'calcario_concha',    label: 'Cal. Concha'   },
  { key: 'sulfato_amonia',     label: 'Sul. Amônia'   },
  { key: 'carbonato_ca_mg',    label: 'Carb. Ca+Mg'   },
  { key: 'ureia',              label: 'Ureia'         },
  { key: 'cloreto_potassio',   label: 'Cl. Potássio'  },
  { key: 'boro',               label: 'Boro 10'       },
  { key: 'enxofre_pastilhado', label: 'Enx. Past.'    },
  { key: 'fte_br_12',          label: 'FTE BR 12'     },
  { key: 'oxmag_s',            label: 'OXMAG+S'       },
  { key: 'tsp',                label: 'TSP'           },
  { key: 'caltimag',           label: 'CALTIMAG'      },
  { key: 'hiphos_25',          label: 'HIPHOS 25'     },
] as const

export type IngredienteKey = typeof INGREDIENTES[number]['key']

export function calcularIngrediente(formula: Formula, ingrediente: IngredienteKey): number {
  return +(formula[ingrediente] * 1000).toFixed(2)
}

// Toneladas por unidade de cada embalagem.
export const PESO_TON: Record<Embalagem, number> = {
  SACOS:    0.05, //   50 kg
  BAG_750:  0.75, //  750 kg
  BAG_1000: 1.0,  // 1000 kg
}

// Rótulos exibidos na interface.
export const EMBALAGEM_LABEL: Record<Embalagem, string> = {
  SACOS:    'SACOS',
  BAG_750:  'BAG DE 750kg',
  BAG_1000: 'BAG DE 1000kg',
}

export const EMBALAGEM_OPCOES: Embalagem[] = ['SACOS', 'BAG_750', 'BAG_1000']

export function calcularTons(quantidade: number, embalagem: Embalagem): number {
  return quantidade * (PESO_TON[embalagem] ?? 0)
}

export function getStatus(ordem: Pick<OrdemDiaria, 'iniciado' | 'finalizado'>): StatusOrdem {
  if (ordem.finalizado) return 'FINALIZADO'
  if (ordem.iniciado)   return 'EM_ANDAMENTO'
  return 'AGUARDANDO'
}
