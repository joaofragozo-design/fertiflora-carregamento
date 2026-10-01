'use client'

import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useOrdens } from '@/hooks/use-ordens'
import { OrdemService } from '@/services/ordem.service'
import { createClient } from '@/lib/supabase/client'
import { Lock, Play } from 'lucide-react'
import { ConchaBar, NaPaAgora, FilaLinha, porChegada, tamanhoInsumo, quando } from '@/components/pa/pa-ui'
import type { AppUser, Carregamento } from '@/types'

interface PaPainelProps {
  initialOrdens: Carregamento[]
  user: AppUser
}

// ── Pronúncias corretas para siglas ────────────────────────
const PRONUNCIAS: Record<string, string> = {
  'MAP':  'Mápi',
  'BORO': 'Bóro',
}

function prepararFala(texto: string): string {
  let result = texto
  for (const [sigla, pronuncia] of Object.entries(PRONUNCIAS)) {
    result = result.replace(
      new RegExp(sigla.replace(/[.+]/g, '\\$&'), 'gi'),
      pronuncia
    )
  }
  // Concordância de gênero: concha é feminino
  result = result.replace(/\b1 concha/gi, 'uma concha')
  result = result.replace(/\b2 concha/gi, 'duas concha')
  return result
}

// ── Síntese de voz ─────────────────────────────────────────
function melhorVoz(): SpeechSynthesisVoice | null {
  const vozes = window.speechSynthesis.getVoices()
  return (
    vozes.find((v) => v.lang === 'pt-BR' && v.name.toLowerCase().includes('google')) ??
    vozes.find((v) => v.lang === 'pt-BR' && !v.localService) ??
    vozes.find((v) => v.lang === 'pt-BR') ??
    vozes.find((v) => v.lang.startsWith('pt')) ??
    null
  )
}

let bobEsponjaAtivo  = false
let elevenLabsAtivo  = true
const ELEVEN_VOICE_ID = '4J31DrhygVjvFsoj7BsM'

async function falarElevenLabs(texto: string) {
  try {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: prepararFala(texto), voiceId: ELEVEN_VOICE_ID }),
    })
    if (!res.ok) { falarNavegador(texto); return }
    const blob = await res.blob()
    const url  = URL.createObjectURL(blob)
    const audio = new Audio(url)
    audio.onended = () => URL.revokeObjectURL(url)
    audio.play()
  } catch { falarNavegador(texto) }
}

