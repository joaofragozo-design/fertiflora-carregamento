import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/get-user'
import { createClient } from '@/lib/supabase/server'
import { enviarRelatorioDiario, hojeBrasil } from '@/lib/relatorio-email'

export async function POST(req: NextRequest) {
  const { sessionUser } = await getAuthContext()
  if (!sessionUser) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  let body: { data?: string }
  try {
    body = await req.json()
  } catch {
    body = {}
  }
  const data = body.data && /^\d{4}-\d{2}-\d{2}$/.test(body.data)
    ? body.data
    : hojeBrasil()

  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const resultado = await enviarRelatorioDiario(supabase as any, data)

  if ('error' in resultado) {
    return NextResponse.json({ error: resultado.error }, { status: resultado.status })
  }
  return NextResponse.json(resultado)
}
