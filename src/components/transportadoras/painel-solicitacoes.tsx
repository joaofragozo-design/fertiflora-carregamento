'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, Container, FileDown, MessageCircle, Trash2, Pencil, X } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { ProgramacaoService } from '@/services/programacao.service'
import { TransportadorasService } from '@/services/transportadoras.service'
import type { Programacao } from '@/types/programacao'
import type { Motorista } from '@/types/transportadora'
import { formatPlacaCompleta } from '@/lib/utils/format'

interface PainelSolicitacoesProps {
  initialSolicitacoes: Programacao[]
  usuario:             string
}

interface FormMotoristaState {
  id:           string
  nome:         string
  whatsapp:     string
  cpf:          string
  rg:           string
  cnh:          string
  placa_cavalo: string
  placa_1:      string
  placa_2:      string
  placa_3:      string
  placa_4:      string
}

function ddmm(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

function tonsDoAgendamento(ag: Programacao): number {
  return (ag.itens ?? []).reduce((s, it) => s + (it.tons ?? 0), 0)
}

/** Fila da Logística: liberar a solicitação (clique 1) e enviar o WhatsApp pro
 *  motorista (clique 2) — envio automático via WuzAPI (self-hosted); se falhar
 *  (self-host fora do ar, número desconectado etc.), cai pro link wa.me manual. */
export function PainelSolicitacoes({ initialSolicitacoes, usuario }: PainelSolicitacoesProps) {
  const [agendamentos, setAgendamentos] = useState(initialSolicitacoes)
  const [liberandoId, setLiberandoId] = useState<string | null>(null)
  const [enviandoId, setEnviandoId] = useState<string | null>(null)
  const [excluindoId, setExcluindoId] = useState<string | null>(null)
  const [formMotorista, setFormMotorista] = useState<FormMotoristaState | null>(null)
  const [salvandoMotorista, setSalvandoMotorista] = useState(false)
  const [excluindoMotoristaId, setExcluindoMotoristaId] = useState<string | null>(null)
  const supabase = useRef(createClient()).current
  const svc = useRef(new ProgramacaoService(createClient())).current
  const transpSvc = useRef(new TransportadorasService(createClient())).current

  const refetch = useCallback(async () => {
    try {
      setAgendamentos(await svc.getPendentesLiberacao())
    } catch {
      /* silencioso: realtime e polling continuam tentando */
    }
  }, [svc])

  // Tempo real: outra pessoa liberando/excluindo (ou uma nova solicitação
  // chegando da transportadora) reflete aqui sem precisar recarregar a página.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const agendarRefetch = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => { refetch() }, 250)
    }

    const channel = supabase
      .channel('painel_solicitacoes_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'programacao_carregamento' }, agendarRefetch)
      .subscribe()

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refetch()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    const pollTimer = setInterval(refetch, 20_000)

    return () => {
      supabase.removeChannel(channel)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      clearInterval(pollTimer)
      if (timer) clearTimeout(timer)
    }
  }, [supabase, refetch])

  const solicitacoesPendentes = useMemo(
    () => agendamentos.filter((ag) => ag.solicitacao_status === 'SOLICITADO'),
    [agendamentos],
  )
  const liberadosAguardandoWhatsapp = useMemo(
    () => agendamentos.filter((ag) => ag.solicitacao_status === 'LIBERADO' && !ag.whatsapp_enviado_em),
    [agendamentos],
  )

  async function liberarSolicitacao(ag: Programacao) {
    if (!ag.motorista?.whatsapp) {
      toast.error('Solicitação sem motorista com WhatsApp — peça pra transportadora reenviar.')
      return
    }
    setLiberandoId(ag.id)
    try {
      const upd = await svc.liberarSolicitacao(ag.id, usuario)
      setAgendamentos((prev) => prev.map((a) => (a.id === upd.id ? upd : a)))
      toast.success(`Liberado — clique em "Enviar WhatsApp" para avisar ${ag.motorista.nome}.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao liberar a solicitação.')
    } finally {
      setLiberandoId(null)
    }
  }

  async function excluirSolicitacao(ag: Programacao) {
    const label = `${ag.transportadora?.nome ?? 'esta solicitação'}${ag.motorista?.nome ? ' · ' + ag.motorista.nome : ''}`

    // Já foi enviada pra produção (Ordens do Dia) — excluir aqui deixaria o
    // registro em ordens_diarias órfão (perde transportadora/motorista/nº da
    // ordem pra sempre, FK "on delete set null"). Gerencie por /programacao.
    if (ag.enviado_em) {
      toast.error('Esta solicitação já foi enviada para Ordens do Dia — para excluir, use a tela de Programação.')
      return
    }

    const aviso = ag.solicitacao_status === 'LIBERADO'
      ? `ATENÇÃO: esta solicitação já foi LIBERADA${ag.numero_ordem ? ` (ordem nº ${String(ag.numero_ordem).padStart(6, '0')})` : ''} — o PDF e/ou a mensagem de WhatsApp já podem ter sido enviados ao motorista. Excluir apaga esse número em definitivo (não poderá ser reimpresso depois).\n\nExcluir a solicitação de ${label} mesmo assim?`
      : `Excluir a solicitação de ${label}? Essa ação não pode ser desfeita.`
    if (!window.confirm(aviso)) return

    setExcluindoId(ag.id)
    try {
      await svc.deletar(ag.id)
      setAgendamentos((prev) => prev.filter((a) => a.id !== ag.id))
      toast.success('Solicitação excluída.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao excluir a solicitação.')
    } finally {
      setExcluindoId(null)
    }
  }

  async function enviarWhatsapp(ag: Programacao) {
    if (!ag.motorista?.whatsapp) return
    setEnviandoId(ag.id)
    try {
      const res = await fetch(`/api/whatsapp/liberar/${ag.id}`, { method: 'POST' })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        // Envio automático falhou (WuzAPI fora do ar, número desconectado etc.)
        // — abre o link manual pra não travar a fila.
        if (json?.linkManual) window.open(json.linkManual, '_blank', 'noopener')
        toast.error(json?.error ? `${json.error} Abrindo link manual.` : 'Falha no envio automático — abrindo link manual.')
        return
      }
      setAgendamentos((prev) => prev.map((a) => (a.id === json.agendamento.id ? json.agendamento : a)))
      toast.success(`WhatsApp enviado pra ${ag.motorista.nome}.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar o WhatsApp.')
    } finally {
      setEnviandoId(null)
    }
  }

  function abrirEdicaoMotorista(m: Motorista) {
    setFormMotorista({
      id: m.id, nome: m.nome, whatsapp: m.whatsapp, cpf: m.cpf, rg: m.rg, cnh: m.cnh,
      placa_cavalo: m.placa_cavalo, placa_1: m.placa_1,
      placa_2: m.placa_2 ?? '', placa_3: m.placa_3 ?? '', placa_4: m.placa_4 ?? '',
    })
  }

  async function salvarMotorista() {
    if (!formMotorista) return
    setSalvandoMotorista(true)
    try {
      await transpSvc.atualizarMotorista(formMotorista.id, {
        nome: formMotorista.nome,
        whatsapp: formMotorista.whatsapp,
        cpf: formMotorista.cpf,
        rg: formMotorista.rg,
        cnh: formMotorista.cnh,
        placa_cavalo: formMotorista.placa_cavalo,
        placa_1: formMotorista.placa_1,
        placa_2: formMotorista.placa_2,
        placa_3: formMotorista.placa_3,
        placa_4: formMotorista.placa_4,
      })
      setFormMotorista(null)
      toast.success('Motorista atualizado.')
      await refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar motorista.')
    } finally {
      setSalvandoMotorista(false)
    }
  }

  async function excluirMotorista(m: Motorista) {
    if (!window.confirm(`Excluir o cadastro do motorista ${m.nome}? Ele some da frota da transportadora e some das solicitações que ainda dependem dele.`)) return
    setExcluindoMotoristaId(m.id)
    try {
      await transpSvc.excluirMotorista(m.id)
      toast.success('Motorista excluído.')
      await refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao excluir motorista.')
    } finally {
      setExcluindoMotoristaId(null)
    }
  }

  if (solicitacoesPendentes.length === 0 && liberadosAguardandoWhatsapp.length === 0) {
    return (
      <div className="rounded-xl border border-industrial-200 p-4">
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-industrial-600">
          <Container className="size-3.5 text-brand-600" /> Solicitações de carregamento
        </p>
        <p className="text-sm text-industrial-500 mt-2">Nenhuma solicitação aguardando ação no momento.</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border-2 border-amber-500 bg-amber-100 p-4">
      <p className="flex items-center gap-2 text-sm font-bold text-amber-900 mb-2.5">
        <Container className="size-4" />
        Solicitações de carregamento · {solicitacoesPendentes.length + liberadosAguardandoWhatsapp.length}
      </p>
      <div className="flex flex-col gap-2">
        {solicitacoesPendentes.map((ag) => {
          const ocupado = liberandoId === ag.id || excluindoId === ag.id
          return (
          <div key={ag.id} className="flex items-center justify-between gap-3 flex-wrap rounded-xl bg-industrial-100 border border-industrial-300 px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-bold text-industrial-900">
                {ag.transportadora?.nome ?? 'Transportadora'}
                <span className="font-normal text-industrial-600"> · {ag.cliente || 'sem cliente'} · {ddmm(ag.data)}</span>
              </p>
              <p className="text-xs text-industrial-600 mt-0.5 flex items-center gap-1 flex-wrap">
                <span>
                  Motorista: <span className="font-semibold text-industrial-800">{ag.motorista?.nome ?? '—'}</span>
                  {ag.motorista?.whatsapp && <span className="font-mono"> · {ag.motorista.whatsapp}</span>}
                  <span className="text-industrial-500"> · {tonsDoAgendamento(ag).toFixed(2)} ton</span>
                </span>
                {ag.motorista && (
                  <span className="inline-flex items-center gap-1">
                    <button type="button" onClick={() => abrirEdicaoMotorista(ag.motorista!)} title="Editar motorista" className="text-industrial-500 hover:text-brand-700">
                      <Pencil className="size-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => excluirMotorista(ag.motorista!)}
                      disabled={excluindoMotoristaId === ag.motorista.id}
                      title="Excluir motorista"
                      className="text-industrial-500 hover:text-red-600 disabled:opacity-50"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </span>
                )}
              </p>
              {ag.motorista && formatPlacaCompleta(ag.motorista) && (
                <p className="mt-0.5 font-mono text-sm font-bold uppercase text-industrial-900">
                  {formatPlacaCompleta(ag.motorista)}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => excluirSolicitacao(ag)}
                disabled={ocupado}
                title="Excluir solicitação"
                className="flex items-center justify-center rounded-lg border border-industrial-400 text-industrial-600 hover:border-red-500 hover:text-red-600 p-2 transition-colors disabled:opacity-50"
              >
                <Trash2 className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => liberarSolicitacao(ag)}
                disabled={ocupado}
                className="flex items-center gap-1.5 rounded-lg bg-brand-700 hover:bg-brand-600 text-white px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
              >
                <CheckCircle2 className="size-4" />
                {liberandoId === ag.id ? 'Liberando…' : 'Liberar'}
              </button>
            </div>
          </div>
          )
        })}
        {liberadosAguardandoWhatsapp.map((ag) => (
          <div key={ag.id} className="flex items-center justify-between gap-3 flex-wrap rounded-xl bg-brand-50 border-2 border-brand-500 px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-bold text-industrial-900 flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-brand-700 shrink-0" />
                {ag.transportadora?.nome ?? 'Transportadora'}
                <span className="font-normal text-industrial-600"> · {ag.cliente || 'sem cliente'} · {ddmm(ag.data)}</span>
              </p>
              <p className="text-xs text-industrial-600 mt-0.5 flex items-center gap-1 flex-wrap">
                <span>
                  Liberado — motorista: <span className="font-semibold text-industrial-800">{ag.motorista?.nome ?? '—'}</span>
                  {ag.motorista?.whatsapp && <span className="font-mono"> · {ag.motorista.whatsapp}</span>}
                </span>
                {ag.motorista && (
                  <span className="inline-flex items-center gap-1">
                    <button type="button" onClick={() => abrirEdicaoMotorista(ag.motorista!)} title="Editar motorista" className="text-industrial-500 hover:text-brand-700">
                      <Pencil className="size-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => excluirMotorista(ag.motorista!)}
                      disabled={excluindoMotoristaId === ag.motorista.id}
                      title="Excluir motorista"
                      className="text-industrial-500 hover:text-red-600 disabled:opacity-50"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </span>
                )}
              </p>
              {ag.motorista && formatPlacaCompleta(ag.motorista) && (
                <p className="mt-0.5 font-mono text-sm font-bold uppercase text-industrial-900">
                  {formatPlacaCompleta(ag.motorista)}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => excluirSolicitacao(ag)}
                disabled={excluindoId === ag.id}
                title="Excluir solicitação"
                className="flex items-center justify-center rounded-lg border border-industrial-400 text-industrial-600 hover:border-red-500 hover:text-red-600 p-2 transition-colors disabled:opacity-50"
              >
                <Trash2 className="size-4" />
              </button>
              {ag.numero_ordem && (
                <a
                  href={`/api/programacao/${ag.id}/ordem-pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Baixar ordem de carregamento em PDF"
                  className="flex items-center gap-1.5 rounded-lg border border-brand-600 text-brand-700 hover:bg-brand-100 px-3 py-2 text-sm font-semibold transition-colors"
                >
                  <FileDown className="size-4" /> Nº {String(ag.numero_ordem).padStart(6, '0')}
                </a>
              )}
              <button
                type="button"
                onClick={() => enviarWhatsapp(ag)}
                disabled={enviandoId === ag.id}
                className="flex items-center gap-1.5 rounded-lg bg-brand-700 hover:bg-brand-600 text-white px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
              >
                <MessageCircle className="size-4" /> {enviandoId === ag.id ? 'Enviando…' : 'Enviar WhatsApp'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal de edição do motorista */}
      {formMotorista && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto" onClick={() => setFormMotorista(null)}>
          <div className="w-full max-w-md rounded-xl bg-industrial-100 border border-industrial-300 p-5 flex flex-col gap-3 my-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-industrial-900">Editar motorista</h2>
              <button type="button" onClick={() => setFormMotorista(null)} className="text-industrial-600 hover:text-industrial-900"><X className="size-5" /></button>
            </div>

            <label className="text-xs font-medium text-industrial-600">Nome do motorista
              <input
                autoFocus
                value={formMotorista.nome}
                onChange={(e) => setFormMotorista({ ...formMotorista, nome: e.target.value })}
                className="mt-1 w-full bg-industrial-50 border border-industrial-400 rounded-lg px-3 py-2 text-sm text-industrial-900 focus:outline-none focus:border-brand-500"
              />
            </label>
            <label className="text-xs font-medium text-industrial-600">WhatsApp com DDD (obrigatório — recebe o aviso de liberação)
              <input
                value={formMotorista.whatsapp}
                onChange={(e) => setFormMotorista({ ...formMotorista, whatsapp: e.target.value })}
                className="mt-1 w-full bg-industrial-50 border border-industrial-400 rounded-lg px-3 py-2 text-sm font-mono text-industrial-900 focus:outline-none focus:border-brand-500"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-medium text-industrial-600">CPF
                <input
                  value={formMotorista.cpf}
                  onChange={(e) => setFormMotorista({ ...formMotorista, cpf: e.target.value })}
                  className="mt-1 w-full bg-industrial-50 border border-industrial-400 rounded-lg px-3 py-2 text-sm font-mono text-industrial-900 focus:outline-none focus:border-brand-500"
                />
              </label>
              <label className="text-xs font-medium text-industrial-600">RG
                <input
                  value={formMotorista.rg}
                  onChange={(e) => setFormMotorista({ ...formMotorista, rg: e.target.value })}
                  className="mt-1 w-full bg-industrial-50 border border-industrial-400 rounded-lg px-3 py-2 text-sm font-mono text-industrial-900 focus:outline-none focus:border-brand-500"
                />
              </label>
            </div>

            <label className="text-xs font-medium text-industrial-600">Número da CNH
              <input
                value={formMotorista.cnh}
                onChange={(e) => setFormMotorista({ ...formMotorista, cnh: e.target.value })}
                className="mt-1 w-full bg-industrial-50 border border-industrial-400 rounded-lg px-3 py-2 text-sm font-mono text-industrial-900 focus:outline-none focus:border-brand-500"
              />
            </label>

            <div className="border-t border-industrial-300 pt-3 mt-1">
              <p className="text-xs font-semibold text-industrial-700 mb-2">Placas do veículo</p>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs font-medium text-industrial-600">Placa cavalo
                  <input
                    value={formMotorista.placa_cavalo}
                    onChange={(e) => setFormMotorista({ ...formMotorista, placa_cavalo: e.target.value.toUpperCase() })}
                    className="mt-1 w-full bg-industrial-50 border border-industrial-400 rounded-lg px-3 py-2 text-sm font-mono uppercase text-industrial-900 focus:outline-none focus:border-brand-500"
                  />
                </label>
                <label className="text-xs font-medium text-industrial-600">Placa 1
                  <input
                    value={formMotorista.placa_1}
                    onChange={(e) => setFormMotorista({ ...formMotorista, placa_1: e.target.value.toUpperCase() })}
                    className="mt-1 w-full bg-industrial-50 border border-industrial-400 rounded-lg px-3 py-2 text-sm font-mono uppercase text-industrial-900 focus:outline-none focus:border-brand-500"
                  />
                </label>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-3">
                <label className="text-xs font-medium text-industrial-600">Placa 2
                  <input
                    value={formMotorista.placa_2}
                    onChange={(e) => setFormMotorista({ ...formMotorista, placa_2: e.target.value.toUpperCase() })}
                    placeholder="opcional"
                    className="mt-1 w-full bg-industrial-50 border border-industrial-400 rounded-lg px-3 py-2 text-sm font-mono uppercase text-industrial-900 placeholder-industrial-500 focus:outline-none focus:border-brand-500"
                  />
                </label>
                <label className="text-xs font-medium text-industrial-600">Placa 3
                  <input
                    value={formMotorista.placa_3}
                    onChange={(e) => setFormMotorista({ ...formMotorista, placa_3: e.target.value.toUpperCase() })}
                    placeholder="opcional"
                    className="mt-1 w-full bg-industrial-50 border border-industrial-400 rounded-lg px-3 py-2 text-sm font-mono uppercase text-industrial-900 placeholder-industrial-500 focus:outline-none focus:border-brand-500"
                  />
                </label>
                <label className="text-xs font-medium text-industrial-600">Placa 4
                  <input
                    value={formMotorista.placa_4}
                    onChange={(e) => setFormMotorista({ ...formMotorista, placa_4: e.target.value.toUpperCase() })}
                    placeholder="opcional"
                    className="mt-1 w-full bg-industrial-50 border border-industrial-400 rounded-lg px-3 py-2 text-sm font-mono uppercase text-industrial-900 placeholder-industrial-500 focus:outline-none focus:border-brand-500"
                  />
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setFormMotorista(null)}
                className="rounded-lg border border-industrial-400 px-4 py-2 text-sm font-medium text-industrial-700 hover:bg-industrial-200">Cancelar</button>
              <button
                type="button"
                onClick={salvarMotorista}
                disabled={
                  salvandoMotorista ||
                  !formMotorista.nome.trim() ||
                  formMotorista.whatsapp.replace(/\D/g, '').length < 10 ||
                  formMotorista.cpf.replace(/\D/g, '').length !== 11 ||
                  !formMotorista.rg.trim() ||
                  !formMotorista.cnh.trim() ||
                  !formMotorista.placa_cavalo.trim() ||
                  !formMotorista.placa_1.trim()
                }
                className="rounded-lg bg-brand-700 hover:bg-brand-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {salvandoMotorista ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
