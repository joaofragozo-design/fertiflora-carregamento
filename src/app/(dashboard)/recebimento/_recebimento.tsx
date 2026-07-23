'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, ChevronLeft, ChevronRight, Truck, CheckCircle2, Package } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { RecebimentosService, type RecebimentoPrevisto } from '@/services/recebimentos.service'
import { FornecedoresService } from '@/services/fornecedores.service'
import { FornecedorPicker } from '@/components/fornecedores/fornecedor-picker'
import { ROUTES } from '@/constants/routes'
import type { Fornecedor } from '@/types/fornecedor'
import { MATERIAS_PRIMA } from '@/types/formula'
import { cn } from '@/lib/utils/cn'

interface RecebimentoSemanaProps {
  initialRecebimentos: RecebimentoPrevisto[]
  initialFornecedores: Fornecedor[]
  semanaInicio:         string
  semanaFim:            string
  hoje:                 string
  podeEditar:           boolean // admin/logistica — lança a previsão
  podeConfirmar:        boolean // admin/faturamento — confirma a chegada
  usuario:              string
}

const DIAS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta']

function pad(n: number): string {
  return String(n).padStart(2, '0')
}
function addDiasIso(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + n)
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
}
function ddmm(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

/** Rótulo da matéria-prima: prioriza a chave estruturada; cai pro texto livre
 *  legado (lançamentos de antes desta tela existir). */
function labelMateriaPrima(r: RecebimentoPrevisto): string {
  const mp = MATERIAS_PRIMA.find((m) => m.key === r.materia_prima_key)
  return mp?.label ?? r.materia_prima ?? '—'
}
function labelFornecedor(r: RecebimentoPrevisto): string {
  return r.fornecedor_obj?.nome ?? r.fornecedor ?? '—'
}

interface FormState {
  data:              string
  materia_prima_key: string
  quantidade_ton:    string
  fornecedor:        string
  fornecedor_id:     string | null
  placa:             string
  observacao:        string
}

export function RecebimentoSemana({
  initialRecebimentos, initialFornecedores, semanaInicio, semanaFim, hoje, podeEditar, podeConfirmar, usuario,
}: RecebimentoSemanaProps) {
  const [recebimentos, setRecebimentos] = useState(initialRecebimentos)
  const [fornecedores, setFornecedores] = useState(initialFornecedores)
  const [form, setForm] = useState<FormState | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null)
  const svc = useRef(new RecebimentosService(createClient())).current
  const fornecedoresSvc = useRef(new FornecedoresService(createClient())).current
  const router = useRouter()

  const amanha = addDiasIso(hoje, 1)

  const dias = useMemo(
    () => DIAS.map((nome, i) => ({ nome, data: addDiasIso(semanaInicio, i) })),
    [semanaInicio],
  )

  const doDia = (data: string) => recebimentos.filter((r) => r.data_prevista === data)
  const totalDia = (data: string) => doDia(data).reduce((s, r) => s + (r.quantidade_ton ?? 0), 0)
  const totalSemana = useMemo(() => recebimentos.reduce((s, r) => s + (r.quantidade_ton ?? 0), 0), [recebimentos])

  function irParaSemana(inicio: string) {
    router.push(`${ROUTES.RECEBIMENTO}?semana=${inicio}`)
  }

  async function adicionarFornecedor(nome: string): Promise<Fornecedor> {
    const novo = await fornecedoresSvc.criar(nome)
    setFornecedores((prev) => (prev.some((f) => f.id === novo.id) ? prev : [...prev, novo].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))))
    return novo
  }

  function abrirNovo(data: string) {
    setForm({ data, materia_prima_key: '', quantidade_ton: '', fornecedor: '', fornecedor_id: null, placa: '', observacao: '' })
  }

  async function lancar() {
    if (!form) return
    if (!form.materia_prima_key) {
      toast.error('Selecione a matéria-prima.')
      return
    }
    const tons = Number(form.quantidade_ton.replace(',', '.')) || 0
    if (tons <= 0) {
      toast.error('Informe uma quantidade maior que zero.')
      return
    }
    if (!form.placa.trim()) {
      toast.error('Informe a placa do caminhão.')
      return
    }
    if (!form.fornecedor_id) {
      toast.error('Selecione o fornecedor (ou cadastre um novo) antes de lançar.')
      return
    }
    setSalvando(true)
    try {
      const novo = await svc.criar({
        data_prevista: form.data,
        materia_prima_key: form.materia_prima_key,
        quantidade_ton: tons,
        fornecedor_id: form.fornecedor_id,
        placa: form.placa,
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

  async function confirmarChegada(r: RecebimentoPrevisto) {
    setConfirmandoId(r.id)
    try {
      const upd = await svc.confirmarChegada(r.id, usuario)
      setRecebimentos((prev) => prev.map((x) => (x.id === upd.id ? upd : x)))
      toast.success(`Chegada de ${labelMateriaPrima(upd)} confirmada.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao confirmar chegada.')
    } finally {
      setConfirmandoId(null)
    }
  }

  async function remover(r: RecebimentoPrevisto) {
    if (!window.confirm(`Remover a previsão de ${labelMateriaPrima(r)}?`)) return
    try {
      await svc.deletar(r.id)
      setRecebimentos((prev) => prev.filter((x) => x.id !== r.id))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao remover.')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Cabeçalho + navegação de semana */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-semibold text-industrial-100">Programação de Recebimento</h1>
          <div className="flex items-center gap-1.5 mt-2">
            <button type="button" onClick={() => irParaSemana(addDiasIso(semanaInicio, -7))} aria-label="Semana anterior"
              className="rounded-lg border border-industrial-700 p-1.5 text-industrial-400 hover:text-industrial-100 hover:border-brand-500 transition-colors">
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-sm font-medium text-industrial-200 px-2">
              Semana de {ddmm(semanaInicio)} a {ddmm(addDiasIso(semanaInicio, 4))}
            </span>
            <button type="button" onClick={() => irParaSemana(addDiasIso(semanaInicio, 7))} aria-label="Próxima semana"
              className="rounded-lg border border-industrial-700 p-1.5 text-industrial-400 hover:text-industrial-100 hover:border-brand-500 transition-colors">
              <ChevronRight className="size-4" />
            </button>
          </div>
          {!podeEditar && !podeConfirmar && (
            <p className="text-xs text-industrial-400 mt-1.5">Prévia (somente leitura).</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-xs text-industrial-400">Total da semana</p>
          <p className="text-2xl font-bold text-brand-600">{totalSemana.toFixed(2)} <span className="text-sm font-normal text-industrial-400">ton</span></p>
        </div>
      </div>

      {/* Grade da semana */}
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {dias.map(({ nome, data }) => {
          const ehAmanha = data === amanha
          const ehHoje = data === hoje
          return (
            <div
              key={data}
              className={cn(
                'flex flex-col gap-2 rounded-xl border p-2.5',
                ehAmanha ? 'border-brand-500 bg-brand-50' : ehHoje ? 'border-industrial-500' : 'border-industrial-800',
              )}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-industrial-100">{nome}</p>
                  <p className="text-xs text-industrial-400">
                    {ddmm(data)}{ehAmanha && <span className="ml-1 text-brand-700 font-semibold">· amanhã</span>}{ehHoje && <span className="ml-1 text-industrial-500 font-semibold">· hoje</span>}
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-brand-700">{totalDia(data).toFixed(2)}</span>
              </div>

              <div className="flex flex-col gap-2">
                {doDia(data).map((r) => (
                  <div
                    key={r.id}
                    className={cn(
                      'rounded-lg border p-2 transition-colors',
                      r.confirmado_em ? 'border-brand-500 bg-brand-100' : 'border-industrial-700 bg-industrial-900',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-industrial-100 text-sm leading-tight flex items-center gap-1.5">
                        {labelMateriaPrima(r)}
                        {r.confirmado_em && (
                          <span
                            className="inline-flex shrink-0"
                            title={`Chegou às ${new Date(r.confirmado_em).toLocaleTimeString('pt-BR')}${r.confirmado_por ? ` · confirmado por ${r.confirmado_por}` : ''}`}
                          >
                            <Truck className="size-3.5 text-brand-600" />
                          </span>
                        )}
                      </span>
                      {podeEditar && (
                        <button type="button" onClick={() => remover(r)} title="Remover previsão"
                          className="text-industrial-400 hover:text-red-600"><X className="size-3.5" /></button>
                      )}
                    </div>
                    <p className="text-xs text-industrial-500 mt-1">
                      <span className="font-bold text-industrial-300">{(r.quantidade_ton ?? 0).toFixed(2)} ton</span>
                      {' · '}{labelFornecedor(r)}
                    </p>
                    {r.placa && <p className="text-xs font-mono text-industrial-400 uppercase mt-0.5">Placa: {r.placa}</p>}
                    {r.observacao && <p className="text-xs text-industrial-400 italic mt-1">{r.observacao}</p>}

                    {podeConfirmar && (
                      <div className="mt-1.5">
                        {r.confirmado_em ? (
                          <span className="flex items-center gap-1 text-[11px] font-semibold text-brand-700">
                            <CheckCircle2 className="size-3" /> Chegou às {new Date(r.confirmado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => confirmarChegada(r)}
                            disabled={confirmandoId === r.id}
                            className="flex items-center gap-1 text-[11px] font-semibold text-brand-700 hover:text-brand-800 transition-colors disabled:opacity-50"
                          >
                            <Truck className="size-3" />
                            {confirmandoId === r.id ? 'Confirmando…' : 'Confirmar chegada do caminhão'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {doDia(data).length === 0 && (
                  <p className="text-xs text-industrial-500 text-center py-2">—</p>
                )}

                {podeEditar && (
                  <button type="button" onClick={() => abrirNovo(data)}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-industrial-600 py-1.5 text-xs font-medium text-industrial-400 hover:border-brand-500 hover:text-brand-700 transition-colors">
                    <Plus className="size-3.5" /> Adicionar recebimento
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal de novo recebimento */}
      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setForm(null)}>
          <div className="w-full max-w-md rounded-xl bg-industrial-900 border border-industrial-700 p-5 flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-industrial-100 flex items-center gap-2">
                <Package className="size-4 text-brand-600" /> Novo recebimento · {ddmm(form.data)}
              </h2>
              <button type="button" onClick={() => setForm(null)} className="text-industrial-400 hover:text-industrial-100"><X className="size-5" /></button>
            </div>

            <label className="text-xs font-medium text-industrial-400">Matéria-prima
              <select
                value={form.materia_prima_key}
                onChange={(e) => setForm({ ...form, materia_prima_key: e.target.value })}
                className="mt-1 w-full bg-industrial-950 border border-industrial-600 rounded-lg px-3 py-2 text-sm text-industrial-100 focus:outline-none focus:border-brand-500"
              >
                <option value="">Selecionar…</option>
                {MATERIAS_PRIMA.map((mp) => (
                  <option key={mp.key} value={mp.key}>{mp.label}</option>
                ))}
              </select>
            </label>

            <div className="text-xs font-medium text-industrial-400">Fornecedor
              <div className="mt-1">
                <FornecedorPicker
                  value={form.fornecedor}
                  fornecedores={fornecedores}
                  onChange={(nome, id) => setForm({ ...form, fornecedor: nome, fornecedor_id: id })}
                  onCriar={adicionarFornecedor}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-medium text-industrial-400">Quantidade (ton)
                <input value={form.quantidade_ton} onChange={(e) => setForm({ ...form, quantidade_ton: e.target.value })}
                  placeholder="ex.: 35"
                  className="mt-1 w-full bg-industrial-950 border border-industrial-600 rounded-lg px-3 py-2 text-sm font-mono text-industrial-100 placeholder-industrial-500 focus:outline-none focus:border-brand-500" />
              </label>
              <label className="text-xs font-medium text-industrial-400">Placa do caminhão
                <input value={form.placa} onChange={(e) => setForm({ ...form, placa: e.target.value.toUpperCase() })}
                  placeholder="ABC1D23"
                  className="mt-1 w-full bg-industrial-950 border border-industrial-600 rounded-lg px-3 py-2 text-sm font-mono uppercase text-industrial-100 placeholder-industrial-500 focus:outline-none focus:border-brand-500" />
              </label>
            </div>

            <label className="text-xs font-medium text-industrial-400">Observação (opcional)
              <input value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })}
                placeholder="ex.: NF-e 116533"
                className="mt-1 w-full bg-industrial-950 border border-industrial-600 rounded-lg px-3 py-2 text-sm text-industrial-100 placeholder-industrial-500 focus:outline-none focus:border-brand-500" />
            </label>

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setForm(null)}
                className="rounded-lg border border-industrial-600 px-4 py-2 text-sm font-medium text-industrial-300 hover:bg-industrial-800">Cancelar</button>
              <button
                type="button"
                onClick={lancar}
                disabled={salvando || !form.materia_prima_key || !form.placa.trim() || !form.fornecedor_id}
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
