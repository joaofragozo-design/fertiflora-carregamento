import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { FABRICA_COORDS, RAIO_CHEGADA_METROS, distanciaMetros } from '@/lib/geo'

// Confirma a chegada de um recebimento de matéria-prima a partir do GPS do
// próprio motorista — sem exigir login (o motorista não tem conta no
// sistema). Segurança: o id é um UUID praticamente impossível de adivinhar
// (mesmo padrão de "link mágico"), a rota só aceita a transição
// null → confirmado uma única vez, e a confirmação só acontece se a
// coordenada enviada estiver de fato dentro do raio da fábrica — não basta
// ter o link, precisa estar no local. Usa a service role porque não há
// usuário autenticado (RLS normal não se aplica aqui).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  let body: { lat?: number; lng?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }

  const { lat, lng } = body
  if (typeof lat !== 'number' || typeof lng !== 'number' || Number.isNaN(lat) || Number.isNaN(lng)) {
    return NextResponse.json({ error: 'Localização inválida.' }, { status: 400 })
  }

  const { data: recebimento, error: fetchError } = await supabaseAdmin
    .from('recebimentos_previstos')
    .select('id, confirmado_em, materia_prima, materia_prima_key, quantidade_ton')
    .eq('id', id)
    .single()

  if (fetchError || !recebimento) {
    return NextResponse.json({ error: 'Recebimento não encontrado.' }, { status: 404 })
  }
  if (recebimento.confirmado_em) {
    return NextResponse.json({ error: 'Esta chegada já foi confirmada.', jaConfirmado: true }, { status: 409 })
  }

  const distancia = Math.round(distanciaMetros(FABRICA_COORDS, { lat, lng }))
  if (distancia > RAIO_CHEGADA_METROS) {
    return NextResponse.json(
      { error: `Você está a ${(distancia / 1000).toFixed(1)} km da fábrica — chegue mais perto do portão pra confirmar.`, distanciaMetros: distancia },
      { status: 422 },
    )
  }

  const { error: updateError } = await supabaseAdmin
    .from('recebimentos_previstos')
    .update({
      confirmado_em: new Date().toISOString(),
      confirmado_por: `Motorista (GPS · ${distancia}m do portão)`,
      recebido: true,
    })
    .eq('id', id)
    .is('confirmado_em', null) // corrida entre duas confirmações simultâneas — só a primeira vale

  if (updateError) {
    console.error('[api/recebimento/confirmar-chegada]', updateError.message)
    return NextResponse.json({ error: 'Erro ao confirmar chegada. Tente novamente.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, distanciaMetros: distancia })
}
