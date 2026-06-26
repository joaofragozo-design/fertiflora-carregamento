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

export type Embalagem = 'SACOS' | 'BAGS'

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
  iniciado:    boolean
  finalizado:  boolean
  created_at:  string
  updated_at:  string
}

export type OrdemDiariaInsert = Omit<OrdemDiaria, 'id' | 'tons' | 'formula' | 'created_at' | 'updated_at'>
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

export function calcularTons(quantidade: number, embalagem: Embalagem): number {
  return embalagem === 'SACOS' ? quantidade * 0.05 : quantidade * 0.75
}

export function getStatus(ordem: Pick<OrdemDiaria, 'iniciado' | 'finalizado'>): StatusOrdem {
  if (ordem.finalizado) return 'FINALIZADO'
  if (ordem.iniciado)   return 'EM_ANDAMENTO'
  return 'AGUARDANDO'
}
