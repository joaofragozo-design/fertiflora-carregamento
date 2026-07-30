import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { FABRICA_COORDS, RAIO_CHEGADA_METROS, distanciaMetros } from '@/lib/geo'

// Recebe uma atualização de posição do motorista enquanto ele mantém a
// página /chegada/[id] aberta compartilhando localização. Grava só a
// posição mais recente (não um histórico) e, se ela já estiver dentro do
// raio da fábrica e a chegada ainda não tiver sido confirmada, confirma
// sozinha — sem o motorista precisar tocar em nada.
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
    .select('id, confirmado_em')
    .eq('id', id)
    .single()

  if (fetchError || !recebimento) {
    return NextResponse.json({ error: 'Recebimento não encontrado.' }, { status: 404 })
  }

  const distancia = Math.round(distanciaMetros(FABRICA_COORDS, { lat, lng }))
  const dentroDoRaio = distancia <= RAIO_CHEGADA_METROS

  const update: Record<string, unknown> = {
    motorista_lat: lat,
    motorista_lng: lng,
    motorista_localizacao_em: new Date().toISOString(),
  }

  // Já dentro do raio e ainda não confirmado → confirma a chegada junto,
  // sem exigir um toque extra do motorista.
  let confirmouAgora = false
  if (dentroDoRaio && !recebimento.confirmado_em) {
    update.confirmado_em = new Date().toISOString()
    update.confirmado_por = `Motorista (GPS ao vivo · ${distancia}m do portão)`
    update.recebido = true
    confirmouAgora = true
  }

  const { error: updateError } = await supabaseAdmin
    .from('recebimentos_previstos')
    .update(update)
    .eq('id', id)

  if (updateError) {
    console.error('[api/recebimento/localizacao]', updateError.message)
    return NextResponse.json({ error: 'Erro ao atualizar localização.' }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    distanciaMetros: distancia,
    dentroDoRaio,
    confirmado: confirmouAgora || !!recebimento.confirmado_em,
  })
}
