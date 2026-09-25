'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, X, ChevronLeft, ChevronRight, ChevronDown, Truck, Package, PlayCircle, Flag, Pencil,
  Clock3, PackageCheck, CalendarClock, MapPin, FileText, Container, Trash2, type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { RecebimentosService, type RecebimentoPrevisto, STATUS_RECEBIMENTO_LABEL, getStatusRecebimento, labelPlacaCompleta } from '@/services/recebimentos.service'
import { FornecedoresService } from '@/services/fornecedores.service'
import { FornecedorPicker } from '@/components/fornecedores/fornecedor-picker'
import { EstoqueConfigPainel } from '@/components/estoque/estoque-config-painel'
import { FilaOperacao } from '@/components/recebimentos/fila-operacao'
import { MapaChegadas, motoristasAtivos } from '@/components/recebimentos/mapa-chegadas'
import { useRecebimentosSemana } from '@/hooks/use-recebimentos-semana'
import { ROUTES } from '@/constants/routes'
import type { Fornecedor } from '@/types/fornecedor'
import type { Transportadora } from '@/types/transportadora'
import type { EstoqueAtual, EstoqueConfig } from '@/types/estoque'
import { MATERIAS_PRIMA } from '@/types/formula'
import { cn } from '@/lib/utils/cn'
import { PageTitle } from '@/components/ui/page-header'

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

const DIAS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

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

