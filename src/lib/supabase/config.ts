/**
 * Validação centralizada das variáveis de ambiente do Supabase.
 *
 * Regras:
 * - Lançar erro descritivo em runtime (não silencioso).
 * - Nunca crashar com "Invalid URL" ou "404" sem contexto.
 * - Rejeitar URLs com path (/rest/v1, /auth/v1, etc.) — causa 404 no SDK.
 */

function assertEnv(name: string, value: string | undefined): string {
  if (!value || value.trim() === '') {
    throw new Error(
      `[Supabase] Variável de ambiente ausente: "${name}"\n` +
      `Adicione o valor correto no arquivo .env.local e reinicie o servidor.`
    )
  }

  const PLACEHOLDER_PATTERNS = ['your_supabase', 'your-supabase', 'placeholder', 'xxxx', '<', '>']
  if (PLACEHOLDER_PATTERNS.some((p) => value.toLowerCase().includes(p))) {
    throw new Error(
      `[Supabase] "${name}" ainda contém um valor de exemplo: "${value}"\n` +
      `Substitua pelo valor real do seu projeto em .env.local.`
    )
  }

  return value.trim()
}

function assertSupabaseUrl(value: string | undefined): string {
  const raw = assertEnv('NEXT_PUBLIC_SUPABASE_URL', value)

  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    throw new Error(
      `[Supabase] NEXT_PUBLIC_SUPABASE_URL não é uma URL válida: "${raw}"\n` +
      `Formato esperado: https://<projeto>.supabase.co`
    )
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(
      `[Supabase] NEXT_PUBLIC_SUPABASE_URL tem protocolo inválido: "${parsed.protocol}"\n` +
      `Use https://`
    )
  }

  // O SDK constrói os paths internamente (auth/v1, rest/v1, etc.).
  // Se a URL já contiver um path, todos os endpoints ficam errados → 404.
  if (parsed.pathname !== '/' && parsed.pathname !== '') {
    throw new Error(
      `[Supabase] NEXT_PUBLIC_SUPABASE_URL não deve conter um path.\n` +
      `  Recebido : "${raw}"\n` +
      `  Correto  : "${parsed.origin}"\n` +
      `\n` +
      `O SDK monta /auth/v1, /rest/v1, /realtime/v1 automaticamente.\n` +
      `Remova tudo depois do domínio no .env.local.`
    )
  }

  return parsed.origin  // https://xxx.supabase.co  (sem trailing slash)
}

// Cache lazy — não avalia durante o build estático
let _url: string | null = null
let _anonKey: string | null = null

export function getSupabaseUrl(): string {
  if (!_url) {
    _url = assertSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)
  }
  return _url
}

export function getSupabaseAnonKey(): string {
  if (!_anonKey) {
    _anonKey = assertEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  }
  return _anonKey
}
