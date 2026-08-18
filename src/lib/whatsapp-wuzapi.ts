import { normalizarWhatsapp } from '@/lib/whatsapp'

interface EnviarResultado {
  ok:   boolean
  erro?: string
}

/**
 * Envia mensagem de texto via WuzAPI (instância self-hosted, ver deploy/wuzapi/).
 * Server-only — lê WUZAPI_BASE_URL/WUZAPI_TOKEN do ambiente; nunca importar
 * este arquivo de um componente client.
 */
export async function enviarWhatsappAutomatico(numero: string, texto: string): Promise<EnviarResultado> {
  const baseUrl = process.env.WUZAPI_BASE_URL
  const token = process.env.WUZAPI_TOKEN
  if (!baseUrl || !token) {
    return { ok: false, erro: 'WuzAPI não configurado (defina WUZAPI_BASE_URL e WUZAPI_TOKEN).' }
  }

  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/send/text`, {
      method: 'POST',
      headers: { Token: token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ Phone: normalizarWhatsapp(numero), Body: texto }),
      signal: AbortSignal.timeout(15_000),
    })
    const json: unknown = await res.json().catch(() => null)
    const sucesso = res.ok && Boolean((json as { success?: boolean } | null)?.success)
    if (!sucesso) {
      const erroApi = (json as { error?: string } | null)?.error
      return { ok: false, erro: erroApi ?? `WuzAPI respondeu ${res.status}.` }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, erro: err instanceof Error ? err.message : 'Falha de rede ao chamar o WuzAPI.' }
  }
}
