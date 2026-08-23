'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, ChevronLeft, ChevronRight, Truck, CheckCircle2, Package, PlayCircle, Flag, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { RecebimentosService, type RecebimentoPrevisto, STATUS_RECEBIMENTO_LABEL, getStatusRecebimento, labelPlacaCompleta } from '@/services/recebimentos.service'
import { FornecedoresService } from '@/services/fornecedores.service'
import { FornecedorPicker } from '@/components/fornecedores/fornecedor-picker'
import { EstoqueConfigPainel } from '@/components/estoque/estoque-config-painel'
import { FilaOperacao } from '@/components/recebimentos/fila-operacao'
import { MapaChegadas } from '@/components/recebimentos/mapa-chegadas'
import { useRecebimentosSemana } from '@/hooks/use-recebimentos-semana'
import { ROUTES } from '@/constants/routes'
import type { Fornecedor } from '@/types/fornecedor'
import type { Transportadora } from '@/types/transportadora'
import type { EstoqueAtual, EstoqueConfig } from '@/types/estoque'
import { MATERIAS_PRIMA } from '@/types/formula'
import { cn } from '@/lib/utils/cn'

interface RecebimentoSemanaProps {
  initialRecebimentos: RecebimentoPrevisto[]
  initialFornecedores: Fornecedor[]
  initialTransportadoras: Transportadora[]
  initialEstoqueConfig: EstoqueConfig[]
  initialEstoqueAtual:  EstoqueAtual[]
  semanaInicio:         string
  semanaFim:            string
  hoje:                 string
  podeEditar:           boolean // admin/logistica — lança a previsão
  podeConfirmar:        boolean // admin/faturamento — confirma chegada e inicia/finaliza a descarga
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
  transportadora_id: string
  motorista_nome:    string
  numero_nota:       string
  placa_cavalo:      string
  placa_1:           string
  placa_2:           string
  placa_3:           string
  placa_4:           string
  observacao:        string
}

