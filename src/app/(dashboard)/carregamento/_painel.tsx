'use client'

import { useCallback, useState } from 'react'
import { ClipboardList, CheckCircle2, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { useOrdens } from '@/hooks/use-ordens'
import { OrdemService } from '@/services/ordem.service'
import { createClient } from '@/lib/supabase/client'
import { CreateOrderForm } from '@/components/forms/create-order-form'
import { NaPaAgora, FilaLinha, porChegada, horaCurta } from '@/components/pa/pa-ui'
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

  const fila       = [...solicitados].sort(porChegada)
  const hoje       = new Date().toDateString()
  const feitasHoje = concluidos.filter((o) => o.finished_at && new Date(o.finished_at).toDateString() === hoje)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-industrial-900">Central de Solicitações</h1>
          <p className="text-sm text-industrial-600">Olá, {user.apelido ?? user.username}.</p>
        </div>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        {/* ── Nova solicitação ─────────────────────────────── */}
        <section aria-label="Nova solicitação" className="rounded-2xl border border-industrial-200 bg-industrial-100 p-5 md:p-6">
          <h2 className="mb-4 font-display text-lg font-bold text-brand-300">Nova solicitação</h2>
          <CreateOrderForm user={user} onCreated={handleCriado} />
        </section>

        <div className="space-y-5">
          <NaPaAgora liberados={liberados} vazio="Libere uma solicitação da fila pra pá começar." loadingId={loadingId} onCancelar={handleCancelar} />

          {/* ── Fila ─────────────────────────────────────────── */}
          <section aria-label="Fila" className="rounded-2xl border border-industrial-200 bg-industrial-100 p-5 md:p-6">
            <h2 className="mb-3 flex items-baseline gap-2 font-display text-sm font-bold uppercase tracking-[0.14em] text-industrial-600">
              Fila <span className="font-sans text-sm font-normal normal-case tracking-normal">· aguardando liberação</span>
              {fila.length > 0 && <span className="ml-auto font-mono text-base text-industrial-800">{fila.length}</span>}
            </h2>
            {fila.length > 0 ? (
              <ol className="flex flex-col gap-2">
                {fila.map((item, i) => (
                  <FilaLinha
                    key={item.id}
                    item={item}
                    posicao={i + 1}
                    loading={loadingId === item.id}
                    onLiberar={handleLiberar}
                    onCancelar={handleCancelar}
                  />
                ))}
              </ol>
            ) : (
              <p className="flex items-center gap-2 py-3 text-base text-industrial-600">
                <ClipboardList className="size-5 shrink-0" />
                Nenhuma solicitação esperando. Escolha a matéria-prima e as conchas ao lado e envie.
              </p>
            )}
          </section>

          {/* ── Concluídas hoje ──────────────────────────────── */}
          <details className="group rounded-2xl border border-industrial-200 bg-industrial-100">
            <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-5 text-base text-industrial-700 [&::-webkit-details-marker]:hidden">
              <CheckCircle2 className="size-5 text-brand-400" />
              Concluídas hoje: <span className="font-mono font-bold text-industrial-900">{feitasHoje.length}</span>
              <ChevronRight className="ml-auto size-5 text-industrial-500 transition-transform group-open:rotate-90" />
            </summary>
            {feitasHoje.length > 0 ? (
              <ul className="divide-y divide-industrial-200 border-t border-industrial-200">
                {feitasHoje.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 px-5 py-3 text-base">
                    <span className="font-display font-bold text-industrial-900">{item.insumo}</span>
                    <span className="text-industrial-600"><span className="font-mono">{item.quantidade}</span> {item.quantidade === 1 ? 'concha' : 'conchas'}</span>
                    <span className="ml-auto font-mono text-sm text-industrial-600">{item.finished_at ? horaCurta(item.finished_at) : '—'}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="border-t border-industrial-200 px-5 py-3 text-sm text-industrial-600">Nenhuma descarga concluída hoje ainda.</p>
            )}
          </details>
        </div>
      </div>
    </div>
  )
}
