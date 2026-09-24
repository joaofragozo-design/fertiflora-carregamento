'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Bell, Truck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Banner {
  id: string
  cliente: string
  data: string
  confirmado_em: string
}

const DISMISSED_KEY = 'ff_chegadas_dismissidas'
const MAX_DISMISSED = 300

/**
 * Marca d'água "visto até" (ISO) por navegador: o catch-up só reapresenta
 * confirmações que aconteceram DEPOIS da última que este navegador já
 * mostrou. Sem isso, cada reload da Logística repetia todas as chegadas do
 * dia (som + balão) como se fossem novas.
 */
const VISTO_ATE_KEY = 'ff_chegadas_visto_ate'
/** Primeiro acesso neste navegador: só o que chegou na última meia hora. */
const JANELA_PRIMEIRO_ACESSO_MS = 30 * 60_000
/** Teto do catch-up mesmo com marca d'água antiga (aba fechada há dias). */
const JANELA_MAXIMA_MS = 12 * 60 * 60_000

function getVistoAte(): number {
  try {
    const v = localStorage.getItem(VISTO_ATE_KEY)
    const t = v ? Date.parse(v) : NaN
    return Number.isFinite(t) ? t : 0
  } catch {
    return 0
  }
}

function marcarVistoAte(iso: string) {
  try {
    const t = Date.parse(iso)
    if (Number.isFinite(t) && t > getVistoAte()) localStorage.setItem(VISTO_ATE_KEY, iso)
  } catch {
    /* localStorage indisponível — ignora */
  }
}

function getDismissed(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? '[]'))
  } catch {
    return new Set()
  }
}

function addDismissed(id: string) {
  const s = getDismissed()
  s.add(id)
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(Array.from(s).slice(-MAX_DISMISSED)))
  } catch {
    /* localStorage indisponível — ignora */
  }
}

/** Beep de duas notas via Web Audio API — sem depender de nenhum arquivo de áudio. */
function tocarBeep() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
    const ctx = new AudioCtx()
    const tom = (freq: number, inicioMs: number, duracaoMs: number) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      osc.connect(gain)
      gain.connect(ctx.destination)
      const t0 = ctx.currentTime + inicioMs / 1000
      gain.gain.setValueAtTime(0.0001, t0)
      gain.gain.exponentialRampToValueAtTime(0.35, t0 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duracaoMs / 1000)
      osc.start(t0)
      osc.stop(t0 + duracaoMs / 1000 + 0.05)
    }
    tom(880, 0, 180)
    tom(1175, 220, 260)
    setTimeout(() => ctx.close(), 700)
  } catch {
    /* AudioContext indisponível ou bloqueado pelo navegador — segue sem som */
  }
}

/**
 * Escuta confirmações de chegada de caminhão (Faturamento → Logística).
 * Toca um som, dispara notificação do sistema (persiste mesmo fora da aba,
 * se o navegador tiver permissão) e mostra um balão que só fecha no X.
 */
export function ConfirmacaoChegadaListener() {
  const [mounted, setMounted] = useState(false)
  const [banners, setBanners] = useState<Banner[]>([])
  const [notifPermitida, setNotifPermitida] = useState(false)
  const supabase = useRef(createClient()).current

  useEffect(() => {
    setMounted(true)
    setNotifPermitida(typeof Notification !== 'undefined' && Notification.permission === 'granted')
  }, [])

  const enfileirar = useCallback((b: Banner) => {
    marcarVistoAte(b.confirmado_em)
    if (getDismissed().has(b.id)) return
    setBanners((prev) => (prev.some((x) => x.id === b.id) ? prev : [...prev, b]))
    tocarBeep()
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        const n = new Notification('Caminhão chegou 🚚', {
          body: `${b.cliente || 'Cliente'} — confirmado pelo faturamento`,
          requireInteraction: true,
          tag: `chegada-${b.id}`,
        })
        n.onclick = () => window.focus()
      } catch {
        /* navegador pode bloquear a criação direta da Notification — ignora */
      }
    }
  }, [])

  // Catch-up: confirmações que aconteceram depois da última que este navegador
  // viu (ex.: aba fechada na hora). Filtra por `confirmado_em` (o momento da
  // chegada), não pela data programada — e nunca reapresenta o que já passou
  // pela marca d'água, senão todo reload repete o dia inteiro.
  useEffect(() => {
    let cancelado = false
    ;(async () => {
      const agora = Date.now()
      const vistoAte = getVistoAte()
      const desde = new Date(Math.max(vistoAte || agora - JANELA_PRIMEIRO_ACESSO_MS, agora - JANELA_MAXIMA_MS)).toISOString()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('programacao_carregamento')
        .select('id, cliente, data, confirmado_em')
        .gt('confirmado_em', desde)
        .order('confirmado_em', { ascending: true })
      if (cancelado) return
      for (const row of (data ?? []) as Banner[]) enfileirar(row)
    })()
    return () => { cancelado = true }
  }, [supabase, enfileirar])

  // Ao vivo: qualquer UPDATE que ligue confirmado_em (estava vazio, agora tem valor).
  useEffect(() => {
    const channel = supabase
      .channel('confirmacoes_chegada')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'programacao_carregamento' },
        (payload) => {
          const novo = payload.new as { id: string; cliente: string; data: string; confirmado_em: string | null }
          const antigo = payload.old as { confirmado_em?: string | null } | undefined
          if (novo.confirmado_em && !antigo?.confirmado_em) {
            enfileirar({ id: novo.id, cliente: novo.cliente, data: novo.data, confirmado_em: novo.confirmado_em })
          }
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase, enfileirar])

  function fechar(id: string) {
    addDismissed(id)
    setBanners((prev) => prev.filter((b) => b.id !== id))
  }

  async function ativarNotificacoes() {
    tocarBeep() // mesmo gesto do usuário também desbloqueia o áudio no navegador
    if (typeof Notification === 'undefined') return
    const permissao = await Notification.requestPermission()
    setNotifPermitida(permissao === 'granted')
  }

  if (!mounted) return null

  return createPortal(
    <>
      {!notifPermitida && (
        <button
          type="button"
          onClick={ativarNotificacoes}
          className="fixed bottom-4 right-4 z-[9998] flex items-center gap-2 rounded-full bg-industrial-100 border border-industrial-300 px-4 py-2 text-xs font-medium text-industrial-800 shadow-industrial hover:border-brand-500 hover:text-brand-400 transition-colors"
        >
          <Bell className="size-3.5" /> Ativar notificações de chegada
        </button>
      )}

      {banners.length > 0 && (
        <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 w-[calc(100%-2rem)] max-w-sm">
          {banners.map((b) => (
            <div key={b.id} className="flex items-start gap-3 rounded-xl bg-brand-600 text-white shadow-2xl p-4 animate-slide-in-right">
              <Truck className="size-6 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm">Caminhão chegou</p>
                <p className="text-sm text-brand-50">{b.cliente || 'Cliente'} — confirmado pelo faturamento</p>
                <p className="text-[11px] text-brand-100 mt-0.5">
                  {new Date(b.confirmado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => fechar(b.id)}
                className="text-white/80 hover:text-white shrink-0"
                aria-label="Fechar notificação"
              >
                <X className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </>,
    document.body,
  )
}
