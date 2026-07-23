'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Gauge } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { MATERIAS_PRIMA } from '@/types/formula'
import type { EstoqueAtual, EstoqueConfig, NivelEstoque } from '@/types/estoque'
import { calcularNivel, razaoConsumoHoje, LIMIAR_ALERTA_CONSUMO_HOJE } from '@/types/estoque'
import { cn } from '@/lib/utils/cn'

interface EstoqueTvProps {
  initialEstoque: EstoqueAtual[]
  initialConfig:  EstoqueConfig[]
  /** Toneladas de cada matéria-prima (por chave) já programadas/em andamento pra carregar hoje. */
  consumoHojePorChave: Record<string, number>
}

const NIVEL_STYLE: Record<NivelEstoque, { bar: string; texto: string }> = {
  perigo:        { bar: 'border-red-500 bg-red-100',      texto: 'text-red-800' },
  cuidado:       { bar: 'border-amber-500 bg-amber-100',  texto: 'text-amber-800' },
  tudo_bem:      { bar: 'border-brand-500 bg-brand-50',   texto: 'text-brand-800' },
  bem_tranquilo: { bar: 'border-brand-600 bg-brand-100',  texto: 'text-brand-800' },
}

function fmtTon(n: number): string {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
}

/** Barra de estoque em tempo real pro painel de TV, com termômetro por
 *  matéria-prima (perigo/cuidado/tudo bem/bem tranquilo) + alerta extra se o
 *  que está programado pra carregar hoje for uma fatia grande do estoque
 *  atual. Também avisa (toast) quando um recebimento é confirmado. */
export function EstoqueTv({ initialEstoque, initialConfig, consumoHojePorChave }: EstoqueTvProps) {
  const [estoque, setEstoque] = useState(initialEstoque)
  const supabase = useRef(createClient()).current

  const configPorChave = useMemo(
    () => new Map(initialConfig.map((c) => [c.materia_prima_key, c])),
    [initialConfig],
  )
  const estoquePorChave = useMemo(
    () => new Map(estoque.map((e) => [e.materia_prima_key, e.quantidade_ton])),
    [estoque],
  )

  // Saldo ao vivo: qualquer mudança em estoque_atual atualiza a barra na hora.
  useEffect(() => {
    const channel = supabase
      .channel('estoque_atual_tv')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'estoque_atual' },
        (payload) => {
          const novo = payload.new as EstoqueAtual
          setEstoque((prev) => prev.map((e) => (e.materia_prima_key === novo.materia_prima_key ? novo : e)))
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase])

  // Aviso de chegada: qualquer recebimento confirmado agora dispara um toast.
  useEffect(() => {
    const channel = supabase
      .channel('recebimentos_chegada_tv')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'recebimentos_previstos' },
        (payload) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const novo = payload.new as any
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const antigo = payload.old as any
          if (novo.confirmado_em && !antigo?.confirmado_em) {
            const mp = MATERIAS_PRIMA.find((m) => m.key === novo.materia_prima_key)
            const label = mp?.label ?? novo.materia_prima ?? 'Matéria-prima'
            toast.success(`📦 Chegou: ${label} — ${fmtTon(novo.quantidade_ton ?? 0)} ton`, { duration: 12_000 })
          }
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase])

  const linhas = MATERIAS_PRIMA
    .map((mp) => {
      const qtd = estoquePorChave.get(mp.key) ?? 0
      const config = configPorChave.get(mp.key)
      const nivel = calcularNivel(qtd, config)
      const consumoHoje = consumoHojePorChave[mp.key] ?? 0
      const razao = razaoConsumoHoje(qtd, consumoHoje)
      return { mp, qtd, nivel, razao }
    })
    // só mostra matéria-prima com saldo configurado ou movimentado (evita poluir com zeros irrelevantes)
    .filter((l) => l.qtd !== 0 || configPorChave.has(l.mp.key))

  if (linhas.length === 0) return null

  return (
    <div className="rounded-2xl border-2 border-industrial-700 bg-industrial-900 p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Gauge className="size-5 text-brand-600" />
        <h2 className="text-lg font-bold text-industrial-50">Estoque de Matéria-Prima</h2>
      </div>
      <div className="flex flex-wrap gap-2.5">
        {linhas.map(({ mp, qtd, nivel, razao }) => (
          <div key={mp.key} className={cn('rounded-xl border-2 px-3 py-2 min-w-[130px]', NIVEL_STYLE[nivel].bar)}>
            <p className="text-[11px] font-bold uppercase tracking-wide text-industrial-600">{mp.label}</p>
            <p className={cn('text-2xl font-black font-mono leading-none', NIVEL_STYLE[nivel].texto)}>
              {fmtTon(qtd)} <span className="text-xs font-normal">ton</span>
            </p>
            {razao >= LIMIAR_ALERTA_CONSUMO_HOJE && (
              <p className="flex items-center gap-1 text-[10px] font-bold text-red-700 mt-1">
                <AlertTriangle className="size-3" />
                {razao === Infinity ? 'sem estoque suficiente hoje' : `${Math.round(razao * 100)}% do estoque sai hoje`}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
