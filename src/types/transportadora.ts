// Fluxo transportadora/motorista: a Logística envia o agendamento para uma
// transportadora; ela cadastra o motorista (WhatsApp obrigatório) e envia a
// solicitação; a Logística libera e a mensagem de WhatsApp é disparada.

export interface Transportadora {
  id:         string
  nome:       string
  profile_id: string | null // login da transportadora (profiles.id)
  ativo:      boolean
  created_at: string
  updated_at: string
}

export interface Motorista {
  id:                string
  transportadora_id: string
  nome:              string
  whatsapp:          string // obrigatório: recebe a mensagem de liberação
  cpf:               string
  rg:                string
  cnh:               string
  placa_cavalo:      string
  placa_1:           string
  placa_2:           string | null
  placa_3:           string | null
  placa_4:           string | null
  created_at:        string
  updated_at:        string
}

export type SolicitacaoStatus = 'ENVIADO_TRANSPORTADORA' | 'SOLICITADO' | 'LIBERADO'

export const SOLICITACAO_STATUS_LABEL: Record<SolicitacaoStatus, string> = {
  ENVIADO_TRANSPORTADORA: 'Aguardando transportadora',
  SOLICITADO:             'Solicitação recebida',
  LIBERADO:               'Liberado',
}

/** Validade do agendamento após a liberação (regra da fábrica). */
export const VALIDADE_LIBERACAO_HORAS = 48
