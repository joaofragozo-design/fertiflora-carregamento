import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/get-user'
import { createClient } from '@/lib/supabase/server'
import { ProgramacaoService } from '@/services/programacao.service'
import { mascararNomeFormula } from '@/types/formula'
import { gerarPdfOrdemCarregamento } from '@/lib/pdf/ordem-carregamento'

const PODE_GERAR = ['admin', 'logistica', 'logistica_02', 'faturamento']

// Gera o PDF da ordem de carregamento (modelo real usado pela Logística) —
// só existe depois que a Logística libera a solicitação (é a liberação que
// atribui o numero_ordem, migration 067). Acessível a quem pode VER a
// Programação (não só editar) — é um documento de consulta/impressão.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { sessionUser, profile } = await getAuthContext()
  if (!sessionUser || !profile || !PODE_GERAR.includes(profile.role)) {
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
  if (!ag.numero_ordem || !ag.liberado_em) {
    return NextResponse.json({ error: 'Esta solicitação ainda não foi liberada.' }, { status: 400 })
  }

  const placasCarreta = [ag.motorista?.placa_1, ag.motorista?.placa_2, ag.motorista?.placa_3, ag.motorista?.placa_4]
    .filter((p): p is string => Boolean(p))

  const pdf = await gerarPdfOrdemCarregamento({
    numeroOrdem: ag.numero_ordem,
    data: ag.data,
    pedido: ag.cliente_codigo,
    cliente: ag.cliente,
    itens: (ag.itens ?? []).map((it) => ({
      produto: it.formula?.nome ? mascararNomeFormula(it.formula.nome) : '—',
      destino: '',
      embalagem: it.embalagem,
      quantidade: it.quantidade,
      tons: it.tons,
    })),
    transportadoraNome: ag.transportadora?.nome ?? '—',
    transportadoraCnpj: ag.transportadora?.cnpj ?? null,
    motoristaNome: ag.motorista?.nome ?? '—',
    motoristaCpf: ag.motorista?.cpf ?? '',
    motoristaRg: ag.motorista?.rg ?? '',
    motoristaCnh: ag.motorista?.cnh ?? '',
    motoristaWhatsapp: ag.motorista?.whatsapp ?? '',
    placaCavalo: ag.motorista?.placa_cavalo ?? '',
    placasCarreta,
    liberadoEm: ag.liberado_em,
    liberadoPor: ag.liberado_por ?? '',
    observacao: ag.observacao ?? '',
  })

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="ordem-carregamento-${String(ag.numero_ordem).padStart(6, '0')}.pdf"`,
    },
  })
}
