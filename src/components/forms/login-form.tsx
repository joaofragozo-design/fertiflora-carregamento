'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Eye, EyeOff, LogIn, User } from 'lucide-react'
import { loginSchema, type LoginInput } from '@/lib/validations/auth'
import { createClient } from '@/lib/supabase/client'
import { AuthService } from '@/services/auth.service'
import { ROUTES } from '@/constants/routes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface LoginFormProps {
  supabaseConfigured?: boolean
}

export function LoginForm({ supabaseConfigured = true }: LoginFormProps) {
  const router      = useRouter()
  const searchParams = useSearchParams()
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
      console.log('[LoginForm] navegando para:', destination)
      window.location.href = destination
    } catch (err) {
      console.error('[LoginForm] Falha no login:', err)
      const message = err instanceof Error ? err.message : String(err)
      toast.error(message, { duration: message.length > 60 ? 8000 : 5000 })
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <div className="relative">
        <Input
          label="Usuário"
          type="text"
          placeholder="nome_usuario"
          autoComplete="username"
          autoFocus
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          disabled={!supabaseConfigured}
          error={errors.username?.message}
          {...register('username')}
        />
        <User className="pointer-events-none absolute right-3 top-[34px] h-4 w-4 text-industrial-500" />
      </div>

      <div className="relative">
        <Input
          label="Senha"
          type={showPassword ? 'text' : 'password'}
          placeholder="••••••••"
          autoComplete="current-password"
          disabled={!supabaseConfigured}
          error={errors.password?.message}
          {...register('password')}
        />
        <button
          type="button"
          onClick={() => setShowPassword((v) => !v)}
          className="absolute right-3 top-[34px] text-industrial-400 hover:text-industrial-200 transition-colors"
          aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
          tabIndex={-1}
          disabled={!supabaseConfigured}
        >
          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>

      <Button
        type="submit"
        size="lg"
        loading={isSubmitting}
        disabled={!supabaseConfigured}
        className="w-full mt-2"
      >
        {!isSubmitting && <LogIn className="h-4 w-4" />}
        Entrar
      </Button>
    </form>
  )
}
