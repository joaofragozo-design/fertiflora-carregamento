import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { AlertTriangle } from 'lucide-react'
import { LoginForm } from '@/components/forms/login-form'
import { Spinner } from '@/components/ui/spinner'
import { LogoMark } from '@/components/brand/logo'
import { getAuthContext } from '@/lib/supabase/get-user'
import { ROLE_DEFAULT_ROUTES, ROUTES } from '@/constants/routes'

const VALUE_PROPS = [
  'Rastreamento de carregamento em tempo real, por turno',
  'Controle de fórmulas, ordens e programação de produção',
  'Auditoria completa de entrada, saída e transportadora',
]

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

export default async function LoginPage() {
  const { profile } = await getAuthContext()
  if (profile) {
    const destination = ROLE_DEFAULT_ROUTES[profile.role] ?? ROUTES.CARREGAMENTO
    redirect(destination)
  }

  const configured = isSupabaseConfigured()

  return (
    <main className="min-h-screen bg-paper-50 lg:grid lg:grid-cols-[1.35fr_1fr]">
      {/* Painel de marca */}
      <div className="relative flex flex-col justify-between overflow-hidden bg-gradient-to-br from-spruce-800 via-spruce-900 to-spruce-900 px-6 py-10 text-paper-900 md:px-12 md:py-14 lg:min-h-screen">
        <LogoMark
          size={340}
          className="pointer-events-none absolute -bottom-16 -right-16 opacity-[0.08] grayscale brightness-[3] lg:block hidden"
        />

        <div className="relative">
          <div className="flex items-center gap-3">
            <LogoMark size={30} />
            <span className="font-mono text-xs tracking-[0.24em] text-paper-700">
              SISTEMA DE CARREGAMENTO
            </span>
          </div>

          <h1 className="mt-9 max-w-[14ch] text-balance font-display text-4xl font-semibold leading-[1.12] text-paper-900 xl:text-5xl">
            Controle industrial com a solidez que a operação exige.
          </h1>

          <ul className="mt-10 flex flex-col gap-3.5">
            {VALUE_PROPS.map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm leading-relaxed text-paper-700">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rotate-45 bg-gradient-to-br from-leaf-400 to-leaf-600" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative mt-10 text-xs text-paper-500 lg:mt-0">
          Fertiflora Organomineral — Unidade industrial
        </p>
      </div>

      {/* Painel do card */}
      <div className="flex items-center justify-center px-6 py-12 md:px-12 lg:min-h-screen">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-spruce-800 to-spruce-900 shadow-[0_8px_20px_-8px_rgba(6,40,21,0.55)]">
            <LogoMark size={26} />
          </div>

          <h2 className="font-display text-2xl font-semibold text-paper-900">Acesso ao sistema</h2>
          <p className="mt-1 text-sm text-paper-600">Informe seu usuário e senha</p>

          {!configured && (
            <div className="mt-5 flex items-start gap-3 rounded-lg border border-warning-500/25 bg-warning-500/8 p-3.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-500" />
              <div className="text-xs">
                <p className="font-semibold text-warning-400">Configuração pendente</p>
                <p className="mt-1 text-paper-600">
                  Adicione as credenciais do Supabase no{' '}
                  <code className="rounded bg-paper-800/10 px-1 font-mono">.env.local</code>
                </p>
              </div>
            </div>
          )}

          <div className="mt-6">
            <Suspense fallback={
              <div className="flex justify-center py-6">
                <Spinner size="md" />
              </div>
            }>
              <LoginForm supabaseConfigured={configured} />
            </Suspense>
          </div>

          <p className="mt-7 text-center text-[11px] text-paper-500">
            © {new Date().getFullYear()} Fertiflora Organomineral. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </main>
  )
}
