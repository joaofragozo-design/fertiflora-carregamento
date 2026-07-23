'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, Trash2, Pencil, X, ChevronLeft, ChevronRight, ChevronDown, Printer, Send, CheckCircle2, Truck, Container } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { ProgramacaoService } from '@/services/programacao.service'
import { OrdensDiariasService } from '@/services/ordens-diarias.service'
import { useProgramacaoSemana } from '@/hooks/use-programacao-semana'
import { useClientes } from '@/hooks/use-clientes'
import { ClientePicker } from '@/components/clientes/cliente-picker'
import { ROUTES } from '@/constants/routes'
import type { Programacao, ProgramacaoItem } from '@/types/programacao'
import type { Embalagem, Formula } from '@/types/formula'
import type { Cliente } from '@/types/cliente'
import type { ClienteErp } from '@/types/cliente-erp'
import type { Transportadora } from '@/types/transportadora'
import { SOLICITACAO_STATUS_LABEL } from '@/types/transportadora'
import { MATERIAS_PRIMA, EMBALAGEM_LABEL, EMBALAGEM_OPCOES, calcularMateriaPrima, labelMateriaPrima, calcularTons } from '@/types/formula'
import { cn } from '@/lib/utils/cn'

interface ProgramacaoSemanaProps {
  initialItens:    Programacao[]
  formulas:        { id: number; nome: string }[]
  initialClientes: Cliente[]
  clientesErp:     ClienteErp[]
  transportadoras: Transportadora[]
  semanaInicio:    string // segunda-feira (YYYY-MM-DD)
  semanaFim:       string // sexta-feira (YYYY-MM-DD)
  hoje:            string
  podeEditar:      boolean // admin/logistica — programa a semana
  podeConfirmar:   boolean // admin/faturamento — só confirma chegada do caminhão
  usuario:         string
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

/** Soma as toneladas de todos os itens de um agendamento. */
function tonsDoAgendamento(ag: Programacao): number {
  return (ag.itens ?? []).reduce((s, it) => s + (it.tons ?? 0), 0)
}

function FormulaPicker({
  value,
  formulas,
  onChange,
}: {
  value: number | null
  formulas: { id: number; nome: string }[]
  onChange: (id: number | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const selected = formulas.find((f) => f.id === value)

  const filtered = useMemo(() => {
    if (!query) return formulas.slice(0, 40)
    const q = query.toLowerCase()
    return formulas.filter((f) => f.nome.toLowerCase().includes(q)).slice(0, 40)
  }, [formulas, query])

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setQuery('') }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-1 px-3 py-2 rounded-lg text-sm bg-industrial-950 border border-industrial-600 text-left text-industrial-100 hover:border-brand-600 focus:outline-none focus:border-brand-500"
      >
        <span className={cn('truncate', !selected && 'text-industrial-500')}>
          {selected?.nome ?? 'Selecionar fórmula…'}
        </span>
        <ChevronDown className="size-4 shrink-0 text-industrial-400" />
      </button>
      {open && (
        <div className="absolute z-10 top-full mt-1 left-0 right-0 bg-industrial-900 border border-industrial-600 rounded-lg shadow-industrial">
          <div className="p-1.5 border-b border-industrial-700">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar fórmula..."
              className="w-full bg-industrial-950 text-sm text-industrial-100 placeholder-industrial-500 px-2 py-1.5 rounded border border-industrial-600 focus:outline-none focus:border-brand-500"
            />
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            <li>
              <button type="button" onClick={() => { onChange(null); setOpen(false); setQuery('') }}
                className="w-full text-left text-sm px-3 py-1.5 text-industrial-400 hover:bg-industrial-800">
                — Nenhuma —
              </button>
            </li>
            {filtered.map((f) => (
              <li key={f.id}>
                <button type="button" onClick={() => { onChange(f.id); setOpen(false); setQuery('') }}
                  className={cn('w-full text-left text-sm px-3 py-1.5 truncate hover:bg-industrial-800',
                    f.id === value ? 'text-brand-700 font-semibold' : 'text-industrial-100')}>
                  {f.nome}
                </button>
              </li>
            ))}
            {filtered.length === 0 && <li className="text-sm text-industrial-500 px-3 py-2">Nada encontrado.</li>}
          </ul>
        </div>
      )}
    </div>
  )
}

// ─── Formulário de ITEM (fórmula/quantidade/embalagem) ─────────────────────
// Cria um agendamento novo (com cliente/observação) OU adiciona/edita um item
// de um agendamento já existente.
interface ItemFormState {
  agendamentoId:    string | null // null = criar novo agendamento
  itemId:           string | null // null = novo item
  data:             string
  cliente:          string
  clienteCodigo:    number | null
  observacao:       string
  formula_id:       number | null
  quantidade:       number
  embalagem:        Embalagem
  transportadoraId: string // só usado ao criar um agendamento novo
}

const ITEM_FORM_VAZIO: Omit<ItemFormState, 'data' | 'agendamentoId'> = {
  itemId: null, cliente: '', clienteCodigo: null, observacao: '', formula_id: null, quantidade: 0, embalagem: 'SACOS', transportadoraId: '',
}

// ─── Formulário do AGENDAMENTO (cliente/observação) ────────────────────────
interface AgendamentoFormState {
  id:            string
  cliente:       string
  clienteCodigo: number | null
  observacao:    string
}

export function ProgramacaoSemana({
  initialItens, formulas, initialClientes, clientesErp, transportadoras, semanaInicio, semanaFim, hoje, podeEditar, podeConfirmar, usuario,
}: ProgramacaoSemanaProps) {
  const { agendamentos, setAgendamentos } = useProgramacaoSemana(initialItens, semanaInicio, semanaFim)
  const { clientes, adicionarCliente, editarCliente } = useClientes(initialClientes)
  const [itemForm, setItemForm] = useState<ItemFormState | null>(null)
  const [agForm, setAgForm] = useState<AgendamentoFormState | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [enviandoId, setEnviandoId] = useState<string | null>(null)
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null)
  // Fluxo transportadora: modal de escolha + estado do botão de liberar
  const [transpModal, setTranspModal] = useState<{ agendamento: Programacao; transportadoraId: string } | null>(null)
  const [enviandoTranspId, setEnviandoTranspId] = useState<string | null>(null)
  const svc = useMemo(() => new ProgramacaoService(createClient()), [])
  const ordensSvc = useMemo(() => new OrdensDiariasService(createClient()), [])
  const router = useRouter()

