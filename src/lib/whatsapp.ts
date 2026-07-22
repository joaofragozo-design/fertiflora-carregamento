import type { Embalagem } from '@/types/formula'
import { EMBALAGEM_LABEL } from '@/types/formula'
import { VALIDADE_LIBERACAO_HORAS } from '@/types/transportadora'

// Envio de WhatsApp pro motorista. Hoje o disparo é semi-automático: ao
// liberar a solicitação, o sistema monta a mensagem completa e abre o
// WhatsApp já no número do motorista (link wa.me) — falta só apertar enviar.
// Quando houver um provedor de envio 100% automático (Meta Cloud API etc.),
// basta trocar a implementação de `linkWhatsApp` por uma chamada de API,
// mantendo `montarMensagemLiberacao` como está.

/** Normaliza o número pro formato do wa.me: só dígitos, com DDI 55. */
export function normalizarWhatsapp(raw: string): string {
  let digitos = raw.replace(/\D/g, '')
  // Remove zero de operadora/discagem à esquerda (ex.: 045...)
  digitos = digitos.replace(/^0+/, '')
  // 10-11 dígitos = DDD + número sem DDI → prefixa o 55 do Brasil
  if (digitos.length === 10 || digitos.length === 11) digitos = `55${digitos}`
  return digitos
}

/** Link "clique pra enviar" do WhatsApp com a mensagem pré-preenchida. */
export function linkWhatsApp(numero: string, texto: string): string {
  return `https://wa.me/${normalizarWhatsapp(numero)}?text=${encodeURIComponent(texto)}`
}

interface ItemLiberacao {
  formulaMascarada: string // já mascarada (ex.: "02-06-08") — nunca o nome completo
  quantidade:       number
  embalagem:        Embalagem
}

interface MensagemLiberacaoParams {
  motorista:      string
  transportadora: string
  data:           string // YYYY-MM-DD
  itens:          ItemLiberacao[]
}

/**
 * Mensagem enviada ao motorista quando a Logística libera a solicitação.
 * Inclui as orientações e regras da fábrica (PDF "Orientação de Carregamento").
 */
export function montarMensagemLiberacao({ motorista, transportadora, data, itens }: MensagemLiberacaoParams): string {
  const dataFormatada = new Date(data + 'T12:00:00').toLocaleDateString('pt-BR')
  const temSacaria = itens.some((it) => it.embalagem === 'SACOS')

  const linhasCarga = itens
    .map((it) => `• ${it.quantidade} ${EMBALAGEM_LABEL[it.embalagem]} — Fórmula ${it.formulaMascarada}`)
    .join('\n')

  const regras = [
    `• Este agendamento tem validade de ${VALIDADE_LIBERACAO_HORAS} horas.`,
    ...(temSacaria ? ['• Carga em SACARIA: apresentar-se até as 10h da manhã.'] : []),
    '• Não há horário marcado: o carregamento segue a ordem definida pela indústria (veículos com a mesma fórmula carregam em sequência).',
    '• Aguarde dentro do caminhão até ser chamado — não circule pelas dependências da fábrica.',
    '• O veículo deve estar limpo, sem resíduos, com lona em bom estado e cinta/cabo. Caminhão não preparado volta para o fim da fila.',
    '• A ordem da indústria é soberana.',
  ].join('\n')

  return [
    `Olá, ${motorista}! Aqui é da FERTIFLORA Fertilizantes.`,
    '',
    '✅ Seu carregamento foi LIBERADO.',
    '',
    `📅 Data: ${dataFormatada}`,
    `🚛 Transportadora: ${transportadora}`,
    '📦 Carga:',
    linhasCarga,
    '',
    '⚠️ ORIENTAÇÕES DA FÁBRICA:',
    regras,
  ].join('\n')
}
