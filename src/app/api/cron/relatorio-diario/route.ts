import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { enviarRelatorioDiario, dataAlvoCron } from '@/lib/relatorio-email'

// Disparado pela Vercel Cron (vercel.json) às 23:59 (horário de Brasília).
// Sem sessão de usuário — a Vercel injeta `Authorization: Bearer $CRON_SECRET`
// automaticamente quando essa env var existe; validamos aqui pra ninguém mais
// conseguir chamar esse endpoint e disparar e-mails à toa.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET não configurado.' }, { status: 503 })
  }
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  const data = dataAlvoCron()
  console.log('[cron/relatorio-diario] disparado', new Date().toISOString(), '→ data-alvo', data)
  const resultado = await enviarRelatorioDiario(supabaseAdmin, data)

  if ('error' in resultado) {
    console.error('[cron/relatorio-diario]', resultado.error)
    return NextResponse.json({ error: resultado.error }, { status: resultado.status })
  }
  return NextResponse.json(resultado)
}