// ─── Peças visuais da tela (mesma gramática da Ordens do Dia) ──────────────
type StatusReceb = ReturnType<typeof getStatusRecebimento>
const STATUS_PILL: Record<StatusReceb, { icon: LucideIcon; cls: string }> = {
  AGUARDANDO_CHEGADA: { icon: Truck,        cls: 'bg-industrial-200 text-industrial-800' },
  AGUARDANDO_FILA:    { icon: Clock3,       cls: 'bg-amber-500/20 text-amber-300' },
  DESCARREGANDO:      { icon: PlayCircle,   cls: 'bg-info-500 text-white' },
  FINALIZADO:         { icon: PackageCheck, cls: 'bg-brand-700 text-white' },
}
function StatusPill({ status }: { status: StatusReceb }) {
  const { icon: Icon, cls } = STATUS_PILL[status]
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-[10px] font-bold', cls)}>
      <Icon className="size-3" /> {STATUS_RECEBIMENTO_LABEL[status]}
    </span>
  )
}
function PlacaChip({ placa }: { placa: string }) {
  return (
    <span className="inline-flex items-center rounded-md border border-industrial-400 bg-industrial-50 px-1.5 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wider text-industrial-900">
      {placa}
    </span>
  )
}
function Kpi({ label, value, unit, caption, icon: Icon, tone = 'neutral' }: {
  label: string; value: string | number; unit?: string; caption?: string; icon: LucideIcon; tone?: 'neutral' | 'brand' | 'amber' | 'info'
}) {
  const cor = { neutral: 'text-industrial-900', brand: 'text-brand-400', amber: 'text-amber-300', info: 'text-info-400' }[tone]
  const fundo = { neutral: 'bg-industrial-200 text-industrial-600', brand: 'bg-brand-500/15 text-brand-300', amber: 'bg-amber-500/15 text-amber-300', info: 'bg-info-500/15 text-info-400' }[tone]
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-industrial-200 bg-industrial-100 px-4 py-3">
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-industrial-600">{label}</p>
        <p className={cn('mt-1 font-mono text-2xl font-extrabold leading-none', cor)}>
          {value}{unit && <span className="ml-1 text-sm font-normal text-industrial-600">{unit}</span>}
        </p>
        {caption && <p className="mt-1.5 truncate text-[11px] text-industrial-600">{caption}</p>}
      </div>
      <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', fundo)}><Icon className="size-[18px]" /></span>
    </div>
  )
}
function AcaoBtn({ tone = 'neutral', className, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'neutral' | 'primary' | 'warn' }) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50',
        tone === 'primary' && 'bg-brand-600 text-white hover:bg-brand-500',
        tone === 'warn' && 'bg-amber-500/15 text-amber-300 hover:bg-amber-500/25',
        tone === 'neutral' && 'text-industrial-500 hover:bg-industrial-200 hover:text-brand-300',
        className,
      )}
    >
      {children}
    </button>
  )
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

  // Indicadores da semana por etapa do recebimento.
  const kpis = useMemo(() => {
    const acc = { previstos: 0, aCaminho: 0, naFila: 0, descarregando: 0, finalizados: 0, tonsRecebidas: 0 }
    for (const r of recebimentos) {
      acc.previstos++
      const s = getStatusRecebimento(r)
      if (s === 'AGUARDANDO_CHEGADA') acc.aCaminho++
      else if (s === 'AGUARDANDO_FILA') acc.naFila++
      else if (s === 'DESCARREGANDO') acc.descarregando++
      else { acc.finalizados++; acc.tonsRecebidas += r.quantidade_ton ?? 0 }
    }
    return acc
  }, [recebimentos])
  const ativos = useMemo(() => motoristasAtivos(recebimentos).length, [recebimentos])
  // Mapa só ocupa a tela quando tem alguém a caminho; senão fica uma faixa recolhida.
  const [mapaAberto, setMapaAberto] = useState<boolean | null>(null)
  const mostrarMapa = mapaAberto ?? ativos > 0

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
          <PageTitle>Programação de Recebimento</PageTitle>
          <div className="flex items-center gap-1.5 mt-2">
            <button type="button" onClick={() => irParaSemana(addDiasIso(semanaInicio, -7))} aria-label="Semana anterior"
              className="rounded-lg border border-industrial-300 p-1.5 text-industrial-600 hover:text-industrial-900 hover:border-brand-500 transition-colors">
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-sm font-medium text-industrial-800 px-2">
              Semana de {ddmm(semanaInicio)} a {ddmm(semanaFim)}
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
      </div>

      {/* Indicadores da semana */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi label="Previsto na semana" value={totalSemana.toFixed(2)} unit="ton" tone="brand" icon={CalendarClock}
          caption={`${kpis.previstos} ${kpis.previstos === 1 ? 'carga prevista' : 'cargas previstas'} · ${kpis.aCaminho} a caminho`} />
        <Kpi label="Na fila" value={kpis.naFila} tone="amber" icon={Clock3}
          caption={kpis.naFila ? 'chegaram e aguardam descarga' : 'ninguém aguardando no pátio'} />
        <Kpi label="Descarregando" value={kpis.descarregando} tone="info" icon={PlayCircle}
          caption={kpis.descarregando ? 'descarga em andamento' : 'nenhuma descarga agora'} />
        <Kpi label="Recebido" value={kpis.tonsRecebidas.toFixed(2)} unit="ton" tone="brand" icon={PackageCheck}
          caption={`${kpis.finalizados} ${kpis.finalizados === 1 ? 'descarga finalizada' : 'descargas finalizadas'} · já no estoque`} />
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
      {(podeConfirmar || podeEditar) && (
        <div className="rounded-xl border border-industrial-200 bg-industrial-100">
          <button
            type="button"
            onClick={() => setMapaAberto(!mostrarMapa)}
            aria-expanded={mostrarMapa}
            className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-industrial-200/40"
          >
            <span className={cn('flex size-8 items-center justify-center rounded-lg', ativos > 0 ? 'bg-brand-500/15 text-brand-300' : 'bg-industrial-200 text-industrial-600')}>
              <MapPin className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-industrial-900">Motoristas a caminho</span>
              <span className="block text-[11px] text-industrial-600">
                {ativos > 0 ? `${ativos} ${ativos === 1 ? 'motorista compartilhando' : 'motoristas compartilhando'} a localização agora` : 'Ninguém compartilhando localização — o mapa abre sozinho quando alguém ativar o link de chegada'}
              </span>
            </span>
            <span className={cn('rounded-full px-2 py-0.5 font-mono text-[11px] font-bold', ativos > 0 ? 'bg-brand-500/15 text-brand-300' : 'bg-industrial-200 text-industrial-600')}>
              {ativos} {ativos === 1 ? 'ativo' : 'ativos'}
            </span>
            <ChevronDown className={cn('size-4 text-industrial-500 transition-transform', mostrarMapa && 'rotate-180')} />
          </button>
          {mostrarMapa && (
            <div className="border-t border-industrial-200 p-2">
              <MapaChegadas recebimentos={recebimentos} />
            </div>
          )}
        </div>
      )}

      {/* Grade da semana */}
      <div className="grid grid-cols-1 gap-4 md:flex md:flex-wrap md:items-start md:justify-center md:gap-4">
        {dias.map(({ nome, data }) => {
          const ehAmanha = data === amanha
          const ehHoje = data === hoje
          return (
            <div
              key={data}
              className={cn(
                'flex flex-col gap-2 rounded-xl border p-2.5 md:min-w-[240px] md:max-w-[380px] md:flex-1',
                ehAmanha ? 'border-brand-500 bg-brand-500/10' : ehHoje ? 'border-industrial-500' : 'border-industrial-200',
              )}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-display text-sm font-bold text-industrial-900">{nome}</p>
                  <p className="text-xs text-industrial-600">
                    {ddmm(data)}{ehAmanha && <span className="ml-1 text-brand-300 font-semibold">· amanhã</span>}{ehHoje && <span className="ml-1 text-industrial-500 font-semibold">· hoje</span>}
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-brand-300">{totalDia(data).toFixed(2)}</span>
              </div>

              <div className="flex flex-col gap-2">
                {doDia(data).map((r) => {
                  const status = getStatusRecebimento(r)
                  const finalizado = status === 'FINALIZADO'
                  const placa = labelPlacaCompleta(r)
                  return (
                  <div
                    key={r.id}
                    className={cn(
                      'rounded-lg border p-2.5 transition-colors',
                      finalizado ? 'border-brand-500 bg-brand-500/15'
                        : status === 'DESCARREGANDO' ? 'border-info-500/60 bg-info-500/10'
                        : status === 'AGUARDANDO_FILA' ? 'border-amber-500/50 bg-amber-500/10'
                        : 'border-industrial-300 bg-industrial-100',
                    )}
                  >
                    {/* Matéria-prima + ações */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="break-words text-sm font-semibold leading-snug text-industrial-900">{labelMateriaPrima(r)}</p>
                        <p className="mt-0.5 font-mono text-base font-extrabold leading-none text-brand-300">
                          {(r.quantidade_ton ?? 0).toFixed(2)}<span className="ml-1 text-[10px] font-normal text-industrial-500">ton</span>
                        </p>
                      </div>
                      {podeEditar && (
                        <div className="flex shrink-0 gap-0.5">
                          {!r.finalizado_em && (
                            <button type="button" onClick={() => abrirEdicao(r)} title="Editar recebimento" aria-label="Editar recebimento"
                              className="flex size-6 items-center justify-center rounded-md text-industrial-500 transition-colors hover:bg-industrial-200 hover:text-brand-300"><Pencil className="size-3.5" /></button>
                          )}
                          <button type="button" onClick={() => remover(r)} title="Remover previsão" aria-label="Remover previsão"
                            className="flex size-6 items-center justify-center rounded-md text-industrial-500 transition-colors hover:bg-industrial-200 hover:text-red-400"><Trash2 className="size-3.5" /></button>
                        </div>
                      )}
                    </div>

                    {/* Fornecedor, transportadora, placa, NF */}
                    <div className="mt-1.5 flex flex-col gap-1 text-xs text-industrial-600">
                      <p className="break-words"><span className="text-industrial-500">Fornecedor:</span> <span className="font-medium text-industrial-800">{labelFornecedor(r)}</span></p>
                      {(r.transportadora?.nome || r.motorista_nome) && (
                        <p className="flex items-start gap-1 break-words">
                          <Container className="mt-px size-3 shrink-0 text-industrial-500" />
                          <span>{r.transportadora?.nome}{r.transportadora?.nome && r.motorista_nome && ' · '}{r.motorista_nome}</span>
                        </p>
                      )}
                      {(placa || r.numero_nota) && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                          {placa && <PlacaChip placa={placa} />}
                          {r.numero_nota && (
                            <span className="inline-flex items-center gap-1 rounded-md border border-industrial-300 bg-industrial-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-industrial-800">
                              <FileText className="size-3 text-industrial-500" /> NF-e {r.numero_nota}
                            </span>
                          )}
                        </div>
                      )}
                      {r.observacao && <p className="break-words italic">{r.observacao}</p>}
                    </div>

                    {/* Etapa + ações do Faturamento */}
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-industrial-200 pt-2">
                      <StatusPill status={status} />
                      {r.confirmado_em && (
                        <span className="text-[10.5px] text-industrial-500" title={r.confirmado_por ? `Confirmado por ${r.confirmado_por}` : undefined}>
                          chegou {new Date(r.confirmado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          {r.finalizado_em && ` · descarregado ${new Date(r.finalizado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
                        </span>
                      )}
                    </div>
                    {podeConfirmar && !finalizado && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {status === 'AGUARDANDO_CHEGADA' && (
                          <AcaoBtn tone="primary" onClick={() => confirmarChegada(r)} disabled={processandoId === r.id}>
                            <Truck className="size-3.5" /> {processandoId === r.id ? 'Confirmando…' : 'Confirmar chegada'}
                          </AcaoBtn>
                        )}
                        {status === 'AGUARDANDO_FILA' && (
                          <AcaoBtn tone="primary" onClick={() => iniciarDescarga(r)} disabled={processandoId === r.id}>
                            <PlayCircle className="size-3.5" /> {processandoId === r.id ? 'Iniciando…' : 'Iniciar descarga'}
                          </AcaoBtn>
                        )}
                        {status === 'DESCARREGANDO' && (
                          <AcaoBtn tone="primary" onClick={() => finalizarDescarga(r)} disabled={processandoId === r.id}>
                            <Flag className="size-3.5" /> {processandoId === r.id ? 'Finalizando…' : 'Finalizar descarga'}
                          </AcaoBtn>
                        )}
                      </div>
                    )}
                  </div>
                  )
                })}

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

      {/* Modal de novo recebimento / edição — z acima do teto do Leaflet
          (1000), garantia extra contra o mapa vazar por cima dos campos */}
      {form && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50 p-4 overflow-y-auto" onClick={fecharModal}>
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