  const amanha = addDiasIso(hoje, 1)

  const dias = useMemo(
    () => DIAS.map((nome, i) => ({ nome, data: addDiasIso(semanaInicio, i) })),
    [semanaInicio],
  )

  const totalSemana = useMemo(() => agendamentos.reduce((s, ag) => s + tonsDoAgendamento(ag), 0), [agendamentos])
  const agendamentosDoDia = (data: string) => agendamentos.filter((ag) => ag.data === data)
  const totalDia = (data: string) => agendamentosDoDia(data).reduce((s, ag) => s + tonsDoAgendamento(ag), 0)

  // Matéria-prima consumida pelos agendamentos passados: Σ tons do item × kg/ton.
  // Agrupa por RÓTULO (não pela chave da coluna) porque a mesma coluna
  // `caltimag` pode representar CALTIMAG numa fórmula e FERTIMAG noutra.
  function materiaPrimaDosAgendamentos(ags: Programacao[]): { label: string; kg: number }[] {
    const acc: Record<string, number> = {}
    for (const ag of ags) {
      for (const item of ag.itens ?? []) {
        const f = item.formula as Formula | undefined
        if (!f) continue
        const tons = item.tons ?? calcularTons(item.quantidade, item.embalagem)
        for (const mp of MATERIAS_PRIMA) {
          const kgPorTon = calcularMateriaPrima(f, mp.key)
          if (kgPorTon > 0) {
            const label = labelMateriaPrima(f, mp.key)
            acc[label] = (acc[label] ?? 0) + tons * kgPorTon
          }
        }
      }
    }
    return Object.entries(acc).map(([label, kg]) => ({ label, kg })).sort((a, b) => b.kg - a.kg)
  }
  function insumosDoDia(data: string): { label: string; kg: number }[] {
    return materiaPrimaDosAgendamentos(agendamentosDoDia(data))
  }
  const materiaPrimaDaSemana = useMemo(() => materiaPrimaDosAgendamentos(agendamentos), [agendamentos])

