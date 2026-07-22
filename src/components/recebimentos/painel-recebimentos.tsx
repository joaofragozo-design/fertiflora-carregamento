'use client'

import { useMemo, useRef, useState } from 'react'
import { Plus, X, Package, Check, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { RecebimentosService, type RecebimentoPrevisto } from '@/services/recebimentos.service'
import { cn } from '@/lib/utils/cn'

interface PainelRecebimentosProps {
  initialRecebimentos: RecebimentoPrevisto[]
  podeEditar:          boolean // admin/logistica lançam; demais só veem
}

interface FormState {
  data_prevista:  string
  materia_prima:  string
  quantidade_ton: string
  fornecedor:     string
  observacao:     string
}

function fmtData(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })
}

/** Previsão de chegada de matéria-prima: a Logística lança, a equipe acompanha
 *  (aparece também no painel de TV). */
export function PainelRecebimentos({ initialRecebimentos, podeEditar }: PainelRecebimentosProps) {
  const [recebimentos, setRecebimentos] = useState(initialRecebimentos)
  const [form, setForm] = useState<FormState | null>(null)
  const [salvando, setSalvando] = useState(false)
  const svc = useRef(new RecebimentosService(createClient())).current

  const ordenados = useMemo(
    () => [...recebimentos].sort((a, b) => a.data_prevista.localeCompare(b.data_prevista)),
    [recebimentos],
  )

  async function lancar() {
    if (!form) return
    const tons = Number(form.quantidade_ton.replace(',', '.')) || 0
    setSalvando(true)
    try {
      const novo = await svc.criar({
        data_prevista: form.data_prevista,
        materia_prima: form.materia_prima.trim(),
        quantidade_ton: tons,
        fornecedor: form.fornecedor.trim(),
        observacao: form.observacao.trim(),
      })
      setRecebimentos((prev) => [...prev, novo])
      setForm(null)
      toast.success('Recebimento lançado.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao lançar recebimento.')
    } finally {
      setSalvando(false)
    }
  }

  async function marcarRecebido(r: RecebimentoPrevisto) {
    try {
      await svc.marcarRecebido(r.id)
      setRecebimentos((prev) => prev.filter((x) => x.id !== r.id))
      toast.success(`${r.materia_prima} marcado como recebido.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao marcar como recebido.')
    }
  }

  async function remover(r: RecebimentoPrevisto) {
    if (!window.confirm(`Remover a previsão de ${r.materia_prima}?`)) return
    try {
      await svc.deletar(r.id)
      setRecebimentos((prev) => prev.filter((x) => x.id !== r.id))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao remover.')
    }
  }

  if (!podeEditar && ordenados.length === 0) return null

  return (
    <div className="rounded-xl border border-industrial-800 p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-industrial-400">
          <Package className="size-3.5 text-brand-600" /> Matéria-prima chegando
        </p>
        {podeEditar && (
          <button
            type="button"
            onClick={() => setForm({
              data_prevista: new Date().toISOString().slice(0, 10),
              materia_prima: '', quantidade_ton: '', fornecedor: '', observacao: '',
            })}
            className="flex items-center gap-1 text-[11px] font-semibold text-industrial-500 hover:text-brand-700 transition-colors"
          >
            <Plus className="size-3" /> Lançar recebimento
          </button>
        )}
      </div>

      {ordenados.length === 0 ? (
        <p className="text-xs text-industrial-500 py-1">Nenhum recebimento previsto.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {ordenados.map((r) => (
            <div key={r.id} className="flex items-center gap-3 rounded-lg bg-industrial-950 border border-industrial-700 px-3 py-2">
              <div>
                <p className="text-xs font-bold text-industrial-100">
                  {r.materia_prima}
                  {r.quantidade_ton > 0 && (
                    <span className="font-mono text-brand-600"> · {r.quantidade_ton.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ton</span>
                  )}
                </p>
                <p className="text-[11px] text-industrial-500 capitalize">
                  {fmtData(r.data_prevista)}
                  {r.fornecedor && <span> · {r.fornecedor}</span>}
                  {r.observacao && <span className="italic"> · {r.observacao}</span>}
                </p>
              </div>
              {podeEditar && (
                <div className="flex gap-1.5 shrink-0">
                  <button type="button" onClick={() => marcarRecebido(r)} title="Marcar como recebido"
                    className="text-industrial-500 hover:text-brand-700"><Check className="size-3.5" /></button>
                  <button type="button" onClick={() => remover(r)} title="Remover previsão"
                    className="text-industrial-500 hover:text-red-600"><Trash2 className="size-3.5" /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal de lançamento */}
      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setForm(null)}>
          <div className="w-full max-w-md rounded-xl bg-industrial-900 border border-industrial-700 p-5 flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-industrial-100">Lançar recebimento de matéria-prima</h2>
              <button type="button" onClick={() => setForm(null)} className="text-industrial-400 hover:text-industrial-100"><X className="size-5" /></button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-medium text-industrial-400">Data prevista
                <input type="date" value={form.data_prevista} onChange={(e) => setForm({ ...form, data_prevista: e.target.value })}
                  className="mt-1 w-full bg-industrial-950 border border-industrial-600 rounded-lg px-3 py-2 text-sm text-industrial-100 focus:outline-none focus:border-brand-500" />
              </label>
              <label className="text-xs font-medium text-industrial-400">Quantidade (ton)
                <input value={form.quantidade_ton} onChange={(e) => setForm({ ...form, quantidade_ton: e.target.value })}
                  placeholder="ex.: 35"
                  className="mt-1 w-full bg-industrial-950 border border-industrial-600 rounded-lg px-3 py-2 text-sm font-mono text-industrial-100 placeholder-industrial-500 focus:outline-none focus:border-brand-500" />
              </label>
            </div>

            <label className="text-xs font-medium text-industrial-400">Matéria-prima
              <input autoFocus value={form.materia_prima} onChange={(e) => setForm({ ...form, materia_prima: e.target.value })}
                placeholder="ex.: UREIA, MAP, CLORETO…"
                className="mt-1 w-full bg-industrial-950 border border-industrial-600 rounded-lg px-3 py-2 text-sm text-industrial-100 placeholder-industrial-500 focus:outline-none focus:border-brand-500" />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-medium text-industrial-400">Fornecedor (opcional)
                <input value={form.fornecedor} onChange={(e) => setForm({ ...form, fornecedor: e.target.value })}
                  placeholder="ex.: CALTIM"
                  className="mt-1 w-full bg-industrial-950 border border-industrial-600 rounded-lg px-3 py-2 text-sm text-industrial-100 placeholder-industrial-500 focus:outline-none focus:border-brand-500" />
              </label>
              <label className="text-xs font-medium text-industrial-400">Observação (opcional)
                <input value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })}
                  className="mt-1 w-full bg-industrial-950 border border-industrial-600 rounded-lg px-3 py-2 text-sm text-industrial-100 placeholder-industrial-500 focus:outline-none focus:border-brand-500" />
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setForm(null)}
                className="rounded-lg border border-industrial-600 px-4 py-2 text-sm font-medium text-industrial-300 hover:bg-industrial-800">Cancelar</button>
              <button
                type="button"
                onClick={lancar}
                disabled={salvando || !form.materia_prima.trim() || !form.data_prevista}
                className="rounded-lg bg-brand-700 hover:bg-brand-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {salvando ? 'Lançando…' : 'Lançar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** Versão só-leitura pro painel de TV: grandes, sem ações. */
export function RecebimentosTv({ recebimentos }: { recebimentos: RecebimentoPrevisto[] }) {
  if (recebimentos.length === 0) return null
  const ordenados = [...recebimentos].sort((a, b) => a.data_prevista.localeCompare(b.data_prevista))
  return (
    <div className="mt-2">
      <div className="flex items-center gap-2 text-sm font-semibold text-industrial-400 uppercase tracking-wide border-t border-industrial-700 pt-3 mb-3">
        <Package className="size-4 text-brand-600" />
        Matéria-prima chegando
      </div>
      <div className="flex flex-wrap gap-3">
        {ordenados.map((r) => (
          <div key={r.id} className={cn('rounded-xl border px-4 py-2.5', 'border-industrial-800 bg-industrial-900')}>
            <p className="text-lg font-bold text-industrial-50">
              {r.materia_prima}
              {r.quantidade_ton > 0 && (
                <span className="font-mono text-brand-700"> · {r.quantidade_ton.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ton</span>
              )}
            </p>
            <p className="text-sm text-industrial-500 capitalize">
              {fmtData(r.data_prevista)}
              {r.fornecedor && <span> · {r.fornecedor}</span>}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
