import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { AlertTriangle } from 'lucide-react'
import { LoginForm } from '@/components/forms/login-form'
import { Spinner } from '@/components/ui/spinner'
import { LogoMark } from '@/components/brand/logo'
import { getAuthContext } from '@/lib/supabase/get-user'
import { ROLE_DEFAULT_ROUTES, ROUTES } from '@/constants/routes'

export const metadata: Metadata = {
  title: 'Acesso — Fertiflora',
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
    <main className="flex min-h-screen flex-col items-center justify-center bg-industrial-950 p-4">
      <div className="w-full max-w-xs space-y-7">

        {/* Marca */}
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-industrial-900 border border-industrial-800 shadow-industrial">
            <LogoMark size={42} />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-[0.15em] text-industrial-100">
              FERTIFLORA
            </h1>
            <p className="mt-0.5 text-xs font-medium tracking-wider text-[#6BBF6A]">
              organomineral
            </p>
            <p className="mt-2 text-xs text-industrial-500">
              Sistema de Controle de Carregamento
            </p>
          </div>
        </div>

        {/* Aviso Supabase não configurado */}
        {!configured && (
          <div className="flex items-start gap-3 rounded-lg border border-warning-500/25 bg-warning-500/8 p-3.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-400" />
            <div className="text-xs">
              <p className="font-semibold text-warning-300">Configuração pendente</p>
              <p className="mt-1 text-warning-400/70">
                Adicione as credenciais do Supabase no{' '}
                <code className="rounded bg-black/30 px-1 font-mono">.env.local</code>
              </p>
            </div>
          </div>
        )}

        {/* Card de login */}
        <div className="rounded-xl border border-industrial-800 bg-industrial-900 p-6 shadow-industrial">
          <h2 className="mb-1 text-sm font-semibold text-industrial-200">Acesso ao sistema</h2>
          <p className="mb-5 text-xs text-industrial-600">Informe seu usuário e senha</p>

          <Suspense fallback={
            <div className="flex justify-center py-6">
              <Spinner size="md" />
            </div>
          }>
            <LoginForm supabaseConfigured={configured} />
          </Suspense>
        </div>

        <p className="text-center text-[11px] text-industrial-500">
          © {new Date().getFullYear()} Fertiflora Organomineral. Todos os direitos reservados.
        </p>
      </div>
    </main>
  )
}
