'use client'

import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useOrdens } from '@/hooks/use-ordens'
import { OrdemService } from '@/services/ordem.service'
import { createClient } from '@/lib/supabase/client'
import type { AppUser, Carregamento } from '@/types'

interface PaPainelProps {
  initialOrdens: Carregamento[]
  user: AppUser
}

// ── Pronúncias corretas para siglas ────────────────────────
const PRONUNCIAS: Record<string, string> = {
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
function falar(texto: string, delayMs = 0) {
  try {
    if (!window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const fala    = new SpeechSynthesisUtterance(prepararFala(texto))
    fala.lang     = 'pt-BR'
    fala.volume   = 1
    fala.rate     = 0.85
    fala.pitch    = 1
    if (delayMs > 0) setTimeout(() => window.speechSynthesis.speak(fala), delayMs)
    else window.speechSynthesis.speak(fala)
  } catch { /* silencia erros de autoplay policy */ }
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

  // ── Tela do operador_pa (Reginaldo) ─────────────────────
  if (!isAdmin) {
    const liberado    = ordens.find((o) => o.status === 'LIBERADO') ?? null
    const solicitado  = ordens.find((o) => o.status === 'SOLICITADO') ?? null
    const tarefa      = liberado ?? solicitado
    const semServico  = !tarefa

    return (
      <div className="relative flex min-h-[70vh] flex-col items-center justify-center px-4">

        {/* Flash de tela ao receber liberação */}
        {flashing && (
          <div className="pointer-events-none fixed inset-0 z-50 animate-screen-flash bg-brand-400/30" />
        )}

        <p className="mb-8 text-xs font-bold uppercase tracking-[0.25em] text-industrial-600">
          Centro Operacional
        </p>

        {semServico ? (
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="text-6xl">⏳</div>
            <div>
              <p className="text-3xl font-black uppercase tracking-widest text-industrial-300">
                Aguardando
              </p>
              <p className="text-3xl font-black uppercase tracking-widest text-industrial-500">
                Solicitações
              </p>
            </div>
            <p className="text-sm text-industrial-600 max-w-xs">
              Nenhuma solicitação no momento.
            </p>
          </div>
        ) : (
          <div className="w-full max-w-sm flex flex-col gap-6">

            {/* Badge de status */}
            <div className="flex justify-center">
              {tarefa.status === 'LIBERADO' ? (
                <span className="flex items-center gap-2 rounded-full border border-brand-500/40 bg-brand-500/10 px-4 py-1.5 text-sm font-bold uppercase tracking-widest text-brand-700">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-brand-500" />
                  Liberado — Execute
                </span>
              ) : (
                <span className="flex items-center gap-2 rounded-full border border-industrial-700 bg-industrial-900 px-4 py-1.5 text-sm font-bold uppercase tracking-widest text-industrial-400">
                  <span className="h-2 w-2 rounded-full bg-industrial-600" />
                  Aguardando liberação
                </span>
              )}
            </div>

            {/* Card principal */}
            <div className={cn(
              'rounded-2xl border-2 p-8 text-center transition-all duration-300',
              tarefa.status === 'LIBERADO'
                ? 'border-brand-500'
                : 'border-industrial-700'
            )}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-industrial-500">
                Matéria Prima
              </p>
              <p className="text-5xl font-black tracking-tight text-industrial-100 leading-none">
                {tarefa.insumo}
              </p>

              <div className="my-6 border-t border-industrial-800" />

              {/* Progresso de conchas */}
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-industrial-500">
                Progresso
              </p>
              <p className="text-8xl font-black leading-none text-industrial-100">
                {tarefa.conchas_executadas ?? 0}
                <span className="text-3xl text-industrial-500">/{tarefa.quantidade}</span>
              </p>

              {/* Barra de progresso */}
              {tarefa.status === 'LIBERADO' && (
                <div className="mt-4 h-2 w-full rounded-full bg-industrial-800">
                  <div
                    className="h-2 rounded-full bg-brand-500 transition-all duration-500"
                    style={{ width: `${Math.round(((tarefa.conchas_executadas ?? 0) / tarefa.quantidade) * 100)}%` }}
                  />
                </div>
              )}
            </div>

            {/* Botão de execução */}
            <button
              type="button"
              disabled={tarefa.status !== 'LIBERADO' || loadingId === tarefa.id}
              onClick={() => executarConcha(tarefa)}
              className={cn(
                'w-full rounded-2xl py-6 text-xl font-black uppercase tracking-wider transition-all active:scale-[0.98]',
                tarefa.status === 'LIBERADO' && loadingId !== tarefa.id
                  ? 'border-2 border-brand-500 bg-brand-600 text-white hover:bg-brand-500'
                  : 'border-2 border-industrial-700 text-industrial-500 cursor-not-allowed'
              )}
            >
              {loadingId === tarefa.id
                ? 'Executando...'
                : tarefa.status === 'LIBERADO'
                  ? '▶  Executar Concha'
                  : '🔒  Aguardando Liberação'}
            </button>

            {/* Fila */}
            {ordens.filter((o) => o.status === 'SOLICITADO').length > 1 && (
              <p className="text-center text-xs text-industrial-600">
                +{ordens.filter((o) => o.status === 'SOLICITADO').length - 1} na fila
              </p>
            )}
          </div>
        )}
      </div>
    )
  }

  // ── Tela do admin ───────────────────────────────────────
  const solicitados = ordens.filter((o) => o.status === 'SOLICITADO')
  const liberados   = ordens.filter((o) => o.status === 'LIBERADO')
  const concluidos  = ordens.filter((o) => o.status === 'CONCLUIDO')

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-industrial-500">
          Visão Admin — Centro Operacional
        </p>
        <p className="text-sm text-industrial-400">{user.username}</p>
      </div>

      {liberados.map((item) => (
        <AdminLiberadoCard key={item.id} item={item} />
      ))}

      {solicitados.length > 0 && (
        <section>
          <AdminSectionLabel text={`Aguardando — ${solicitados.length}`} />
          <div className="flex flex-col gap-2">
            {solicitados.map((item) => (
              <AdminSolicitadoCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      )}

      {concluidos.length > 0 && (
        <section>
          <AdminSectionLabel text={`Concluídos — ${concluidos.length}`} />
          <div className="flex flex-col gap-2">
            {concluidos.map((item) => (
              <AdminConcluidoCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      )}

      {ordens.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-industrial-800 py-20 text-center">
          <div className="text-4xl">⏳</div>
          <p className="text-base font-semibold text-industrial-400">Nenhuma atividade</p>
        </div>
      )}
    </div>
  )
}

function AdminLiberadoCard({ item }: { item: Carregamento }) {
  const executadas = item.conchas_executadas ?? 0
  const pct = Math.round((executadas / item.quantidade) * 100)
  return (
    <div className="overflow-hidden rounded-2xl border-2 border-brand-500/50 bg-brand-500/5">
      <div className="flex items-center gap-2 border-b border-brand-500/20 bg-brand-500/10 px-5 py-2.5">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-brand-500" />
        <span className="text-xs font-bold uppercase tracking-widest text-brand-700">Em execução</span>
      </div>
      <div className="px-5 py-4 text-center">
        <p className="text-4xl font-black text-industrial-100">{item.insumo}</p>
        <p className="mt-1 text-2xl font-black text-brand-700">{executadas}/{item.quantidade} conchas</p>
        <div className="mt-3 h-2 w-full rounded-full bg-industrial-800">
          <div className="h-2 rounded-full bg-brand-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  )
}

function AdminSolicitadoCard({ item }: { item: Carregamento }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-industrial-800 bg-industrial-900 px-4 py-3">
      <div>
        <p className="text-base font-bold text-industrial-100">{item.insumo}</p>
        <p className="text-sm text-industrial-500">{item.quantidade} conchas</p>
      </div>
      <span className="text-xs text-industrial-500">{tempoRelativo(item.created_at)}</span>
    </div>
  )
}

function AdminConcluidoCard({ item }: { item: Carregamento }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-industrial-800 bg-industrial-900 px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="h-2 w-2 rounded-full bg-brand-500" />
        <span className="text-sm font-semibold text-industrial-300">{item.insumo}</span>
        <span className="text-sm font-bold text-industrial-100">{item.quantidade} conchas</span>
      </div>
      <span className="text-xs text-industrial-500">
        {item.finished_at ? tempoRelativo(item.finished_at) : '—'}
      </span>
    </div>
  )
}

function AdminSectionLabel({ text }: { text: string }) {
  return <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-industrial-500">{text}</p>
}

function tempoRelativo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60)    return 'agora'
  if (s < 3600)  return `há ${Math.floor(s / 60)} min`
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`
  return `há ${Math.floor(s / 86400)} d`
}
