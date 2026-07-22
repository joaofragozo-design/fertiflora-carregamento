import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/get-user'
import { supabaseAdmin } from '@/lib/supabase/admin'

// Cria o login de uma transportadora (auth user + profile role 'transportadora'
// + registro em `transportadoras`). Restrito a admin/logistica — criar usuário
// no Supabase Auth exige a service role, por isso é uma rota de API e não uma
// chamada direta do browser.
export async function POST(req: NextRequest) {
  const { sessionUser, profile } = await getAuthContext()
  if (!sessionUser || !profile || !['admin', 'logistica'].includes(profile.role)) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  let body: { nome?: string; username?: string; senha?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }

  const nome = (body.nome ?? '').trim()
  const username = (body.username ?? '').trim().toLowerCase()
  const senha = body.senha ?? ''

  if (!nome) {
    return NextResponse.json({ error: 'Informe o nome da transportadora.' }, { status: 400 })
  }
  if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
    return NextResponse.json(
      { error: 'Usuário inválido: use 3 a 32 caracteres (letras minúsculas, números, ponto, hífen ou underline).' },
      { status: 400 },
    )
  }
  if (senha.length < 6) {
    return NextResponse.json({ error: 'A senha precisa ter pelo menos 6 caracteres.' }, { status: 400 })
  }

  // Mesmo padrão de login do app: o e-mail no Supabase Auth é um e-mail fake
  // username@fertiflora.local, e o trigger handle_new_user cria o profile com
  // o role vindo do metadata.
  const { data: created, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: `${username}@fertiflora.local`,
    password: senha,
    email_confirm: true,
    user_metadata: { username, name: nome, role: 'transportadora' },
  })

  if (authError || !created?.user) {
    const msg = authError?.message ?? ''
    if (msg.includes('already') || msg.includes('registered')) {
      return NextResponse.json({ error: 'Já existe um usuário com esse nome de login.' }, { status: 409 })
    }
    console.error('[api/transportadoras] auth', msg)
    return NextResponse.json({ error: 'Erro ao criar o usuário. Tente novamente.' }, { status: 500 })
  }

  const { data: transportadora, error: dbError } = await supabaseAdmin
    .from('transportadoras')
    .insert({ nome, profile_id: created.user.id })
    .select('*')
    .single()

  if (dbError) {
    // Evita usuário órfão sem transportadora (as duas criações não são atômicas).
    await supabaseAdmin.auth.admin.deleteUser(created.user.id)
    if (dbError.message.includes('transportadoras')) {
      return NextResponse.json(
        { error: 'Tabela de transportadoras não encontrada — rode as migrations 057/058 no Supabase.' },
        { status: 503 },
      )
    }
    console.error('[api/transportadoras] db', dbError.message)
    return NextResponse.json({ error: 'Erro ao cadastrar a transportadora. Tente novamente.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, transportadora, username })
}
