'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { Printer, ArrowLeft } from 'lucide-react'
import { ROUTES } from '@/constants/routes'
import type { OrdemDiaria, Formula, StatusOrdem } from '@/types/formula'
import { INGREDIENTES, EMBALAGEM_LABEL, calcularIngrediente, getStatus } from '@/types/formula'
import { cn } from '@/lib/utils/cn'

interface RelatorioDiarioProps {
  ordens: OrdemDiaria[]
  data:   string
}

const STATUS_LABEL: Record<StatusOrdem, string> = {
  AGUARDANDO:   'Aguardando',
  EM_ANDAMENTO: 'Em andamento',
  FINALIZADO:   'Finalizado',
}

// Fundo da linha por status — claro e legível, força impressão da cor.
const ROW_STYLES: Record<StatusOrdem, string> = {
  AGUARDANDO:   '',
  EM_ANDAMENTO: 'bg-amber-200 print:bg-amber-200',
  FINALIZADO:   'bg-brand-200 print:bg-brand-200',
}

function fmtKg(n: number): string {
  return n.toFixed(1).replace(/\.0$/, '')
}

function fmtNum(n: number, casas = 0): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })
}

export function RelatorioDiario({ ordens, data }: RelatorioDiarioProps) {
  const totalTons = useMemo(() => ordens.reduce((s, o) => s + (o.tons ?? 0), 0), [ordens])

  // Consumo de matéria-prima do dia: Σ (tons da ordem × kg/ton do ingrediente).
  const consumo = useMemo(() => {
    const acc: Record<string, number> = {}
    for (const o of ordens) {
      const f = o.formula as Formula | undefined
      if (!f) continue
      const tons = o.tons ?? 0
      for (const ing of INGREDIENTES) {
        const kgPorTon = calcularIngrediente(f, ing.key)
        if (kgPorTon > 0) acc[ing.key] = (acc[ing.key] ?? 0) + tons * kgPorTon
      }
    }
    return INGREDIENTES
      .map((ing) => ({ ing, kg: acc[ing.key] ?? 0 }))
      .filter((x) => x.kg > 0)
      .sort((a, b) => b.kg - a.kg)
  }, [ordens])

  const dataLonga = new Date(data + 'T12:00:00').toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  })

  const th = 'px-2 py-1.5 text-left text-[10px] uppercase tracking-wider text-industrial-500 font-semibold border-b-2 border-industrial-700 whitespace-nowrap'
  const td = 'px-2 py-1.5 border-b border-industrial-700 align-middle text-industrial-100'

  return (
    <div className="flex flex-col gap-5 text-industrial-100 print:text-black">
      {/* Regras de impressão: força cores de fundo e margem de página */}
      <style>{`@media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        @page { size: landscape; margin: 10mm; }
      }`}</style>

      {/* Ações (não imprimem) */}
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Link
          href={ROUTES.ORDENS}
          className="flex items-center gap-1.5 text-sm text-industrial-400 hover:text-industrial-100 transition-colors"
        >
          <ArrowLeft className="size-4" /> Voltar
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center gap-2 rounded-lg bg-brand-700 hover:bg-brand-600 text-white px-4 py-2 text-sm font-medium transition-colors"
        >
          <Printer className="size-4" /> Imprimir
        </button>
      </div>

      {/* Cabeçalho do relatório */}
      <div className="border-b-2 border-industrial-700 pb-3">
        <h1 className="text-xl font-bold text-industrial-50 print:text-black">FERTIFLORA — Relatório Diário de Carregamento</h1>
        <p className="text-sm text-industrial-400 capitalize mt-0.5">{dataLonga}</p>
        <div className="flex gap-6 mt-3 text-sm">
          <div>
            <span className="text-industrial-400">Ordens: </span>
            <span className="font-bold text-industrial-100 print:text-black">{ordens.length}</span>
          </div>
          <div>
            <span className="text-industrial-400">Total do dia: </span>
            <span className="font-bold text-brand-700">{totalTons.toFixed(2)} ton</span>
          </div>
        </div>
      </div>

      {/* Tabela de ordens */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className={cn(th, 'text-center w-8')}>#</th>
              <th className={cn(th, 'min-w-[120px]')}>Cliente</th>
              <th className={cn(th, 'text-center w-24')}>Status</th>
              <th className={cn(th, 'w-24')}>Placa</th>
              <th className={cn(th, 'text-center w-16')}>Envel.</th>
              <th className={cn(th, 'text-right w-16')}>Quant.</th>
              <th className={cn(th, 'text-center w-20')}>Embalagem</th>
              <th className={cn(th, 'text-right w-16')}>Tons</th>
              <th className={cn(th, 'min-w-[190px]')}>Fórmula</th>
              <th className={cn(th, 'min-w-[260px]')}>Ingredientes (kg/ton)</th>
            </tr>
          </thead>
          <tbody>
            {ordens.map((o) => {
              const status = getStatus(o)
              const f = o.formula as Formula | undefined
              const usados = f
                ? INGREDIENTES.map((ing) => ({ ing, kg: calcularIngrediente(f, ing.key) })).filter((x) => x.kg > 0)
                : []
              return (
                <tr key={o.id} className={cn(ROW_STYLES[status], 'print:text-black')}>
                  <td className={cn(td, 'text-center font-mono text-industrial-500')}>{o.sequencia}</td>
                  <td className={cn(td, 'font-medium')}>{o.cliente || '—'}</td>
                  <td className={cn(td, 'text-center font-semibold')}>{STATUS_LABEL[status]}</td>
                  <td className={cn(td, 'font-mono uppercase')}>{o.placa || '—'}</td>
                  <td className={cn(td, 'text-center font-bold')}>{o.envelopar ? 'SIM' : 'NÃO'}</td>
                  <td className={cn(td, 'text-right font-mono')}>{o.quantidade}</td>
                  <td className={cn(td, 'text-center')}>{EMBALAGEM_LABEL[o.embalagem]}</td>
                  <td className={cn(td, 'text-right font-mono font-bold text-brand-700')}>{(o.tons ?? 0).toFixed(2)}</td>
                  <td className={cn(td, 'font-bold')}>{f?.nome ?? '—'}</td>
                  <td className={td}>
                    {f ? (
                      <div className="flex flex-wrap gap-1">
                        {usados.map(({ ing, kg }) => (
                          <span key={ing.key} className="inline-flex items-center gap-1 rounded border border-industrial-600 px-1.5 py-0.5">
                            <span className="text-[10px] text-industrial-500">{ing.label}</span>
                            <span className="text-[10px] font-mono font-bold">{fmtKg(kg)}</span>
                          </span>
                        ))}
                      </div>
                    ) : '—'}
                  </td>
                </tr>
              )
            })}
            {ordens.length === 0 && (
              <tr><td colSpan={10} className="text-center py-8 text-industrial-400">Nenhuma ordem neste dia.</td></tr>
            )}
          </tbody>
          {ordens.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={7} className="px-2 py-2 text-right text-xs font-semibold text-industrial-300">Total do dia:</td>
                <td className="px-2 py-2 text-right font-mono font-bold text-brand-700">{totalTons.toFixed(2)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Consumo de matéria-prima do dia */}
      {consumo.length > 0 && (
        <div className="break-inside-avoid">
          <h2 className="text-sm font-bold text-industrial-50 print:text-black mb-2">Consumo de matéria-prima do dia</h2>
          <table className="w-full max-w-2xl text-xs border-collapse">
            <thead>
              <tr>
                <th className={cn(th)}>Ingrediente</th>
                <th className={cn(th, 'text-right')}>Total (kg)</th>
                <th className={cn(th, 'text-right')}>Total (ton)</th>
              </tr>
            </thead>
            <tbody>
              {consumo.map(({ ing, kg }) => (
                <tr key={ing.key}>
                  <td className={cn(td, 'font-medium')}>{ing.label}</td>
                  <td className={cn(td, 'text-right font-mono')}>{fmtNum(kg)}</td>
                  <td className={cn(td, 'text-right font-mono')}>{fmtNum(kg / 1000, 2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="px-2 py-2 text-xs font-bold text-industrial-100 print:text-black">Total geral</td>
                <td className="px-2 py-2 text-right font-mono font-bold text-brand-700">
                  {fmtNum(consumo.reduce((s, x) => s + x.kg, 0))}
                </td>
                <td className="px-2 py-2 text-right font-mono font-bold text-brand-700">
                  {fmtNum(consumo.reduce((s, x) => s + x.kg, 0) / 1000, 2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
