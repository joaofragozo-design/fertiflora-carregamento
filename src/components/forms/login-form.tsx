'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Eye, EyeOff } from 'lucide-react'
import { loginSchema, type LoginInput } from '@/lib/validations/auth'
import { createClient } from '@/lib/supabase/client'
import { AuthService } from '@/services/auth.service'
import { ROUTES } from '@/constants/routes'
import { cn } from '@/lib/utils'
import { useLoginSceneExit } from '@/components/login/login-scene'

interface LoginFormProps {
  supabaseConfigured?: boolean
}

export function LoginForm({ supabaseConfigured = true }: LoginFormProps) {
  const searchParams = useSearchParams()
  const sairDaCena = useLoginSceneExit()
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: '', password: '' },
  })

  async function onSubmit(data: LoginInput) {
    if (!supabaseConfigured) {
      toast.error('Configure as variáveis do Supabase no .env.local antes de continuar.')
      return
    }

    try {
      const supabase = createClient()
      const service  = new AuthService(supabase)
      const user     = await service.signIn(data)

      toast.success(`Bem-vindo, ${user.username}!`)

      // Navegação completa (não client-side) garante que os cookies de sessão
      // do Supabase sejam enviados na próxima request SSR ao DashboardLayout.
      // router.push + router.refresh criam corrida de condição nos cookies.
      const next        = searchParams.get('next')
      const destination = next ?? ROUTES.CARREGAMENTO
      // O caminhão sai da balança antes da troca de tela (imediato com reduced-motion).
      await sairDaCena()
      window.location.href = destination
    } catch (err) {
      console.error('[LoginForm] Falha no login:', err)
      const message = err instanceof Error ? err.message : String(err)
      toast.error(message, { duration: message.length > 60 ? 8000 : 5000 })
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="pt-1">
      <div className="mb-4">
        <label htmlFor="username" className="block text-[10px] tracking-[.08em] uppercase text-ticket-soft mb-1">
          Usuário
        </label>
        <input
          id="username"
          type="text"
          placeholder="operador.logistica"
          autoComplete="username"
          autoFocus
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          disabled={!supabaseConfigured}
          className={cn(
            'w-full bg-transparent border-b-[1.5px] border-dashed border-ticket-rule py-1.5 px-0.5 font-mono text-[15px] text-ticket-ink',
            'placeholder:text-ticket-soft/70 focus:outline-none focus:border-solid focus:border-brand-600',
            errors.username && 'border-danger-600',
          )}
          {...register('username')}
        />
        {errors.username && <p className="mt-1 text-xs text-danger-600">{errors.username.message}</p>}
      </div>

      <div className="mb-5 relative">
        <label htmlFor="password" className="block text-[10px] tracking-[.08em] uppercase text-ticket-soft mb-1">
          Senha
        </label>
        <input
          id="password"
          type={showPassword ? 'text' : 'password'}
          placeholder="••••••••"
          autoComplete="current-password"
          disabled={!supabaseConfigured}
          className={cn(
            'w-full bg-transparent border-b-[1.5px] border-dashed border-ticket-rule py-1.5 px-0.5 pr-7 font-mono text-[15px] text-ticket-ink',
            'placeholder:text-ticket-soft/70 focus:outline-none focus:border-solid focus:border-brand-600',
            errors.password && 'border-danger-600',
          )}
          {...register('password')}
        />
        <button
          type="button"
          onClick={() => setShowPassword((v) => !v)}
          className="absolute right-0.5 bottom-1.5 text-ticket-soft hover:text-ticket-ink transition-colors"
          aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
          disabled={!supabaseConfigured}
        >
          {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
        {errors.password && <p className="mt-1 text-xs text-danger-600">{errors.password.message}</p>}
      </div>

      <button
        type="submit"
        disabled={!supabaseConfigured || isSubmitting}
        className={cn(
          'w-full py-3 rounded-[2px] border-2 border-brand-600 bg-brand-600 text-ticket-paper',
          'font-mono font-extrabold uppercase tracking-[.08em] text-sm transition-colors',
          'hover:bg-brand-500 hover:border-brand-500 disabled:opacity-50 disabled:pointer-events-none',
        )}
      >
        {isSubmitting ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  )
}
