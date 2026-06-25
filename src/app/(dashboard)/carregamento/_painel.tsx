'use client'

import { useCallback } from 'react'
import { ClipboardList, CheckCircle2, Loader2 } from 'lucide-react'
import { useOrdens } from '@/hooks/use-ordens'
import { CreateOrderForm } from '@/components/forms/create-order-form'
import { OrderList } from '@/components/orders/order-list'
import type { AppUser, Carregamento } from '@/types'

interface CarregamentoPainelProps {
  initialOrdens: Carregamento[]
  user: AppUser
}

export function CarregamentoPainel({ initialOrdens, user }: CarregamentoPainelProps) {
  const { ordens, setOrdens } = useOrdens(initialOrdens)

  const pendentes  = ordens.filter((o) => o.status === 'PENDENTE')
  const carregando = ordens.filter((o) => o.status === 'CARREGANDO')
  const concluidos = ordens.filter((o) => o.status === 'CONCLUIDO')
  const ativas     = [...carregando, ...pendentes]

  const handleCriado = useCallback((novo: Carregamento) => {
    setOrdens((prev) => (prev.some((o) => o.id === novo.id) ? prev : [novo, ...prev]))
  }, [setOrdens])

  return (
    <div className="space-y-5">

      {/* ── Cabeçalho ──────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-industrial-50">Central de Solicitações</h1>
          <p className="text-sm text-industrial-500">Olá, {user.username}.</p>
        </div>

        {/* Stats inline */}
        <div className="flex items-center gap-3">
          <Stat value={pendentes.length}  label="Pendente"   dot="bg-warning-400" />
          <Stat value={carregando.length} label="Carregando" dot="bg-info-400" pulse />
          <Stat value={concluidos.length} label="Concluído"  dot="bg-brand-400" />
        </div>
      </div>

      {/* ── Formulário inline ──────────────────────── */}
      <div className="rounded-xl border border-industrial-800 bg-industrial-900 p-4">
        <CreateOrderForm user={user} onCreated={handleCriado} />
      </div>

      {/* ── Em andamento ───────────────────────────── */}
      {ativas.length > 0 && (
        <section>
          <SectionLabel text={`Em andamento — ${ativas.length}`} />
          <OrderList ordens={ativas} />
        </section>
      )}

      {/* ── Concluídos ─────────────────────────────── */}
      {concluidos.length > 0 && (
        <section>
          <SectionLabel text={`Concluídos — ${concluidos.length}`} />
          <OrderList ordens={concluidos} compact />
        </section>
      )}

      {/* ── Empty state ────────────────────────────── */}
      {ativas.length === 0 && concluidos.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-industrial-800 py-12 text-center">
          <ClipboardList className="h-7 w-7 text-industrial-500" />
          <p className="text-sm text-industrial-500">Nenhuma solicitação ainda.</p>
          <p className="text-xs text-industrial-500">Selecione um insumo acima e envie.</p>
        </div>
      )}
    </div>
  )
}

function Stat({ value, label, dot, pulse }: {
  value: number; label: string; dot: string; pulse?: boolean
}) {
  if (value === 0) return null
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-industrial-800 bg-industrial-900 px-3 py-1">
      <span className={`h-2 w-2 rounded-full ${dot} ${pulse ? 'animate-pulse' : ''}`} />
      <span className="text-xs font-semibold text-industrial-100">{value}</span>
      <span className="text-xs text-industrial-500">{label}</span>
    </div>
  )
}

function SectionLabel({ text }: { text: string }) {
  return (
    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-industrial-500">
      {text}
    </p>
  )
}
