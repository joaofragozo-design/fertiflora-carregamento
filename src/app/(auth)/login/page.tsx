import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { AlertTriangle } from 'lucide-react'
import { LoginForm } from '@/components/forms/login-form'
import { Spinner } from '@/components/ui/spinner'
import { Ticket } from '@/components/ui/ticket'
import { LoginScene, type CarregadoSemana } from '@/components/login/login-scene'
import { EmitidoStamp } from '@/components/login/emitido-stamp'
import { LogoMark } from '@/components/brand/logo'
import { getAuthContext } from '@/lib/supabase/get-user'
import { ROLE_DEFAULT_ROUTES, ROUTES } from '@/constants/routes'

export const metadata: Metadata = {
  title: 'Acesso',
}

function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return (
    !!url && !!key &&
    !url.includes('your_supabase') &&
    !key.includes('your_supabase')
  )
}

function iso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Hoje no fuso da fábrica (a Vercel roda em UTC; domingo à noite já seria "segunda" lá). */
function hojeEmBrasilia(): Date {
  const [y, m, d] = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date()).split('-').map(Number)
  return new Date(y, m - 1, d, 12)
}

/**
 * Total carregado na semana corrente (seg–sáb), pela mesma régua do relatório
 * diário: ordens diárias FINALIZADAS, tonelagem = soma dos itens. O login não
 * tem sessão (RLS bloqueia o anon), então lê com o service role no servidor —
 * é um agregado sem nenhum dado de cliente. Qualquer falha vira `null` e o
 * painel mostra "sem leitura" em vez de um número inventado.
 */
async function carregadoNaSemana(): Promise<CarregadoSemana | null> {
  try {
    const { supabaseAdmin } = await import('@/lib/supabase/admin')
    const hoje = hojeEmBrasilia()
    const dow = hoje.getDay() // 0 = domingo
    const segunda = new Date(hoje)
    segunda.setDate(hoje.getDate() + (dow === 0 ? -6 : 1 - dow))
    const sabado = new Date(segunda)
    sabado.setDate(segunda.getDate() + 5)
    const inicio = iso(segunda)
    const fim = iso(sabado)

    const { data, error } = await supabaseAdmin
      .from('ordens_diarias')
      .select('id, itens:ordem_itens(tons)')
      .eq('finalizado', true)
      .gte('data', inicio)
      .lte('data', fim)
    if (error) throw error

    const ordens = (data ?? []) as { id: string; itens: { tons: number | null }[] | null }[]
    const tons = ordens.reduce((s, o) => s + (o.itens ?? []).reduce((a, i) => a + (i.tons ?? 0), 0), 0)
    return { tons, cargas: ordens.length, inicio, fim }
  } catch (err) {
    console.error('[login] total carregado na semana indisponível:', err)
    return null
  }
}

export default async function LoginPage() {
  const { profile } = await getAuthContext()
  if (profile) {
    const destination = ROLE_DEFAULT_ROUTES[profile.role] ?? ROUTES.CARREGAMENTO
    redirect(destination)
  }

  const configured = isSupabaseConfigured()
  const carregado = configured ? await carregadoNaSemana() : null

  return (
    <LoginScene carregado={carregado}>
      {!configured && (
        <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-warning-500/25 bg-warning-500/10 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-400" />
          <div className="text-xs">
            <p className="font-semibold text-warning-400">Configuração pendente</p>
            <p className="mt-1 text-industrial-600">
              Adicione as credenciais do Supabase no{' '}
              <code className="rounded bg-industrial-200 px-1 font-mono">.env.local</code>
            </p>
          </div>
        </div>
      )}

      {/* 1ª via impressa pela balança: formulário contínuo com furos de tracionamento. */}
      <Ticket variant="continuo" seq="Nº 000001" seqTitle="Documento de acesso" className="px-[34px] pb-12 pt-8 [@media(max-height:760px)]:pb-10 [@media(max-height:760px)]:pt-6">
        <p className="text-center text-[11px] tracking-[.22em] text-ticket-soft">1ª VIA · ACESSO</p>
        <div className="ticket-dash mt-2.5" />

        <div className="flex items-center justify-center gap-2 pb-2 pt-5">
          <LogoMark size={26} />
          <span className="font-mono text-[27px] font-extrabold tracking-tight text-ticket-ink">
            <span className="text-brand-600">Ferti</span>Log
          </span>
        </div>

        <Suspense fallback={
          <div className="flex justify-center py-6">
            <Spinner size="md" />
          </div>
        }>
          <LoginForm supabaseConfigured={configured} />
        </Suspense>
        <EmitidoStamp />
      </Ticket>
    </LoginScene>
  )
}