export function RecebimentoSemana({
  initialRecebimentos, initialFornecedores, initialTransportadoras, initialEstoqueConfig, initialEstoqueAtual, semanaInicio, semanaFim, hoje, podeEditar, podeConfirmar, usuario,
}: RecebimentoSemanaProps) {
  const { recebimentos, setRecebimentos } = useRecebimentosSemana(initialRecebimentos, semanaInicio, semanaFim)
  const [fornecedores, setFornecedores] = useState(initialFornecedores)
  const [form, setForm] = useState<FormState | null>(null)
  // null = criando um recebimento novo; id = editando um já existente (o
  // mesmo formulário serve pros dois casos).
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  // Confirmar/iniciar/finalizar nunca acontecem ao mesmo tempo na mesma linha
  // (são 3 cliques sequenciais do Faturamento) — um único id de "processando"
  // serve pros 3 botões, tanto na Fila de Operação quanto no card do dia.
  const [processandoId, setProcessandoId] = useState<string | null>(null)
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

  async function editarFornecedor(fornecedor: Fornecedor, novoNome: string): Promise<Fornecedor> {
    const atualizado = await fornecedoresSvc.atualizar(fornecedor.id, novoNome)
    setFornecedores((prev) => prev.map((f) => (f.id === atualizado.id ? atualizado : f)).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')))
    toast.success(`Fornecedor renomeado para "${atualizado.nome}".`)
    return atualizado
  }

  function abrirNovo(data: string) {
    setEditandoId(null)
    setForm({
      data, materia_prima_key: '', quantidade_ton: '', fornecedor: '', fornecedor_id: null,
      transportadora_id: '', motorista_nome: '', numero_nota: '',
      placa_cavalo: '', placa_1: '', placa_2: '', placa_3: '', placa_4: '', observacao: '',
    })
  }

  function fecharModal() {
    setForm(null)
    setEditandoId(null)
  }

  function abrirEdicao(r: RecebimentoPrevisto) {
    setEditandoId(r.id)
    setForm({
      data: r.data_prevista,
      materia_prima_key: r.materia_prima_key ?? '',
      quantidade_ton: String(r.quantidade_ton ?? ''),
      fornecedor: labelFornecedor(r),
      fornecedor_id: r.fornecedor_id,
      transportadora_id: r.transportadora_id ?? '',
      motorista_nome: r.motorista_nome ?? '',
      numero_nota: r.numero_nota ?? '',
      placa_cavalo: r.placa_cavalo || r.placa || '',
      placa_1: r.placa_1 ?? '',
      placa_2: r.placa_2 ?? '',
      placa_3: r.placa_3 ?? '',
      placa_4: r.placa_4 ?? '',
      observacao: r.observacao ?? '',
    })
  }

  async function salvar() {
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
    if (!form.fornecedor_id) {
      toast.error('Selecione o fornecedor (ou cadastre um novo) antes de lançar.')
      return
    }
    if (!form.placa_cavalo.trim()) {
      toast.error('Informe a placa do veículo.')
      return
    }
    setSalvando(true)
    try {
      const dados = {
        data_prevista: form.data,
        materia_prima_key: form.materia_prima_key,
        quantidade_ton: tons,
        fornecedor_id: form.fornecedor_id,
        transportadora_id: form.transportadora_id || null,
        motorista_nome: form.motorista_nome,
        numero_nota: form.numero_nota,
        placa_cavalo: form.placa_cavalo,
        placa_1: form.placa_1,
        placa_2: form.placa_2,
        placa_3: form.placa_3,
        placa_4: form.placa_4,
        observacao: form.observacao.trim(),
      }

      if (editandoId) {
        const atualizado = await svc.atualizar(editandoId, dados)
        setRecebimentos((prev) => prev.map((x) => (x.id === atualizado.id ? atualizado : x)))
        toast.success('Recebimento atualizado.')
      } else {
        const novo = await svc.criar(dados)
        setRecebimentos((prev) => [...prev, novo])
        toast.success('Recebimento lançado.')
      }
      setForm(null)
      setEditandoId(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar recebimento.')
    } finally {
      setSalvando(false)
    }
  }

  async function confirmarChegada(r: RecebimentoPrevisto) {
    setProcessandoId(r.id)
    try {
      const upd = await svc.confirmarChegada(r.id, usuario)
      setRecebimentos((prev) => prev.map((x) => (x.id === upd.id ? upd : x)))
      toast.success(`Chegada de ${labelMateriaPrima(upd)} confirmada.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao confirmar chegada.')
    } finally {
      setProcessandoId(null)
    }
  }

  async function iniciarDescarga(r: RecebimentoPrevisto) {
    setProcessandoId(r.id)
    try {
      const upd = await svc.iniciarDescarga(r.id, usuario)
      setRecebimentos((prev) => prev.map((x) => (x.id === upd.id ? upd : x)))
      toast.success('Descarga iniciada.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao iniciar a descarga.')
    } finally {
      setProcessandoId(null)
    }
  }

  async function finalizarDescarga(r: RecebimentoPrevisto) {
    setProcessandoId(r.id)
    try {
      const upd = await svc.finalizarDescarga(r.id, usuario)
      setRecebimentos((prev) => prev.map((x) => (x.id === upd.id ? upd : x)))
      toast.success('Descarga finalizada — matéria-prima somada ao estoque.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao finalizar a descarga.')
    } finally {
      setProcessandoId(null)
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
          <h1 className="font-display tracking-tight text-lg font-semibold text-industrial-900">Programação de Recebimento</h1>
          <div className="flex items-center gap-1.5 mt-2">
            <button type="button" onClick={() => irParaSemana(addDiasIso(semanaInicio, -7))} aria-label="Semana anterior"
              className="rounded-lg border border-industrial-300 p-1.5 text-industrial-600 hover:text-industrial-900 hover:border-brand-500 transition-colors">
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-sm font-medium text-industrial-800 px-2">
              Semana de {ddmm(semanaInicio)} a {ddmm(addDiasIso(semanaInicio, 4))}
            </span>
            <button type="button" onClick={() => irParaSemana(addDiasIso(semanaInicio, 7))} aria-label="Próxima semana"
              className="rounded-lg border border-industrial-300 p-1.5 text-industrial-600 hover:text-industrial-900 hover:border-brand-500 transition-colors">
              <ChevronRight className="size-4" />
            </button>
          </div>
          {!podeEditar && !podeConfirmar && (
            <p className="text-xs text-industrial-600 mt-1.5">Prévia (somente leitura).</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-xs text-industrial-600">Total da semana</p>
          <p className="text-2xl font-bold text-brand-600">{totalSemana.toFixed(2)} <span className="text-sm font-normal text-industrial-600">ton</span></p>
        </div>
      </div>

      {podeConfirmar && (
        <FilaOperacao
          recebimentos={recebimentos}
          processandoId={processandoId}
          onConfirmarChegada={confirmarChegada}
          onIniciarDescarga={iniciarDescarga}
          onFinalizarDescarga={finalizarDescarga}
        />
      )}

      {/* GPS ao vivo é só acompanhamento (sem ação) — libera pra quem programa
          o recebimento (logistica) também, não só quem confirma a chegada. */}
      {(podeConfirmar || podeEditar) && <MapaChegadas recebimentos={recebimentos} />}

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
                ehAmanha ? 'border-brand-500 bg-brand-500/10' : ehHoje ? 'border-industrial-500' : 'border-industrial-200',
              )}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-industrial-900">{nome}</p>
                  <p className="text-xs text-industrial-600">
                    {ddmm(data)}{ehAmanha && <span className="ml-1 text-brand-300 font-semibold">· amanhã</span>}{ehHoje && <span className="ml-1 text-industrial-500 font-semibold">· hoje</span>}
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-brand-300">{totalDia(data).toFixed(2)}</span>
              </div>

              <div className="flex flex-col gap-2">
                {doDia(data).map((r) => (
                  <div
                    key={r.id}
                    className={cn(
                      'rounded-lg border p-2 transition-colors',
                      r.confirmado_em ? 'border-brand-500 bg-brand-500/15' : 'border-industrial-300 bg-industrial-100',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-industrial-900 text-sm leading-tight flex items-center gap-1.5">
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
                        <div className="flex items-center gap-2 shrink-0">
                          {!r.finalizado_em && (
                            <button type="button" onClick={() => abrirEdicao(r)} title="Editar recebimento"
                              className="text-industrial-600 hover:text-brand-300"><Pencil className="size-3.5" /></button>
                          )}
                          <button type="button" onClick={() => remover(r)} title="Remover previsão"
                            className="text-industrial-600 hover:text-red-400"><X className="size-3.5" /></button>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-industrial-500 mt-1">
                      <span className="font-bold text-industrial-700">{(r.quantidade_ton ?? 0).toFixed(2)} ton</span>
                      {' · '}{labelFornecedor(r)}
                    </p>
                    {(r.transportadora?.nome || r.motorista_nome) && (
                      <p className="text-xs text-industrial-600 mt-0.5">
                        {r.transportadora?.nome}{r.transportadora?.nome && r.motorista_nome && ' · '}{r.motorista_nome}
                      </p>
                    )}
                    {labelPlacaCompleta(r) && (
                      <p className="text-sm font-mono font-bold text-industrial-900 uppercase mt-0.5">
                        {labelPlacaCompleta(r)}
                      </p>
                    )}
                    {r.numero_nota && <p className="text-xs text-industrial-600 mt-0.5">NF-e: {r.numero_nota}</p>}
                    {r.observacao && <p className="text-xs text-industrial-600 italic mt-1">{r.observacao}</p>}

                    {r.confirmado_em && (
                      <p className={cn(
                        'text-[11px] font-semibold mt-1',
                        getStatusRecebimento(r) === 'FINALIZADO' ? 'text-brand-300' : 'text-amber-400',
                      )}>
                        {STATUS_RECEBIMENTO_LABEL[getStatusRecebimento(r)]}
                      </p>
                    )}

                    {podeConfirmar && r.confirmado_em && (
                      <div className="mt-1">
                        {getStatusRecebimento(r) === 'AGUARDANDO_FILA' && (
                          <button
                            type="button"
                            onClick={() => iniciarDescarga(r)}
                            disabled={processandoId === r.id}
                            className="flex items-center gap-1 text-[11px] font-semibold text-brand-300 hover:text-brand-300 transition-colors disabled:opacity-50"
                          >
                            <PlayCircle className="size-3" />
                            {processandoId === r.id ? 'Iniciando…' : 'Iniciar descarga'}
                          </button>
                        )}
                        {getStatusRecebimento(r) === 'DESCARREGANDO' && (
                          <button
                            type="button"
                            onClick={() => finalizarDescarga(r)}
                            disabled={processandoId === r.id}
                            className="flex items-center gap-1 text-[11px] font-semibold text-brand-300 hover:text-brand-300 transition-colors disabled:opacity-50"
                          >
                            <Flag className="size-3" />
                            {processandoId === r.id ? 'Finalizando…' : 'Finalizar descarga'}
                          </button>
                        )}
                      </div>
                    )}

                    {podeConfirmar && (
                      <div className="mt-1.5">
                        {r.confirmado_em ? (
                          <span className="flex items-center gap-1 text-[11px] font-semibold text-brand-300">
                            <CheckCircle2 className="size-3" /> Chegou às {new Date(r.confirmado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => confirmarChegada(r)}
                            disabled={processandoId === r.id}
                            className="flex items-center gap-1 text-[11px] font-semibold text-brand-300 hover:text-brand-300 transition-colors disabled:opacity-50"
                          >
                            <Truck className="size-3" />
                            {processandoId === r.id ? 'Confirmando…' : 'Confirmar chegada do caminhão'}
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
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-industrial-400 py-1.5 text-xs font-medium text-industrial-600 hover:border-brand-500 hover:text-brand-300 transition-colors">
                    <Plus className="size-3.5" /> Adicionar recebimento
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {podeEditar && (
        <EstoqueConfigPainel initialConfig={initialEstoqueConfig} initialEstoqueAtual={initialEstoqueAtual} usuario={usuario} />
      )}

      {/* Modal de novo recebimento / edição */}
      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto" onClick={fecharModal}>
          <div className="w-full max-w-md rounded-xl bg-industrial-100 border border-industrial-300 p-5 flex flex-col gap-3 my-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-industrial-900 flex items-center gap-2">
                <Package className="size-4 text-brand-600" /> {editandoId ? 'Editar recebimento' : 'Novo recebimento'} · {ddmm(form.data)}
              </h2>
              <button type="button" onClick={fecharModal} className="text-industrial-600 hover:text-industrial-900"><X className="size-5" /></button>
            </div>

            <label className="text-xs font-medium text-industrial-600">Data
              <input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })}
                className="mt-1 w-full bg-industrial-50 border border-industrial-400 rounded-lg px-3 py-2 text-sm text-industrial-900 focus:outline-none focus:border-brand-500" />
            </label>

            <label className="text-xs font-medium text-industrial-600">Matéria-prima
              <select
                value={form.materia_prima_key}
                onChange={(e) => setForm({ ...form, materia_prima_key: e.target.value })}
                className="mt-1 w-full bg-industrial-50 border border-industrial-400 rounded-lg px-3 py-2 text-sm text-industrial-900 focus:outline-none focus:border-brand-500"
              >
                <option value="">Selecionar…</option>
                {MATERIAS_PRIMA.map((mp) => (
                  <option key={mp.key} value={mp.key}>{mp.label}</option>
                ))}
              </select>
            </label>

            <div className="text-xs font-medium text-industrial-600">Fornecedor
              <div className="mt-1">
                <FornecedorPicker
                  value={form.fornecedor}
                  fornecedores={fornecedores}
                  onChange={(nome, id) => setForm({ ...form, fornecedor: nome, fornecedor_id: id })}
                  onCriar={adicionarFornecedor}
                  onEditar={editarFornecedor}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-medium text-industrial-600">Quantidade (ton)
                <input value={form.quantidade_ton} onChange={(e) => setForm({ ...form, quantidade_ton: e.target.value })}
                  placeholder="ex.: 35"
                  className="mt-1 w-full bg-industrial-50 border border-industrial-400 rounded-lg px-3 py-2 text-sm font-mono text-industrial-900 placeholder-industrial-500 focus:outline-none focus:border-brand-500" />
              </label>
              <label className="text-xs font-medium text-industrial-600">Número da nota (NF-e)
                <input value={form.numero_nota} onChange={(e) => setForm({ ...form, numero_nota: e.target.value })}
                  placeholder="ex.: 116533"
                  className="mt-1 w-full bg-industrial-50 border border-industrial-400 rounded-lg px-3 py-2 text-sm font-mono text-industrial-900 placeholder-industrial-500 focus:outline-none focus:border-brand-500" />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-medium text-industrial-600">Transportadora (opcional)
                <select
                  value={form.transportadora_id}
                  onChange={(e) => setForm({ ...form, transportadora_id: e.target.value })}
                  className="mt-1 w-full bg-industrial-50 border border-industrial-400 rounded-lg px-3 py-2 text-sm text-industrial-900 focus:outline-none focus:border-brand-500"
                >
                  <option value="">— Não informar —</option>
                  {initialTransportadoras.map((t) => (
                    <option key={t.id} value={t.id}>{t.nome}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-medium text-industrial-600">Nome do motorista (opcional)
                <input value={form.motorista_nome} onChange={(e) => setForm({ ...form, motorista_nome: e.target.value })}
                  placeholder="ex.: José da Silva"
                  className="mt-1 w-full bg-industrial-50 border border-industrial-400 rounded-lg px-3 py-2 text-sm text-industrial-900 placeholder-industrial-500 focus:outline-none focus:border-brand-500" />
              </label>
            </div>

            <div>
              <p className="text-xs font-semibold text-industrial-700 mb-1.5">Placas do veículo</p>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs font-medium text-industrial-600">Placa cavalo
                  <input value={form.placa_cavalo} onChange={(e) => setForm({ ...form, placa_cavalo: e.target.value.toUpperCase() })}
                    placeholder="ABC1D23"
                    className="mt-1 w-full bg-industrial-50 border border-industrial-400 rounded-lg px-3 py-2 text-sm font-mono uppercase text-industrial-900 placeholder-industrial-500 focus:outline-none focus:border-brand-500" />
                </label>
                <label className="text-xs font-medium text-industrial-600">Placa 1 (opcional)
                  <input value={form.placa_1} onChange={(e) => setForm({ ...form, placa_1: e.target.value.toUpperCase() })}
                    placeholder="se articulado"
                    className="mt-1 w-full bg-industrial-50 border border-industrial-400 rounded-lg px-3 py-2 text-sm font-mono uppercase text-industrial-900 placeholder-industrial-500 focus:outline-none focus:border-brand-500" />
                </label>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-3">
                <label className="text-xs font-medium text-industrial-600">Placa 2
                  <input value={form.placa_2} onChange={(e) => setForm({ ...form, placa_2: e.target.value.toUpperCase() })}
                    placeholder="opcional"
                    className="mt-1 w-full bg-industrial-50 border border-industrial-400 rounded-lg px-3 py-2 text-sm font-mono uppercase text-industrial-900 placeholder-industrial-500 focus:outline-none focus:border-brand-500" />
                </label>
                <label className="text-xs font-medium text-industrial-600">Placa 3
                  <input value={form.placa_3} onChange={(e) => setForm({ ...form, placa_3: e.target.value.toUpperCase() })}
                    placeholder="opcional"
                    className="mt-1 w-full bg-industrial-50 border border-industrial-400 rounded-lg px-3 py-2 text-sm font-mono uppercase text-industrial-900 placeholder-industrial-500 focus:outline-none focus:border-brand-500" />
                </label>
                <label className="text-xs font-medium text-industrial-600">Placa 4
                  <input value={form.placa_4} onChange={(e) => setForm({ ...form, placa_4: e.target.value.toUpperCase() })}
                    placeholder="opcional"
                    className="mt-1 w-full bg-industrial-50 border border-industrial-400 rounded-lg px-3 py-2 text-sm font-mono uppercase text-industrial-900 placeholder-industrial-500 focus:outline-none focus:border-brand-500" />
                </label>
              </div>
            </div>

            <label className="text-xs font-medium text-industrial-600">Observação (opcional)
              <input value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })}
                className="mt-1 w-full bg-industrial-50 border border-industrial-400 rounded-lg px-3 py-2 text-sm text-industrial-900 placeholder-industrial-500 focus:outline-none focus:border-brand-500" />
            </label>

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={fecharModal}
                className="rounded-lg border border-industrial-400 px-4 py-2 text-sm font-medium text-industrial-700 hover:bg-industrial-200">Cancelar</button>
              <button
                type="button"
                onClick={salvar}
                disabled={salvando || !form.materia_prima_key || !form.fornecedor_id || !form.placa_cavalo.trim()}
                className="rounded-lg bg-brand-700 hover:bg-brand-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {salvando ? 'Salvando…' : editandoId ? 'Salvar alterações' : 'Lançar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
