'use client'

import { useState, useMemo } from 'react'
import { Search, ChevronDown, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { Formula } from '@/types/formula'
import { INGREDIENTES, calcularIngrediente } from '@/types/formula'
import { ImportarFormulasClient } from './_client'

interface CatalogoFormulasProps {
  formulas: Formula[]
}

export function CatalogoFormulas({ formulas }: CatalogoFormulasProps) {
  const [query, setQuery] = useState('')

  const filtradas = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return formulas
    return formulas.filter((f) => f.nome.toLowerCase().includes(q))
  }, [formulas, query])

  const thCls =
    'px-2 py-2 text-[10px] uppercase tracking-wider text-industrial-400 font-medium whitespace-nowrap border-b border-industrial-700 bg-industrial-900 sticky top-0 z-10'
  const tdCls = 'px-2 py-1.5 border-b border-industrial-800 align-middle'

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-semibold text-industrial-100">Fórmulas</h1>
          <p className="text-xs text-industrial-400 mt-0.5 flex items-center gap-1.5">
            <RefreshCw className="size-3" />
            Sincronizadas automaticamente da planilha do Google Sheets
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-brand-400">{formulas.length}</p>
          <p className="text-xs text-industrial-400">fórmulas no sistema</p>
        </div>
      </div>

      {/* Busca */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-industrial-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar fórmula por nome..."
            className="w-full bg-industrial-900 border border-industrial-600 rounded-lg pl-8 pr-3 py-2 text-sm text-industrial-100 placeholder-industrial-500 focus:outline-none focus:border-brand-500"
          />
        </div>
        <p className="text-xs text-industrial-500">
          Mostrando <span className="text-industrial-300 font-medium">{filtradas.length}</span> de {formulas.length}
        </p>
      </div>

      {/* Tabela */}
      <div className="overflow-auto rounded-lg border border-industrial-700 max-h-[70vh]">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className={cn(thCls, 'text-left min-w-[240px] left-0')}>Fórmula</th>
              {INGREDIENTES.map((ing) => (
                <th key={ing.key} className={cn(thCls, 'text-right w-20')}>
                  {ing.label}
                </th>
              ))}
              <th className={cn(thCls, 'text-right w-20')}>Verif.</th>
            </tr>
          </thead>
          <tbody>
            {filtradas.map((f) => {
              const soma = INGREDIENTES.reduce((s, ing) => s + Number(f[ing.key]), 0)
              const verif = +(soma * 1000).toFixed(1)
              const ok = Math.abs(verif - 1000) < 0.5
              return (
                <tr key={f.id} className="hover:bg-industrial-800/40 transition-colors">
                  <td className={cn(tdCls, 'text-industrial-100 font-medium')}>{f.nome}</td>
                  {INGREDIENTES.map((ing) => {
                    const kg = calcularIngrediente(f, ing.key)
                    return (
                      <td key={ing.key} className={cn(tdCls, 'text-right font-mono text-industrial-300')}>
                        {kg > 0 ? kg.toFixed(1) : <span className="text-industrial-700">0</span>}
                      </td>
                    )
                  })}
                  <td
                    className={cn(
                      tdCls,
                      'text-right font-mono font-bold',
                      ok ? 'text-brand-400' : 'text-red-400',
                    )}
                  >
                    {verif.toFixed(0)}
                  </td>
                </tr>
              )
            })}
            {filtradas.length === 0 && (
              <tr>
                <td colSpan={INGREDIENTES.length + 2} className="text-center py-10 text-industrial-500">
                  {formulas.length === 0
                    ? 'Nenhuma fórmula sincronizada ainda.'
                    : 'Nenhuma fórmula encontrada para essa busca.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Import CSV — opção manual de emergência */}
      <details className="rounded-lg border border-industrial-700 bg-industrial-900/30">
        <summary className="px-4 py-3 text-sm font-medium text-industrial-300 cursor-pointer select-none flex items-center gap-2">
          <ChevronDown className="size-4" />
          Importar fórmulas por CSV (opção manual)
        </summary>
        <div className="border-t border-industrial-700">
          <ImportarFormulasClient />
        </div>
      </details>
    </div>
  )
}
