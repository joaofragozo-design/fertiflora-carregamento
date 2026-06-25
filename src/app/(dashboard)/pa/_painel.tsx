'use client'

import { useState, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useOrdens } from '@/hooks/use-ordens'
import { useNotificationSound } from '@/hooks/use-notification-sound'
import { OrdemService } from '@/services/ordem.service'
import { createClient } from '@/lib/supabase/client'
import type { AppUser, Carregamento } from '@/types'

interface PaPainelProps {
  initialOrdens: Carregamento[]
  user: AppUser
}

export function PaPainel({ initialOrdens, user }: PaPainelProps) {
  const isAdmin   = user.role === 'admin'
  const playPing  = useNotificationSound()
  const [newIds, setNewIds] = useState<Set<string>>(new Set())
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const handleInsert = useCallback((item: Carregamento) => {
    if (isAdmin) return
    playPing()
    setNewIds((prev) => new Set([...prev, item.id]))
    // Remove animação após 4 s
    setTimeout(() => setNewIds((prev) => {
      const next = new Set(prev); next.delete(item.id); return next
    }), 4000)
  }, [isAdmin, playPing])

  const { ordens, setOrdens } = useOrdens(initialOrdens, isAdmin, handleInsert)

  const pendentes  = ordens.filter((o) => o.status === 'PENDENTE')
  const concluidos = ordens.filter((o) => o.status === 'CONCLUIDO')
  const atual      = ordens.find((o) => o.status === 'CARREGANDO') ?? null

  const atualizar = useCallback((item: Carregamento) => {
    setOrdens((prev) => prev.map((o) => (o.id === item.id ? item : o)))
  }, [setOrdens])

  async function iniciar(item: Carregamento) {
    setLoadingId(item.id)
    try {
      const updated = await new OrdemService(createClient()).iniciar(item.id)
      atualizar(updated)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro.'
      toast.warning(msg.includes('Transição') ? 'Já iniciado por outro operador.' : msg)
    } finally {
      setLoadingId(null)
    }
  }

  async function concluir(item: Carregamento) {
    setLoadingId(item.id)
    try {
      const updated = await new OrdemService(createClient()).concluir(item.id)
      atualizar(updated)
      toast.success(`${item.insumo} concluído.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao concluir.')
    } finally {
      setLoadingId(null)
    }
  }

  // ── Tela do operador_pa ───────────────────────────────────────────
  if (!isAdmin) {
    const tarefaAtiva = atual ?? (pendentes[0] ?? null)
    const semServico  = !tarefaAtiva
    const isNew       = tarefaAtiva ? newIds.has(tarefaAtiva.id) : false

    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-4">

        {/* Título da tela */}
        <p className="mb-8 text-xs font-bold uppercase tracking-[0.25em] text-industrial-600">
          Centro Operacional
        </p>

        {semServico ? (
          /* ── AGUARDANDO ─────────────────────────────────────── */
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
              Nenhuma solicitação no momento. Aguarde o operador de carregamento.
            </p>
          </div>
        ) : (
          /* ── SOLICITAÇÃO ATIVA ───────────────────────────────── */
          <div className={cn(
            'w-full max-w-sm flex flex-col gap-6',
            isNew && 'animate-new-item'
          )}>

            {/* Badge de status */}
            <div className="flex justify-center">
              {tarefaAtiva.status === 'CARREGANDO' ? (
                <span className="flex items-center gap-2 rounded-full border border-info-500/30 bg-info-500/10 px-4 py-1.5 text-sm font-bold uppercase tracking-widest text-info-600">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-info-400" />
                  Em andamento
                </span>
              ) : (
                <span className={cn(
                  'flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-bold uppercase tracking-widest',
                  isNew
                    ? 'border-orange-500/50 bg-orange-500/15 text-orange-700'
                    : 'border-warning-500/30 bg-warning-500/10 text-warning-600'
                )}>
                  <span className={cn(
                    'h-2 w-2 rounded-full',
                    isNew ? 'animate-pulse bg-orange-400' : 'bg-warning-400'
                  )} />
                  Nova Solicitação
                </span>
              )}
            </div>

            {/* Card principal — insumo + quantidade em destaque */}
            <div className={cn(
              'rounded-2xl border-2 p-8 text-center transition-all duration-300',
              tarefaAtiva.status === 'CARREGANDO'
                ? 'border-info-500'
                : isNew
                  ? 'border-orange-400 animate-alert-pulse'
                  : 'border-warning-500'
            )}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-industrial-500">
                Insumo
              </p>
              <p className="text-5xl font-black tracking-tight text-industrial-100 leading-none">
                {tarefaAtiva.insumo}
              </p>

              <div className="my-6 border-t border-industrial-800" />

              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-industrial-500">
                Conchas
              </p>
              <p className="text-8xl font-black leading-none text-industrial-100">
                {tarefaAtiva.quantidade}
              </p>
            </div>

            {/* Botões de ação */}
            {tarefaAtiva.status === 'PENDENTE' && (
              <button
                type="button"
                disabled={loadingId === tarefaAtiva.id}
                onClick={() => iniciar(tarefaAtiva)}
                className={cn(
                  'w-full rounded-2xl py-6 text-xl font-black uppercase tracking-wider transition-all active:scale-[0.98]',
                  loadingId === tarefaAtiva.id
                    ? 'border-2 border-warning-700/50 text-warning-500/50 cursor-not-allowed'
                    : 'border-2 border-warning-400 bg-warning-500 text-black hover:bg-warning-400'
                )}
              >
                {loadingId === tarefaAtiva.id ? 'Iniciando...' : '▶  Iniciar Carregamento'}
              </button>
            )}

            {tarefaAtiva.status === 'CARREGANDO' && (
              <button
                type="button"
                disabled={loadingId === tarefaAtiva.id}
                onClick={() => concluir(tarefaAtiva)}
                className={cn(
                  'w-full rounded-2xl py-6 text-xl font-black uppercase tracking-wider transition-all active:scale-[0.98]',
                  loadingId === tarefaAtiva.id
                    ? 'border-2 border-brand-700/50 text-brand-500/50 cursor-not-allowed'
                    : 'border-2 border-brand-500 bg-brand-600 text-white hover:bg-brand-500'
                )}
              >
                {loadingId === tarefaAtiva.id ? 'Concluindo...' : '✓  Concluído'}
              </button>
            )}

            {/* Fila restante */}
            {pendentes.length > 1 && (
              <p className="text-center text-xs text-industrial-600">
                +{pendentes.length - 1} na fila
              </p>
            )}
          </div>
        )}
      </div>
    )
  }

  // ── Tela do admin ─────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-5">

      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-industrial-500">
            Visão Admin — Centro Operacional
          </p>
          <p className="text-sm text-industrial-400">{user.username}</p>
        </div>
        <div className="flex items-center gap-2">
          {pendentes.length > 0 && (
            <span className="rounded-full border border-warning-500/30 bg-warning-500/10 px-3 py-1 text-xs font-semibold text-warning-600">
              {pendentes.length} pendente{pendentes.length > 1 ? 's' : ''}
            </span>
          )}
          {concluidos.length > 0 && (
            <span className="rounded-full border border-brand-500/30 bg-brand-500/10 px-3 py-1 text-xs font-semibold text-brand-700">
              {concluidos.length} concluído{concluidos.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {atual && (
        <AdminCard item={atual} loading={loadingId === atual.id} onConcluir={concluir} />
      )}

      {pendentes.length > 0 && (
        <section>
          <SectionLabel text={`Fila — ${pendentes.length}`} />
          <div className="flex flex-col gap-2">
            {pendentes.map((item) => (
              <AdminCardPendente key={item.id} item={item} />
            ))}
          </div>
        </section>
      )}

      {concluidos.length > 0 && (
        <section>
          <SectionLabel text={`Histórico — ${concluidos.length}`} />
          <div className="flex flex-col gap-2">
            {concluidos.map((item) => (
              <AdminCardConcluido key={item.id} item={item} />
            ))}
          </div>
        </section>
      )}

      {!atual && pendentes.length === 0 && concluidos.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-industrial-800 py-20 text-center">
          <div className="text-4xl">⏳</div>
          <p className="text-base font-semibold text-industrial-400">Nenhuma atividade</p>
        </div>
      )}
    </div>
  )
}

function AdminCard({ item, loading, onConcluir }: {
  item: Carregamento; loading: boolean; onConcluir: (i: Carregamento) => void
}) {
  return (
    <div className="overflow-hidden rounded-2xl border-2 border-info-500/50 bg-gradient-to-b from-info-500/10 to-transparent">
      <div className="flex items-center gap-2 border-b border-info-500/20 bg-info-500/10 px-5 py-2.5">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-info-400" />
        <span className="text-xs font-bold uppercase tracking-widest text-info-400">Carregando</span>
      </div>
      <div className="px-5 py-6 text-center">
        <p className="text-4xl font-black text-industrial-100">{item.insumo}</p>
        <p className="mt-2 text-6xl font-black text-info-600">
          {item.quantidade} <span className="ml-1 text-2xl text-info-600/70">conchas</span>
        </p>
      </div>
      <div className="px-4 pb-4">
        <button
          type="button"
          disabled={loading}
          onClick={() => onConcluir(item)}
          className={cn(
            'w-full rounded-xl py-4 text-lg font-black uppercase tracking-wider transition-all active:scale-[0.98]',
            loading ? 'bg-brand-700/50 text-brand-300/50 cursor-not-allowed'
                    : 'bg-brand-600 text-white hover:bg-brand-500 shadow-glow-green'
          )}
        >
          {loading ? 'Concluindo...' : '✓  Concluído'}
        </button>
      </div>
    </div>
  )
}

function AdminCardPendente({ item }: { item: Carregamento }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-warning-500/30 bg-warning-500/5 px-4 py-3">
      <div>
        <p className="text-base font-bold text-warning-700">{item.insumo}</p>
        <p className="text-lg font-black text-warning-600">{item.quantidade} <span className="text-sm text-warning-500">conchas</span></p>
      </div>
      <span className="text-xs text-industrial-600">{tempoRelativo(item.created_at)}</span>
    </div>
  )
}

function AdminCardConcluido({ item }: { item: Carregamento }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-industrial-800 bg-industrial-900 px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="h-2 w-2 rounded-full bg-brand-500" />
        <span className="text-sm font-semibold text-industrial-300">{item.insumo}</span>
        <span className="text-sm font-bold text-industrial-100">{item.quantidade} conchas</span>
      </div>
      <span className="text-xs text-industrial-600">
        {item.finished_at ? tempoRelativo(item.finished_at) : '—'}
      </span>
    </div>
  )
}

function SectionLabel({ text }: { text: string }) {
  return (
    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-industrial-500">{text}</p>
  )
}

function tempoRelativo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60)    return 'agora'
  if (s < 3600)  return `${Math.floor(s / 60)} min`
  if (s < 86400) return `${Math.floor(s / 3600)} h`
  return `${Math.floor(s / 86400)} d`
}