function falarNavegador(texto: string) {
  try {
    if (!window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const fala  = new SpeechSynthesisUtterance(prepararFala(texto))
    fala.lang   = 'pt-BR'
    fala.volume = 1
    fala.rate   = bobEsponjaAtivo ? 1.4 : 0.88
    fala.pitch  = bobEsponjaAtivo ? 2.0 : 1.0
    const voz   = melhorVoz()
    if (voz) fala.voice = voz
    window.speechSynthesis.speak(fala)
  } catch { /* silencia */ }
}

function falar(texto: string, delayMs = 0) {
  const executar = () => {
    if (elevenLabsAtivo) { falarElevenLabs(texto); return }
    falarNavegador(texto)
  }

  if (delayMs > 0) setTimeout(executar, delayMs)
  else executar()
}

function bipe(vezes = 2) {
  try {
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    for (let i = 0; i < vezes; i++) {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.connect(g); g.connect(ctx.destination)
      o.type = 'square'
      o.frequency.setValueAtTime(880, ctx.currentTime + i * 0.22)
      g.gain.setValueAtTime(0,   ctx.currentTime + i * 0.22)
      g.gain.linearRampToValueAtTime(1.5, ctx.currentTime + i * 0.22 + 0.01)
      g.gain.linearRampToValueAtTime(0,   ctx.currentTime + i * 0.22 + 0.14)
      o.start(ctx.currentTime + i * 0.22)
      o.stop(ctx.currentTime  + i * 0.22 + 0.14)
    }
    setTimeout(() => ctx.close(), 800)
  } catch { /* silencia */ }
}

export function PaPainel({ initialOrdens, user }: PaPainelProps) {
  const isAdmin    = user.role === 'admin'
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [flashing,  setFlashing]  = useState(false)
  const [easterClicks, setEasterClicks] = useState(0)
  // 0 = normal, 1 = bob esponja, 2 = voz especial
  const [easterModo,   setEasterModo]   = useState(0)

  function handleBobClick() {
    const next = easterClicks + 1
    setEasterClicks(next)
    if (next >= 5) {
      setEasterClicks(0)
      const novoModo = (easterModo + 1) % 2
      setEasterModo(novoModo)
      bobEsponjaAtivo = novoModo === 1
      elevenLabsAtivo = novoModo === 0
      if (novoModo === 1) falar('Modo Bob Esponja ativado!')
      else falarElevenLabs('Voltando ao normal.')
    }
  }

  // ── Callbacks realtime ──────────────────────────────────
  const handleLiberar = useCallback((item: Carregamento) => {
    if (isAdmin) return
    // Flash de tela
    setFlashing(true)
    setTimeout(() => setFlashing(false), 3000)
    // Bipe + voz
    bipe(3)
    falar(
      `Descarga de matéria prima ${item.insumo} liberada. Faltam ${item.quantidade} conchas.`,
      700
    )
  }, [isAdmin])

  const handleDelete = useCallback((insumo: string) => {
    if (isAdmin) return
    bipe(2)
    falar(`Atenção! A matéria prima ${insumo} foi cancelada.`, 600)
  }, [isAdmin])

  const { ordens, setOrdens } = useOrdens(
    initialOrdens,
    isAdmin,
    undefined,
    isAdmin ? undefined : handleDelete,
    isAdmin ? undefined : handleLiberar,
  )

  const atualizar = useCallback((item: Carregamento) => {
    setOrdens((prev) => prev.map((o) => (o.id === item.id ? item : o)))
  }, [setOrdens])

  // ── Execução de concha ──────────────────────────────────
  async function executarConcha(item: Carregamento) {
    setLoadingId(item.id)
    try {
      const executadas = item.conchas_executadas ?? 0
      const total      = item.quantidade
      const updated    = await new OrdemService(createClient()).executarConcha(item.id, executadas, total)
      const novas      = updated.conchas_executadas ?? executadas + 1

      if (updated.status === 'CONCLUIDO') {
        setOrdens((prev) => prev.filter((o) => o.id !== updated.id))
        falar(`Descarga de ${item.insumo} concluída.`)
        toast.success(`${item.insumo} — descarga concluída!`)
      } else {
        atualizar(updated)
        falar(`${item.insumo}. Concha ${novas} de ${total}.`)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao executar.')
    } finally {
      setLoadingId(null)
    }
  }

  // ── Tela do operador_pa (Reginaldo) — celular em pé no suporte da cabine ──
  if (!isAdmin) {
    // Fila por ordem de chegada (a lista do hook vem da mais nova pra mais antiga)
    const fila         = ordens.filter((o) => o.status === 'SOLICITADO' || o.status === 'LIBERADO').sort(porChegada)
    const liberado     = fila.find((o) => o.status === 'LIBERADO') ?? null
    const solicitado   = fila.find((o) => o.status === 'SOLICITADO') ?? null
    const tarefa       = liberado ?? solicitado
    const proximas     = fila.filter((o) => o.id !== tarefa?.id)
    const executando   = loadingId === tarefa?.id
    const podeExecutar = tarefa?.status === 'LIBERADO' && !executando
    const feitas       = tarefa?.conchas_executadas ?? 0

    return (
      <div className="relative flex min-h-[calc(100dvh-7.5rem)] flex-col">

        {/* Flash de tela ao receber liberação */}
        {flashing && (
          <div className="pointer-events-none fixed inset-0 z-50 animate-screen-flash bg-brand-400/30" />
        )}

        <h1 className="sr-only">Centro Operacional</h1>

        {!tarefa ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <span className="flex items-center gap-2 rounded-full border border-industrial-300 px-4 py-2 text-sm font-bold uppercase tracking-[0.14em] text-industrial-600">
              <span className="size-2.5 rounded-full bg-industrial-500" />
              Pá livre
            </span>
            <p className="font-display text-5xl font-bold leading-tight text-industrial-800">Aguardando<br />solicitação</p>
            <p className="max-w-xs text-lg text-industrial-600">Quando a Central liberar uma descarga, a tela pisca e avisa por voz.</p>
          </div>
        ) : (
          <>
            {/* Estado */}
            <div className="flex items-center justify-between gap-3">
              {tarefa.status === 'LIBERADO' ? (
                <span className="flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-xl font-bold uppercase tracking-[0.08em] text-white">
                  <span className="size-2.5 animate-pulse rounded-full bg-white" />
                  Liberado — execute
                </span>
              ) : (
                <span className="flex items-center gap-2 rounded-full border-2 border-industrial-400 px-4 py-2 text-xl font-bold uppercase tracking-[0.08em] text-industrial-700">
                  <Lock className="size-4" />
                  Aguardando liberação
                </span>
              )}
            </div>

            {/* Carga da vez */}
            <p className="mt-6 text-sm font-semibold uppercase tracking-[0.14em] text-industrial-600">Matéria-prima</p>
            <p className={cn('mt-1 break-words font-display font-bold leading-[0.95] tracking-tight text-industrial-900', tamanhoInsumo(tarefa.insumo, 'celular'))}>
              {tarefa.insumo}
            </p>

            <p
              className="mt-5 flex cursor-default select-none items-baseline gap-1 font-mono"
              onClick={handleBobClick}
            >
              <span className={cn('text-[6.5rem] font-bold leading-none', tarefa.status === 'LIBERADO' ? 'text-brand-300' : 'text-industrial-700')}>
                {String(feitas).padStart(2, '0')}
              </span>
              <span className="text-4xl font-semibold text-industrial-600">/{tarefa.quantidade}</span>
              <span className="ml-2 font-sans text-lg text-industrial-600">{tarefa.quantidade === 1 ? 'concha' : 'conchas'}</span>
            </p>
            {easterModo === 1 && (
              <p className="mt-1 animate-pulse text-xs text-yellow-500">🧽 Modo Bob Esponja</p>
            )}
            <ConchaBar feitas={feitas} total={tarefa.quantidade} size="xl" className="mt-4" />

            {/* Botão na zona do polegar */}
            <div className="mt-auto pt-6">
              <button
                type="button"
                disabled={!podeExecutar}
                onClick={() => executarConcha(tarefa)}
                className={cn(
                  'flex min-h-[7.5rem] w-full items-center justify-center gap-3 rounded-2xl px-4 font-display text-[clamp(1.5rem,8vw,1.875rem)] font-bold uppercase tracking-wide transition-colors active:scale-[0.98]',
                  podeExecutar
                    ? 'bg-brand-600 text-white hover:bg-brand-500 active:bg-brand-700'
                    : 'cursor-not-allowed border-2 border-industrial-300 text-industrial-500',
                )}
              >
                {executando ? (
                  'Registrando…'
                ) : tarefa.status === 'LIBERADO' ? (
                  <><Play className="size-8 fill-current" /> Executar concha</>
                ) : (
                  <><Lock className="size-7" /> Aguardando</>
                )}
              </button>

              <div className="mt-4 border-t border-industrial-200 pt-3">
                <p className="mb-1 text-sm font-semibold uppercase tracking-[0.14em] text-industrial-600">Próximas</p>
                {proximas.length > 0 ? (
                  <span className="flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-lg">
                    {proximas.slice(0, 4).map((o) => (
                      <span key={o.id} className="font-display font-bold text-industrial-800">
                        {o.insumo} <span className="font-mono font-semibold text-brand-300">·{o.quantidade}</span>
                      </span>
                    ))}
                    {proximas.length > 4 && <span className="text-industrial-600">+{proximas.length - 4}</span>}
                  </span>
                ) : (
                  <span className="text-lg text-industrial-600">nenhuma</span>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    )
  }

  // ── Tela do admin (acompanha a pá, sem executar) ────────
  const fila       = ordens.filter((o) => o.status === 'SOLICITADO').sort(porChegada)
  const liberados  = ordens.filter((o) => o.status === 'LIBERADO')
  const concluidos = ordens.filter((o) => o.status === 'CONCLUIDO')

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-industrial-900">Centro Operacional</h1>
        <p className="text-sm text-industrial-600">Visão do admin — acompanhamento da pá em tempo real.</p>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <NaPaAgora liberados={liberados} vazio="Nenhuma descarga liberada no momento." />

        <section aria-label="Fila" className="rounded-2xl border border-industrial-200 bg-industrial-100 p-5 md:p-6">
          <h2 className="mb-3 font-display text-sm font-bold uppercase tracking-[0.14em] text-industrial-600">Fila · aguardando liberação</h2>
          {fila.length > 0 ? (
            <ol className="flex flex-col gap-2">
              {fila.map((item, i) => <FilaLinha key={item.id} item={item} posicao={i + 1} />)}
            </ol>
          ) : (
            <p className="py-3 text-base text-industrial-600">Ninguém na fila.</p>
          )}
        </section>
      </div>

      {concluidos.length > 0 && (
        <section aria-label="Concluídas" className="rounded-2xl border border-industrial-200 bg-industrial-100">
          <h2 className="px-5 pt-4 font-display text-sm font-bold uppercase tracking-[0.14em] text-industrial-600">Concluídas recentes</h2>
          <ul className="mt-2 divide-y divide-industrial-200 border-t border-industrial-200">
            {concluidos.slice(0, 10).map((item) => (
              <li key={item.id} className="flex items-center gap-3 px-5 py-3 text-base">
                <span className="font-display font-bold text-industrial-900">{item.insumo}</span>
                <span className="text-industrial-600"><span className="font-mono">{item.quantidade}</span> {item.quantidade === 1 ? 'concha' : 'conchas'}</span>
                <span className="ml-auto font-mono text-sm text-industrial-600">{item.finished_at ? quando(item.finished_at) : '—'}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