  function irParaSemana(inicio: string) {
    router.push(`${ROUTES.PROGRAMACAO}?semana=${inicio}`)
  }

  function abrirNovoAgendamento(data: string) {
    setItemForm({ ...ITEM_FORM_VAZIO, data, agendamentoId: null })
  }
  function abrirNovoItem(ag: Programacao) {
    setItemForm({ ...ITEM_FORM_VAZIO, data: ag.data, agendamentoId: ag.id })
  }
  function abrirEdicaoItem(ag: Programacao, item: ProgramacaoItem) {
    setItemForm({
      agendamentoId: ag.id, itemId: item.id, data: ag.data, transportadoraId: '',
      cliente: ag.cliente, clienteCodigo: ag.cliente_codigo, observacao: ag.observacao,
      formula_id: item.formula_id, quantidade: item.quantidade, embalagem: item.embalagem,
    })
  }
  function abrirEdicaoAgendamento(ag: Programacao) {
    setAgForm({ id: ag.id, cliente: ag.cliente, clienteCodigo: ag.cliente_codigo, observacao: ag.observacao })
  }

  async function salvarItem() {
    if (!itemForm) return
    if (!itemForm.formula_id) {
      toast.error('Selecione uma fórmula antes de salvar o item.')
      return
    }
    if (!itemForm.quantidade || itemForm.quantidade <= 0) {
      toast.error('Informe uma quantidade maior que zero.')
      return
    }
    setSalvando(true)
    try {
      if (itemForm.agendamentoId && itemForm.itemId) {
        // Editar item existente
        const upd = await svc.atualizarItem(itemForm.itemId, itemForm.agendamentoId, {
          formula_id: itemForm.formula_id, quantidade: itemForm.quantidade, embalagem: itemForm.embalagem,
        })
        setAgendamentos((prev) => prev.map((a) => (a.id === upd.id ? upd : a)))
      } else if (itemForm.agendamentoId) {
        // Adicionar item a um agendamento existente
        const upd = await svc.adicionarItem(itemForm.agendamentoId, {
          formula_id: itemForm.formula_id, quantidade: itemForm.quantidade, embalagem: itemForm.embalagem,
        })
        setAgendamentos((prev) => prev.map((a) => (a.id === upd.id ? upd : a)))
      } else {
        // Criar agendamento novo com o primeiro item. Fecha o modal e mostra
        // na grade IMEDIATAMENTE após criar — antes de tentar enviar pra
        // transportadora — pra uma falha nesse segundo passo (rede, RLS) não
        // deixar o agendamento "invisível" e sujeito a ser duplicado se o
        // usuário, vendo só um erro genérico, clicar Salvar de novo.
        const novo = await svc.criar({
          data: itemForm.data,
          cliente: itemForm.cliente.trim(),
          cliente_codigo: itemForm.clienteCodigo,
          observacao: itemForm.observacao.trim(),
          formula_id: itemForm.formula_id,
          quantidade: itemForm.quantidade,
          embalagem: itemForm.embalagem,
        })
        setAgendamentos((prev) => [...prev, novo])
        setItemForm(null)

        if (itemForm.transportadoraId) {
          try {
            const atualizado = await svc.enviarParaTransportadora(novo.id, itemForm.transportadoraId)
            setAgendamentos((prev) => prev.map((a) => (a.id === atualizado.id ? atualizado : a)))
          } catch (err) {
            toast.error(
              `${novo.cliente || 'Agendamento'} foi criado, mas não foi possível enviar pra transportadora: ${err instanceof Error ? err.message : 'erro desconhecido'}. Use o botão "Transportadora" no card pra tentar de novo.`,
            )
          }
        }
        return
      }
      setItemForm(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar.')
    } finally {
      setSalvando(false)
    }
  }

  async function salvarAgendamento() {
    if (!agForm) return
    setSalvando(true)
    try {
      const upd = await svc.atualizar(agForm.id, { cliente: agForm.cliente.trim(), cliente_codigo: agForm.clienteCodigo, observacao: agForm.observacao.trim() })
      setAgendamentos((prev) => prev.map((a) => (a.id === upd.id ? upd : a)))
      setAgForm(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar.')
    } finally {
      setSalvando(false)
    }
  }

  async function removerItem(ag: Programacao, item: ProgramacaoItem) {
    try {
      const upd = await svc.removerItem(item.id, ag.id)
      setAgendamentos((prev) => prev.map((a) => (a.id === upd.id ? upd : a)))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao remover item.')
    }
  }

  // Envia o agendamento (cliente + todos os itens) direto para as Ordens do
  // Dia daquela data — o Fransua não precisa redigitar nada. Placa e
  // envelopar ficam em branco/não, pois não existem na Programação.
  async function enviarParaOrdens(ag: Programacao) {
    const itens = ag.itens ?? []
    if (itens.length === 0) {
      toast.error('Adicione ao menos um item antes de enviar.')
      return
    }
    setEnviandoId(ag.id)
    try {
      await ordensSvc.criarComItens(
        { data: ag.data, cliente: ag.cliente, placa: '', envelopar: false, iniciado: false, finalizado: false, programacao_id: ag.id },
        itens.map((it) => ({ formula_id: it.formula_id, quantidade: it.quantidade, embalagem: it.embalagem })),
      )
      const upd = await svc.marcarEnviado(ag.id)
      setAgendamentos((prev) => prev.map((a) => (a.id === upd.id ? upd : a)))
      toast.success(`${ag.cliente || 'Cliente'} enviado para Ordens do Dia.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar para Ordens do Dia.')
    } finally {
      setEnviandoId(null)
    }
  }

  // Faturamento confirma que o caminhão chegou — a Logística é notificada
  // (som + balão) via realtime, ouvindo a mudança de confirmado_em.
  async function confirmarChegada(ag: Programacao) {
    setConfirmandoId(ag.id)
    try {
      const upd = await svc.confirmarChegada(ag.id, usuario)
      setAgendamentos((prev) => prev.map((a) => (a.id === upd.id ? upd : a)))
      toast.success(`Chegada de ${ag.cliente || 'cliente'} confirmada.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao confirmar chegada.')
    } finally {
      setConfirmandoId(null)
    }
  }

  // ─── Fluxo transportadora/motorista ────────────────────────────────────
  // Liberar a solicitação e abrir o WhatsApp do motorista ficam na aba
  // Transportadoras (PainelSolicitacoes) — aqui só o envio inicial.

  async function enviarParaTransportadora() {
    if (!transpModal || !transpModal.transportadoraId) return
    const ag = transpModal.agendamento
    setEnviandoTranspId(ag.id)
    try {
      const upd = await svc.enviarParaTransportadora(ag.id, transpModal.transportadoraId)
      setAgendamentos((prev) => prev.map((a) => (a.id === upd.id ? upd : a)))
      setTranspModal(null)
      toast.success(`Enviado para ${upd.transportadora?.nome ?? 'a transportadora'} — ela vai indicar o motorista.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar para a transportadora.')
    } finally {
      setEnviandoTranspId(null)
    }
  }

  async function excluirAgendamento(ag: Programacao) {
    if (!window.confirm('Remover este agendamento (e todos os itens)?')) return
    try {
      await svc.deletar(ag.id)
      setAgendamentos((prev) => prev.filter((a) => a.id !== ag.id))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao remover.')
    }
  }

  const tonsItemForm = itemForm ? calcularTons(itemForm.quantidade, itemForm.embalagem) : 0
  const editandoNovoAgendamento = itemForm && !itemForm.agendamentoId

  return (
    <div className="flex flex-col gap-4">
      {/* Cabeçalho + navegação de semana */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-semibold text-industrial-100">Programação de Carregamento</h1>
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
            <p className="text-xs text-industrial-400 mt-1.5">Prévia (somente leitura) — quem programa é a Logística.</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {podeEditar && (
            <Link
              href={ROUTES.ORDENS_RELATORIO}
              className="flex items-center gap-1.5 rounded-lg border border-industrial-700 px-3 py-2 text-xs font-medium text-industrial-200 hover:border-brand-500 hover:text-brand-700 transition-colors"
            >
              <Printer className="size-4" />
              Relatório do dia
            </Link>
          )}
          <div className="text-right">
            <p className="text-xs text-industrial-400">Total da semana</p>
            <p className="text-2xl font-bold text-brand-600">{totalSemana.toFixed(2)} <span className="text-sm font-normal text-industrial-400">ton</span></p>
          </div>
        </div>
      </div>

      {/* Grade da semana */}
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {dias.map(({ nome, data }) => {
          const ehAmanha = data === amanha
          const ehHoje = data === hoje
          const insumos = insumosDoDia(data)
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
                {agendamentosDoDia(data).map((ag) => (
                  <div
                    key={ag.id}
                    className={cn(
                      'rounded-lg border p-2 transition-colors',
                      ag.confirmado_em ? 'border-brand-500 bg-brand-100' : 'border-industrial-700 bg-industrial-900',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-industrial-100 text-sm leading-tight flex items-center gap-1.5">
                        {ag.cliente || <span className="text-industrial-500 font-normal">Sem cliente</span>}
                        {ag.cliente_codigo != null && (
                          <span className="shrink-0 text-[10px] font-normal text-industrial-500" title="Código do cliente no ERP">#{ag.cliente_codigo}</span>
                        )}
                        {ag.confirmado_em && (
                          <span
                            className="inline-flex shrink-0"
                            title={`Caminhão chegou às ${new Date(ag.confirmado_em).toLocaleTimeString('pt-BR')}${ag.confirmado_por ? ` · confirmado por ${ag.confirmado_por}` : ''}`}
                          >
                            <Truck className="size-3.5 text-brand-600" />
                          </span>
                        )}
                      </span>
                      {podeEditar && (
                        <div className="flex gap-1 shrink-0">
                          <button type="button" onClick={() => abrirEdicaoAgendamento(ag)} title="Editar cliente/observação"
                            className="text-industrial-400 hover:text-brand-700"><Pencil className="size-3.5" /></button>
                          <button type="button" onClick={() => excluirAgendamento(ag)} title="Remover agendamento"
                            className="text-industrial-400 hover:text-red-600"><Trash2 className="size-3.5" /></button>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-1 mt-1">
                      {(ag.itens ?? []).map((item) => (
                        <div key={item.id} className="flex items-start justify-between gap-2 border-t border-industrial-800 first:border-t-0 pt-1 first:pt-0">
                          <div className="min-w-0">
                            {item.formula?.nome && <p className="text-xs font-medium text-brand-700 truncate">{item.formula.nome}</p>}
                            <p className="text-xs text-industrial-500">
                              {item.quantidade} {EMBALAGEM_LABEL[item.embalagem]} · <span className="font-bold text-industrial-300">{(item.tons ?? 0).toFixed(2)} ton</span>
                            </p>
                          </div>
                          {podeEditar && (
                            <div className="flex gap-1 shrink-0">
                              <button type="button" onClick={() => abrirEdicaoItem(ag, item)} title="Editar item"
                                className="text-industrial-500 hover:text-brand-700"><Pencil className="size-3" /></button>
                              <button
                                type="button" onClick={() => removerItem(ag, item)} title="Remover item"
                                disabled={(ag.itens ?? []).length <= 1}
                                className="text-industrial-500 hover:text-red-600 disabled:opacity-20 disabled:cursor-not-allowed"
                              >
                                <Trash2 className="size-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {ag.observacao && <p className="text-xs text-industrial-400 italic mt-1">{ag.observacao}</p>}

                    {/* Status do fluxo de transportadora */}
                    {ag.solicitacao_status && (
                      <p className={cn(
                        'flex items-center gap-1 text-[11px] font-semibold mt-1',
                        ag.solicitacao_status === 'LIBERADO' ? 'text-brand-700' : 'text-amber-700',
                      )}>
                        <Container className="size-3 shrink-0" />
                        <span className="truncate">
                          {ag.transportadora?.nome ?? 'Transportadora'} · {SOLICITACAO_STATUS_LABEL[ag.solicitacao_status]}
                          {ag.solicitacao_status !== 'ENVIADO_TRANSPORTADORA' && ag.motorista?.nome ? ` · ${ag.motorista.nome}` : ''}
                        </span>
                      </p>
                    )}

                    {podeEditar && (
                      <div className="flex items-center justify-between gap-2 mt-1.5 flex-wrap">
                        <button type="button" onClick={() => abrirNovoItem(ag)}
                          className="flex items-center gap-1 text-[11px] font-medium text-industrial-500 hover:text-brand-700 transition-colors">
                          <Plus className="size-3" /> Adicionar item
                        </button>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setTranspModal({ agendamento: ag, transportadoraId: ag.transportadora_id ?? '' })}
                            title={ag.solicitacao_status ? 'Reenviar / trocar a transportadora' : 'Enviar para uma transportadora indicar o motorista'}
                            className={cn(
                              'flex items-center gap-1 text-[11px] font-semibold transition-colors',
                              ag.solicitacao_status ? 'text-brand-700' : 'text-industrial-500 hover:text-brand-700',
                            )}
                          >
                            <Container className="size-3" />
                            {ag.solicitacao_status ? 'Transportadora ✓' : 'Transportadora'}
                          </button>
                          <button
                            type="button"
                            onClick={() => enviarParaOrdens(ag)}
                            disabled={enviandoId === ag.id}
                            title={ag.enviado_em ? `Enviado em ${new Date(ag.enviado_em).toLocaleString('pt-BR')} — clique para reenviar` : 'Enviar para Ordens do Dia'}
                            className={cn(
                              'flex items-center gap-1 text-[11px] font-semibold transition-colors disabled:opacity-50',
                              ag.enviado_em ? 'text-brand-700' : 'text-industrial-500 hover:text-brand-700',
                            )}
                          >
                            {ag.enviado_em ? <CheckCircle2 className="size-3" /> : <Send className="size-3" />}
                            {enviandoId === ag.id ? 'Enviando…' : ag.enviado_em ? 'Enviado' : 'Enviar p/ Ordens'}
                          </button>
                        </div>
                      </div>
                    )}

                    {podeConfirmar && (
                      <div className="mt-1.5">
                        {ag.confirmado_em ? (
                          <span className="flex items-center gap-1 text-[11px] font-semibold text-brand-700">
                            <CheckCircle2 className="size-3" /> Chegou às {new Date(ag.confirmado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => confirmarChegada(ag)}
                            disabled={confirmandoId === ag.id}
                            className="flex items-center gap-1 text-[11px] font-semibold text-brand-700 hover:text-brand-800 transition-colors disabled:opacity-50"
                          >
                            <Truck className="size-3" />
                            {confirmandoId === ag.id ? 'Confirmando…' : 'Confirmar chegada do caminhão'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {agendamentosDoDia(data).length === 0 && (
                  <p className="text-xs text-industrial-500 text-center py-2">—</p>
                )}

                {podeEditar && (
                  <button type="button" onClick={() => abrirNovoAgendamento(data)}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-industrial-600 py-1.5 text-xs font-medium text-industrial-400 hover:border-brand-500 hover:text-brand-700 transition-colors">
                    <Plus className="size-3.5" /> Adicionar cliente
                  </button>
                )}
              </div>

              {insumos.length > 0 && (
                <div className="rounded-lg bg-industrial-950 border border-industrial-700 p-2 mt-auto">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-industrial-400 mb-1.5">Matéria-prima do dia</p>
                  <div className="flex flex-col gap-1">
                    {insumos.map((m) => (
                      <div key={m.label} className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-industrial-400 truncate">{m.label}</span>
                        <span className="font-mono font-bold text-industrial-100 shrink-0">
                          {m.kg.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} kg
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Total de matéria-prima carregado na semana inteira (todos os dias somados) */}
      {materiaPrimaDaSemana.length > 0 && (
        <div className="rounded-xl border border-industrial-800 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-industrial-400 mb-2">Matéria-prima da semana</p>
          <div className="flex flex-wrap gap-3">
            {materiaPrimaDaSemana.map((m) => (
              <div key={m.label} className="flex flex-col rounded-lg bg-industrial-950 border border-industrial-700 px-3 py-1.5 min-w-[110px]">
                <span className="text-[10px] text-industrial-400 truncate">{m.label}</span>
                <span className="font-mono font-bold text-brand-600">
                  {m.kg.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} <span className="text-[10px] font-normal text-industrial-500">kg</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal de envio pra transportadora */}
      {transpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setTranspModal(null)}>
          <div className="w-full max-w-md rounded-xl bg-industrial-900 border border-industrial-700 p-5 flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-industrial-100">
                Enviar pra transportadora · {transpModal.agendamento.cliente || 'sem cliente'}
              </h2>
              <button type="button" onClick={() => setTranspModal(null)} className="text-industrial-400 hover:text-industrial-100"><X className="size-5" /></button>
            </div>

            <p className="text-xs text-industrial-400">
              A transportadora recebe este carregamento na tela dela, indica o motorista (com WhatsApp) e envia a
              solicitação de volta — você libera na aba Transportadoras.
            </p>

            <label className="text-xs font-medium text-industrial-400">Transportadora
              <select
                value={transpModal.transportadoraId}
                onChange={(e) => setTranspModal({ ...transpModal, transportadoraId: e.target.value })}
                className="mt-1 w-full bg-industrial-950 border border-industrial-600 rounded-lg px-3 py-2 text-sm text-industrial-100 focus:outline-none focus:border-brand-500"
              >
                <option value="">Selecionar transportadora…</option>
                {transportadoras.map((t) => (
                  <option key={t.id} value={t.id}>{t.nome}{t.profile_id ? '' : ' (sem login criado)'}</option>
                ))}
              </select>
            </label>

            {transportadoras.length === 0 && (
              <p className="text-xs text-amber-700 font-medium">
                Nenhuma transportadora cadastrada — crie o acesso dela na tela Transportadoras.
              </p>
            )}

            {transpModal.agendamento.solicitacao_status && (
              <p className="text-xs text-amber-700 font-medium">
                Este agendamento já está com uma transportadora ({SOLICITACAO_STATUS_LABEL[transpModal.agendamento.solicitacao_status]}).
                Reenviar recomeça o fluxo do zero.
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setTranspModal(null)}
                className="rounded-lg border border-industrial-600 px-4 py-2 text-sm font-medium text-industrial-300 hover:bg-industrial-800">Cancelar</button>
              <button
                type="button"
                onClick={enviarParaTransportadora}
                disabled={enviandoTranspId != null || !transpModal.transportadoraId}
                className="rounded-lg bg-brand-700 hover:bg-brand-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {enviandoTranspId ? 'Enviando…' : 'Enviar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de cliente/observação (nível agendamento) */}
      {agForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setAgForm(null)}>
          <div className="w-full max-w-md rounded-xl bg-industrial-900 border border-industrial-700 p-5 flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-industrial-100">Editar cliente</h2>
              <button type="button" onClick={() => setAgForm(null)} className="text-industrial-400 hover:text-industrial-100"><X className="size-5" /></button>
            </div>
            <div className="text-xs font-medium text-industrial-400">Cliente
              <div className="mt-1">
                <ClientePicker
                  value={agForm.cliente}
                  clientes={clientes}
                  clientesErp={clientesErp}
                  onChange={(nome, codigo) => setAgForm({ ...agForm, cliente: nome, clienteCodigo: codigo })}
                  onCriar={adicionarCliente}
                  onEditar={editarCliente}
                  className="[&>button]:py-2 [&>button]:text-sm"
                />
              </div>
            </div>
            <label className="text-xs font-medium text-industrial-400">Observação / nº do pedido
              <input value={agForm.observacao} onChange={(e) => setAgForm({ ...agForm, observacao: e.target.value })}
                placeholder="ex.: PEDIDO 26092"
                className="mt-1 w-full bg-industrial-950 border border-industrial-600 rounded-lg px-3 py-2 text-sm text-industrial-100 placeholder-industrial-500 focus:outline-none focus:border-brand-500" />
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setAgForm(null)}
                className="rounded-lg border border-industrial-600 px-4 py-2 text-sm font-medium text-industrial-300 hover:bg-industrial-800">Cancelar</button>
              <button type="button" onClick={salvarAgendamento} disabled={salvando}
                className="rounded-lg bg-brand-700 hover:bg-brand-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-50">
                {salvando ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de item (fórmula/quantidade/embalagem) — cria agendamento ou adiciona/edita item */}
      {itemForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setItemForm(null)}>
          <div className="w-full max-w-md rounded-xl bg-industrial-900 border border-industrial-700 p-5 flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-industrial-100">
                {itemForm.itemId ? 'Editar item' : editandoNovoAgendamento ? 'Novo cliente' : 'Novo item'} · {ddmm(itemForm.data)}
              </h2>
              <button type="button" onClick={() => setItemForm(null)} className="text-industrial-400 hover:text-industrial-100"><X className="size-5" /></button>
            </div>

            {editandoNovoAgendamento && (
              <>
                <div className="text-xs font-medium text-industrial-400">Cliente
                  <div className="mt-1">
                    <ClientePicker
                      value={itemForm.cliente}
                      clientes={clientes}
                      clientesErp={clientesErp}
                      onChange={(nome, codigo) => setItemForm({ ...itemForm, cliente: nome, clienteCodigo: codigo })}
                      onCriar={adicionarCliente}
                      onEditar={editarCliente}
                      className="[&>button]:py-2 [&>button]:text-sm"
                    />
                  </div>
                </div>
                <label className="text-xs font-medium text-industrial-400">Observação / nº do pedido
                  <input value={itemForm.observacao} onChange={(e) => setItemForm({ ...itemForm, observacao: e.target.value })}
                    placeholder="ex.: PEDIDO 26092"
                    className="mt-1 w-full bg-industrial-950 border border-industrial-600 rounded-lg px-3 py-2 text-sm text-industrial-100 placeholder-industrial-500 focus:outline-none focus:border-brand-500" />
                </label>
                <label className="text-xs font-medium text-industrial-400">Transportadora (opcional — já sai enviado pra ela)
                  <select
                    value={itemForm.transportadoraId}
                    onChange={(e) => setItemForm({ ...itemForm, transportadoraId: e.target.value })}
                    className="mt-1 w-full bg-industrial-950 border border-industrial-600 rounded-lg px-3 py-2 text-sm text-industrial-100 focus:outline-none focus:border-brand-500"
                  >
                    <option value="">— Definir depois —</option>
                    {transportadoras.map((t) => (
                      <option key={t.id} value={t.id}>{t.nome}</option>
                    ))}
                  </select>
                </label>
              </>
            )}

            <div className="text-xs font-medium text-industrial-400">Fórmula
              <div className="mt-1"><FormulaPicker value={itemForm.formula_id} formulas={formulas} onChange={(id) => setItemForm({ ...itemForm, formula_id: id })} /></div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-medium text-industrial-400">Quantidade
                <input type="number" min={1} value={itemForm.quantidade} onChange={(e) => setItemForm({ ...itemForm, quantidade: Number(e.target.value) || 0 })}
                  className="mt-1 w-full bg-industrial-950 border border-industrial-600 rounded-lg px-3 py-2 text-sm text-industrial-100 focus:outline-none focus:border-brand-500" />
              </label>
              <label className="text-xs font-medium text-industrial-400">Embalagem
                <select value={itemForm.embalagem} onChange={(e) => setItemForm({ ...itemForm, embalagem: e.target.value as Embalagem })}
                  className="mt-1 w-full bg-industrial-950 border border-industrial-600 rounded-lg px-3 py-2 text-sm text-industrial-100 focus:outline-none focus:border-brand-500">
                  {EMBALAGEM_OPCOES.map((opt) => <option key={opt} value={opt}>{EMBALAGEM_LABEL[opt]}</option>)}
                </select>
              </label>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-sm text-industrial-400">Total: <span className="font-bold text-brand-700">{tonsItemForm.toFixed(2)} ton</span></span>
              <div className="flex gap-2">
                <button type="button" onClick={() => setItemForm(null)}
                  className="rounded-lg border border-industrial-600 px-4 py-2 text-sm font-medium text-industrial-300 hover:bg-industrial-800">Cancelar</button>
                <button type="button" onClick={salvarItem} disabled={salvando || !itemForm.formula_id || itemForm.quantidade <= 0}
                  title={!itemForm.formula_id ? 'Selecione uma fórmula antes de salvar' : itemForm.quantidade <= 0 ? 'Informe uma quantidade maior que zero' : undefined}
                  className="rounded-lg bg-brand-700 hover:bg-brand-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-50">
                  {salvando ? 'Salvando…' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
