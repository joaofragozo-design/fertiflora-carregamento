import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/get-user'
import { createClient } from '@/lib/supabase/server'
import { ProgramacaoService } from '@/services/programacao.service'
import { montarMensagemLiberacao, linkWhatsApp } from '@/lib/whatsapp'
import { enviarWhatsappAutomatico } from '@/lib/whatsapp-wuzapi'
import { mascararNomeFormula } from '@/types/formula'

const PODE_ENVIAR = ['admin', 'logistica']

// Envia (via WuzAPI) a mensagem de liberação pro motorista e marca
// whatsapp_enviado_em. Se o envio automático falhar (WuzAPI fora do ar,
// número desconectado etc.), devolve o link wa.me pra abrir manualmente —
// a fila não trava esperando o self-host voltar.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { sessionUser, profile } = await getAuthContext()
  if (!sessionUser || !profile || !PODE_ENVIAR.includes(profile.role)) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  const { id } = await params
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = new ProgramacaoService(supabase as any)

  const ag = await svc.getById(id).catch(() => null)
  if (!ag) {
    return NextResponse.json({ error: 'Solicitação não encontrada.' }, { status: 404 })
  }
  if (ag.solicitacao_status !== 'LIBERADO') {
    return NextResponse.json({ error: 'Esta solicitação ainda não foi liberada.' }, { status: 400 })
  }
  if (!ag.motorista?.whatsapp) {
    return NextResponse.json({ error: 'Motorista sem WhatsApp cadastrado.' }, { status: 400 })
  }

  const mensagem = montarMensagemLiberacao({
    motorista: ag.motorista.nome,
    transportadora: ag.transportadora?.nome ?? '',
    data: ag.data,
    itens: (ag.itens ?? []).map((it) => ({
      formulaMascarada: it.formula?.nome ? mascararNomeFormula(it.formula.nome) : '—',
      quantidade: it.quantidade,
      embalagem: it.embalagem,
    })),
  })

  const resultado = await enviarWhatsappAutomatico(ag.motorista.whatsapp, mensagem)
  if (!resultado.ok) {
    return NextResponse.json({
      error: resultado.erro ?? 'Falha ao enviar automaticamente.',
      linkManual: linkWhatsApp(ag.motorista.whatsapp, mensagem),
    }, { status: 502 })
  }

  const upd = await svc.marcarWhatsappEnviado(ag.id)
  return NextResponse.json({ ok: true, agendamento: upd })
}
