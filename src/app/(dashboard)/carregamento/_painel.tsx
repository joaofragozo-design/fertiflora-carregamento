'use client'

import { useCallback, useState } from 'react'
import { ClipboardList, Zap, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useOrdens } from '@/hooks/use-ordens'
import { OrdemService } from '@/services/ordem.service'
import { createClient } from '@/lib/supabase/client'
import { CreateOrderForm } from '@/components/forms/create-order-form'
import type { AppUser, Carregamento } from '@/types'

interface CarregamentoPainelProps {
  initialOrdens: Carregamento[]
  user: AppUser
}

export function CarregamentoPainel({ initialOrdens, user }: CarregamentoPainelProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const { ordens, setOrdens } = useOrdens(initialOrdens, true)

  const solicitados = ordens.filter((o) => o.status === 'SOLICITADO')
  const liberados   = ordens.filter((o) => o.status === 'LIBERADO')
  const concluidos  = ordens.filter((o) => o.status === 'CONCLUIDO')

  const handleCriado = useCallback((novo: Carregamento) => {
    setOrdens((prev) => (prev.some((o) => o.id === novo.id) ? prev : [novo, ...prev]))
  }, [setOrdens])

  async function handleLiberar(item: Carregamento) {
    setLoadingId(item.id)
    try {
      const updated = await new OrdemService(createClient()).liberar(item.id)
      setOrdens((prev) => prev.map((o) => (o.id === updated.id ? updated : o)))
      toast.success(`${item.insumo} liberado para descarga.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao liberar.')
    } finally {
      setLoadingId(null)
    }
  }

  async function handleCancelar(item: Carregamento) {
    setLoadingId(item.id)
    try {
      await new OrdemService(createClient()).cancelar(item.id)
      setOrdens((prev) => prev.filter((o) => o.id !== item.id))
      toast.success(`Solicitação de ${item.insumo} cancelada.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao cancelar.')
    } finally {
      setLoadingId(null)
    }
  }

  const totalAtivos = solicitados.length + liberados.length

  return (
    <div className="space-y-5">

      {/* ── Cabeçalho ──────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-industrial-100">Central de Solicitações</h1>
          <p className="text-sm text-industrial-500">Olá, {user.username}.</p>
        </div>
        <div className="flex items-center gap-2">
          {solicitados.length > 0 && (
            <Pill label="Aguardando" value={solicitados.length} color="bg-industrial-700" />
          )}
          {liberados.length > 0 && (
            <Pill label="Liberado" value={liberados.length} color="bg-brand-500 animate-pulse" />
          )}
          {concluidos.length > 0 && (
            <Pill label="Concluído" value={concluidos.length} color="bg-brand-400" />
          )}
        </div>
      </div>

      {/* ── Formulário ─────────────────────────────────────── */}
      <div className="rounded-xl border border-industrial-800 bg-industrial-900 p-4">
        <CreateOrderForm user={user} onCreated={handleCriado} />
      </div>

      {/* ── Solicitados (aguardando liberação) ─────────────── */}
      {solicitados.length > 0 && (
        <section>
          <SectionLabel text={`Aguardando liberação — ${solicitados.length}`} />
          <div className="flex flex-col gap-2">
            {solicitados.map((item) => (
              <SolicitadoCard
                key={item.id}
                item={item}
                loading={loadingId === item.id}
                onLiberar={handleLiberar}
                onCancelar={handleCancelar}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Liberados (em execução) ─────────────────────────── */}
      {liberados.length > 0 && (
        <section>
          <SectionLabel text={`Em execução — ${liberados.length}`} />
          <div className="flex flex-col gap-2">
            {liberados.map((item) => (
              <LiberadoCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      )}

      {/* ── Concluídos ─────────────────────────────────────── */}
      {concluidos.length > 0 && (
        <section>
          <SectionLabel text={`Concluídos — ${concluidos.length}`} />
          <div className="flex flex-col gap-2">
            {concluidos.map((item) => (
              <ConcluidoCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      )}

      {/* ── Empty state ────────────────────────────────────── */}
      {totalAtivos === 0 && concluidos.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-industrial-800 py-12 text-center">
          <ClipboardList className="h-7 w-7 text-industrial-500" />
          <p className="text-sm text-industrial-500">Nenhuma solicitação ainda.</p>
          <p className="text-xs text-industrial-500">Selecione uma matéria prima acima e envie.</p>
        </div>
      )}
    </div>
  )
}

// ── Sub-componentes ──────────────────────────────────────────

function SolicitadoCard({ item, loading, onLiberar, onCancelar }: {
  item: Carregamento; loading: boolean
  onLiberar: (i: Carregamento) => void
  onCancelar: (i: Carregamento) => void
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border-2 border-industrial-700 bg-industrial-900 px-4 py-3">
      <div>
        <p className="text-sm font-bold text-industrial-100">{item.insumo}</p>
        <p className="text-xs text-industrial-500">{item.quantidade} conchas · {tempoRelativo(item.created_at)}</p>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={loading}
          onClick={() => onCancelar(item)}
          title="Cancelar solicitação"
          className="rounded-lg border border-danger-400/40 p-1.5 text-danger-400 transition-colors hover:bg-danger-400/10 hover:border-danger-400 disabled:opacity-40"
        >
          <Trash2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => onLiberar(item)}
          className="flex items-center gap-1.5 rounded-lg border-2 border-brand-600 bg-brand-600 px-3 py-1.5 text-sm font-bold text-white transition-all hover:bg-brand-500 disabled:opacity-50"
        >
          <Zap className="h-3.5 w-3.5" />
          {loading ? 'Liberando...' : 'Liberar'}
        </button>
      </div>
    </div>
  )
}

function LiberadoCard({ item }: { item: Carregamento }) {
  const executadas = item.conchas_executadas ?? 0
  const total      = item.quantidade
  const pct        = Math.round((executadas / total) * 100)

  return (
    <div className="rounded-xl border-2 border-brand-500/50 bg-brand-500/5 px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-brand-500" />
          <p className="text-sm font-bold text-industrial-100">{item.insumo}</p>
        </div>
        <span className="text-xs font-semibold text-brand-700">{executadas}/{total} conchas</span>
      </div>
      {/* Barra de progresso */}
      <div className="h-2 w-full rounded-full bg-industrial-800">
        <div
          className="h-2 rounded-full bg-brand-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function ConcluidoCard({ item }: { item: Carregamento }) {
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

function Pill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-industrial-800 bg-industrial-900 px-3 py-1">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      <span className="text-xs font-semibold text-industrial-100">{value}</span>
      <span className="text-xs text-industrial-500">{label}</span>
    </div>
  )
}

function SectionLabel({ text }: { text: string }) {
  return (
    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-industrial-500">{text}</p>
  )
}

function tempoRelativo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60)    return 'agora'
  if (s < 3600)  return `há ${Math.floor(s / 60)} min`
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`
  return `há ${Math.floor(s / 86400)} d`
}
