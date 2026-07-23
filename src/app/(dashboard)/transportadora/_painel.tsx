'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, X, Truck, Clock, CheckCircle2, Send, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { ProgramacaoService } from '@/services/programacao.service'
import { TransportadorasService } from '@/services/transportadoras.service'
import type { Programacao } from '@/types/programacao'
import type { Transportadora, Motorista } from '@/types/transportadora'
import { VALIDADE_LIBERACAO_HORAS } from '@/types/transportadora'
import { EMBALAGEM_LABEL, mascararNomeFormula } from '@/types/formula'
import { cn } from '@/lib/utils/cn'

interface PainelTransportadoraProps {
  transportadora:      Transportadora
  initialAgendamentos: Programacao[]
  initialMotoristas:   Motorista[]
}

const POLL_MS = 30_000

interface FormMotoristaState {
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

const FORM_MOTORISTA_VAZIO: FormMotoristaState = {
  nome: '', whatsapp: '', cpf: '', rg: '', cnh: '',
  placa_cavalo: '', placa_1: '', placa_2: '', placa_3: '', placa_4: '',
}

function fmtData(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })
}

/** Painel da transportadora: vê os carregamentos endereçados a ela, cadastra
 *  motorista (WhatsApp obrigatório) e envia a solicitação pra Fertiflora liberar. */
export function PainelTransportadora({ transportadora, initialAgendamentos, initialMotoristas }: PainelTransportadoraProps) {
  const [agendamentos, setAgendamentos] = useState(initialAgendamentos)
  const [motoristas, setMotoristas] = useState(initialMotoristas)
  const [motoristaSel, setMotoristaSel] = useState<Record<string, string>>({}) // agendamento.id → motorista.id
  const [enviandoId, setEnviandoId] = useState<string | null>(null)
  const [formMotorista, setFormMotorista] = useState<FormMotoristaState | null>(null)
  const [salvandoMotorista, setSalvandoMotorista] = useState(false)

  const progSvc = useRef(new ProgramacaoService(createClient())).current
  const transpSvc = useRef(new TransportadorasService(createClient())).current

  // A tela fica aberta na transportadora — atualiza sozinha quando a
  // Fertiflora envia um agendamento novo ou libera uma solicitação.
  useEffect(() => {
    const refetch = async () => {
      try {
        setAgendamentos(await progSvc.getDaTransportadora(transportadora.id))
      } catch { /* silencioso — o polling tenta de novo */ }
    }
    const onVisibility = () => { if (document.visibilityState === 'visible') refetch() }
    document.addEventListener('visibilitychange', onVisibility)
    const timer = setInterval(refetch, POLL_MS)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      clearInterval(timer)
    }
  }, [progSvc, transportadora.id])

  const pendentes = useMemo(() => agendamentos.filter((a) => a.solicitacao_status === 'ENVIADO_TRANSPORTADORA'), [agendamentos])
  const aguardando = useMemo(() => agendamentos.filter((a) => a.solicitacao_status === 'SOLICITADO'), [agendamentos])
  const liberados = useMemo(() => agendamentos.filter((a) => a.solicitacao_status === 'LIBERADO'), [agendamentos])

  async function cadastrarMotorista() {
    if (!formMotorista) return
    setSalvandoMotorista(true)
    try {
      const novo = await transpSvc.criarMotorista({
        transportadora_id: transportadora.id,
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
      setMotoristas((prev) => [...prev, novo].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')))
      setFormMotorista(null)
      toast.success(`Motorista ${novo.nome} cadastrado.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao cadastrar motorista.')
    } finally {
      setSalvandoMotorista(false)
    }
  }

  async function enviarSolicitacao(ag: Programacao) {
    const motoristaId = motoristaSel[ag.id]
    if (!motoristaId) {
      toast.error('Selecione o motorista antes de enviar.')
      return
    }
    setEnviandoId(ag.id)
    try {
      const upd = await progSvc.enviarSolicitacao(ag.id, motoristaId)
      setAgendamentos((prev) => prev.map((a) => (a.id === upd.id ? upd : a)))
      toast.success('Solicitação enviada — aguarde a liberação da Fertiflora.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar solicitação.')
    } finally {
      setEnviandoId(null)
    }
  }

  function CardItens({ ag }: { ag: Programacao }) {
    const total = (ag.itens ?? []).reduce((s, it) => s + (it.tons ?? 0), 0)
    return (
      <div className="flex flex-col gap-0.5 mt-1.5">
        {(ag.itens ?? []).map((item) => (
          <p key={item.id} className="text-xs text-industrial-400">
            {item.quantidade} {EMBALAGEM_LABEL[item.embalagem]}
            {item.formula?.nome && <> — Fórmula <span className="font-mono font-semibold text-industrial-200">{mascararNomeFormula(item.formula.nome)}</span></>}
            <span className="text-industrial-500"> · {(item.tons ?? 0).toFixed(2)} ton</span>
          </p>
        ))}
        <p className="text-xs font-bold text-brand-700 mt-0.5">Total: {total.toFixed(2)} ton</p>
      </div>
    )
  }

  const temSacaria = (ag: Programacao) => (ag.itens ?? []).some((it) => it.embalagem === 'SACOS')

  return (
    <div className="flex flex-col gap-5 max-w-4xl">
      <div>
        <h1 className="text-lg font-semibold text-industrial-100 flex items-center gap-2">
          <Truck className="size-5 text-brand-600" /> {transportadora.nome}
        </h1>
        <p className="text-xs text-industrial-400 mt-1">
          Carregamentos enviados pela Fertiflora. Selecione o motorista, envie a solicitação e aguarde a liberação.
        </p>
      </div>

      {/* Regras da fábrica — o motorista precisa estar ciente */}
      <div className="rounded-xl border border-amber-500 bg-amber-100 p-4">
        <p className="flex items-center gap-1.5 text-sm font-bold text-amber-900 mb-1.5">
          <AlertTriangle className="size-4" /> Orientações da fábrica
        </p>
        <ul className="text-xs text-amber-900 flex flex-col gap-0.5 list-disc pl-4">
          <li>O agendamento tem validade de {VALIDADE_LIBERACAO_HORAS} horas após a liberação.</li>
          <li>Carga em SACARIA: o motorista deve se apresentar até as 10h da manhã.</li>
          <li>Não há horário marcado — o carregamento segue a ordem definida pela indústria.</li>
          <li>Motorista aguarda no caminhão até ser chamado; não circula pelas dependências.</li>
          <li>Veículo limpo, sem resíduos, lona em bom estado e cinta/cabo — senão volta pro fim da fila.</li>
        </ul>
      </div>

      {/* PENDENTES — precisa escolher motorista e enviar */}
      {pendentes.length > 0 && (
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-industrial-300 mb-2">
            Aguardando você · {pendentes.length}
          </h2>
          <div className="flex flex-col gap-2">
            {pendentes.map((ag) => (
              <div key={ag.id} className="rounded-xl border-2 border-brand-500 bg-brand-50 p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="font-bold text-industrial-100">{ag.cliente || 'Cliente a definir'}</p>
                    <p className="text-xs text-industrial-500 capitalize">{fmtData(ag.data)}</p>
                  </div>
                  {temSacaria(ag) && (
                    <span className="rounded-full bg-amber-500 text-white text-[11px] font-bold px-2.5 py-1">
                      SACARIA — apresentar até 10h
                    </span>
                  )}
                </div>
                <CardItens ag={ag} />

                <div className="flex items-end gap-2 mt-3 flex-wrap">
                  <label className="text-xs font-medium text-industrial-400 flex-1 min-w-[200px]">Motorista
                    <select
                      value={motoristaSel[ag.id] ?? ''}
                      onChange={(e) => setMotoristaSel((prev) => ({ ...prev, [ag.id]: e.target.value }))}
                      className="mt-1 w-full bg-industrial-950 border border-industrial-600 rounded-lg px-3 py-2 text-sm text-industrial-100 focus:outline-none focus:border-brand-500"
                    >
                      <option value="">Selecionar motorista…</option>
                      {motoristas.map((m) => (
                        <option key={m.id} value={m.id}>{m.nome} — {m.placa_cavalo} — {m.whatsapp}</option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() => setFormMotorista({ ...FORM_MOTORISTA_VAZIO })}
                    className="flex items-center gap-1 rounded-lg border border-industrial-600 px-3 py-2 text-xs font-medium text-industrial-300 hover:border-brand-500 hover:text-brand-700 transition-colors"
                  >
                    <Plus className="size-3.5" /> Novo motorista
                  </button>
                  <button
                    type="button"
                    onClick={() => enviarSolicitacao(ag)}
                    disabled={enviandoId === ag.id || !motoristaSel[ag.id]}
                    className="flex items-center gap-1.5 rounded-lg bg-brand-700 hover:bg-brand-600 text-white px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
                  >
                    <Send className="size-4" /> {enviandoId === ag.id ? 'Enviando…' : 'Enviar solicitação'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AGUARDANDO LIBERAÇÃO */}
      {aguardando.length > 0 && (
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-industrial-300 mb-2">
            Aguardando liberação da Fertiflora · {aguardando.length}
          </h2>
          <div className="flex flex-col gap-2">
            {aguardando.map((ag) => (
              <div key={ag.id} className="rounded-xl border border-industrial-700 bg-industrial-900 p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="font-bold text-industrial-100">{ag.cliente || 'Cliente a definir'}</p>
                    <p className="text-xs text-industrial-500 capitalize">{fmtData(ag.data)} · Motorista: {ag.motorista?.nome ?? '—'} {ag.motorista?.placa_cavalo && `(${ag.motorista.placa_cavalo})`}</p>
                  </div>
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                    <Clock className="size-3.5" /> Solicitação enviada
                  </span>
                </div>
                <CardItens ag={ag} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* LIBERADOS */}
      {liberados.length > 0 && (
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-industrial-300 mb-2">
            Liberados · {liberados.length}
          </h2>
          <div className="flex flex-col gap-2">
            {liberados.map((ag) => {
              const validade = ag.liberado_em
                ? new Date(new Date(ag.liberado_em).getTime() + VALIDADE_LIBERACAO_HORAS * 3_600_000)
                : null
              const expirado = validade != null && validade.getTime() < Date.now()
              return (
                <div
                  key={ag.id}
                  className={cn(
                    'rounded-xl border p-4',
                    expirado ? 'border-industrial-700 bg-industrial-900 opacity-70' : 'border-brand-500 bg-brand-100',
                  )}
                >
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <p className="font-bold text-industrial-100">{ag.cliente || 'Cliente a definir'}</p>
                      <p className="text-xs text-industrial-500 capitalize">
                        {fmtData(ag.data)} · Motorista: {ag.motorista?.nome ?? '—'} {ag.motorista?.placa_cavalo && `— ${ag.motorista.placa_cavalo}`} ({ag.motorista?.whatsapp ?? '—'})
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={cn('flex items-center gap-1.5 text-xs font-bold', expirado ? 'text-industrial-500' : 'text-brand-700')}>
                        <CheckCircle2 className="size-4" />
                        {expirado ? 'Liberação expirada' : `Liberado ${ag.liberado_em ? new Date(ag.liberado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}`}
                      </span>
                      {validade && !expirado && (
                        <p className="text-[11px] text-industrial-500 mt-0.5">
                          Válido até {validade.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                    </div>
                  </div>
                  <CardItens ag={ag} />
                  {temSacaria(ag) && !expirado && (
                    <p className="text-[11px] font-bold text-amber-800 mt-1.5">⚠ Carga em sacaria: apresentar-se até as 10h da manhã.</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {agendamentos.length === 0 && (
        <p className="text-sm text-industrial-500 text-center py-16">Nenhum carregamento enviado pra você ainda.</p>
      )}

      {/* Modal novo motorista */}
      {formMotorista && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto" onClick={() => setFormMotorista(null)}>
          <div className="w-full max-w-md rounded-xl bg-industrial-900 border border-industrial-700 p-5 flex flex-col gap-3 my-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-industrial-100">Novo motorista</h2>
              <button type="button" onClick={() => setFormMotorista(null)} className="text-industrial-400 hover:text-industrial-100"><X className="size-5" /></button>
            </div>

            <label className="text-xs font-medium text-industrial-400">Nome do motorista
              <input
                autoFocus
                value={formMotorista.nome}
                onChange={(e) => setFormMotorista({ ...formMotorista, nome: e.target.value })}
                placeholder="ex.: José da Silva"
                className="mt-1 w-full bg-industrial-950 border border-industrial-600 rounded-lg px-3 py-2 text-sm text-industrial-100 placeholder-industrial-500 focus:outline-none focus:border-brand-500"
              />
            </label>
            <label className="text-xs font-medium text-industrial-400">WhatsApp com DDD (obrigatório — recebe o aviso de liberação)
              <input
                value={formMotorista.whatsapp}
                onChange={(e) => setFormMotorista({ ...formMotorista, whatsapp: e.target.value })}
                placeholder="ex.: (45) 99999-9999"
                className="mt-1 w-full bg-industrial-950 border border-industrial-600 rounded-lg px-3 py-2 text-sm font-mono text-industrial-100 placeholder-industrial-500 focus:outline-none focus:border-brand-500"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-medium text-industrial-400">CPF
                <input
                  value={formMotorista.cpf}
                  onChange={(e) => setFormMotorista({ ...formMotorista, cpf: e.target.value })}
                  placeholder="000.000.000-00"
                  className="mt-1 w-full bg-industrial-950 border border-industrial-600 rounded-lg px-3 py-2 text-sm font-mono text-industrial-100 placeholder-industrial-500 focus:outline-none focus:border-brand-500"
                />
              </label>
              <label className="text-xs font-medium text-industrial-400">RG
                <input
                  value={formMotorista.rg}
                  onChange={(e) => setFormMotorista({ ...formMotorista, rg: e.target.value })}
                  className="mt-1 w-full bg-industrial-950 border border-industrial-600 rounded-lg px-3 py-2 text-sm font-mono text-industrial-100 focus:outline-none focus:border-brand-500"
                />
              </label>
            </div>

            <label className="text-xs font-medium text-industrial-400">Número da CNH
              <input
                value={formMotorista.cnh}
                onChange={(e) => setFormMotorista({ ...formMotorista, cnh: e.target.value })}
                className="mt-1 w-full bg-industrial-950 border border-industrial-600 rounded-lg px-3 py-2 text-sm font-mono text-industrial-100 focus:outline-none focus:border-brand-500"
              />
            </label>

            <div className="border-t border-industrial-700 pt-3 mt-1">
              <p className="text-xs font-semibold text-industrial-300 mb-2">Placas do veículo</p>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs font-medium text-industrial-400">Placa cavalo
                  <input
                    value={formMotorista.placa_cavalo}
                    onChange={(e) => setFormMotorista({ ...formMotorista, placa_cavalo: e.target.value.toUpperCase() })}
                    placeholder="ABC1D23"
                    className="mt-1 w-full bg-industrial-950 border border-industrial-600 rounded-lg px-3 py-2 text-sm font-mono uppercase text-industrial-100 placeholder-industrial-500 focus:outline-none focus:border-brand-500"
                  />
                </label>
                <label className="text-xs font-medium text-industrial-400">Placa 1
                  <input
                    value={formMotorista.placa_1}
                    onChange={(e) => setFormMotorista({ ...formMotorista, placa_1: e.target.value.toUpperCase() })}
                    placeholder="ABC1D23"
                    className="mt-1 w-full bg-industrial-950 border border-industrial-600 rounded-lg px-3 py-2 text-sm font-mono uppercase text-industrial-100 placeholder-industrial-500 focus:outline-none focus:border-brand-500"
                  />
                </label>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-3">
                <label className="text-xs font-medium text-industrial-400">Placa 2
                  <input
                    value={formMotorista.placa_2}
                    onChange={(e) => setFormMotorista({ ...formMotorista, placa_2: e.target.value.toUpperCase() })}
                    placeholder="opcional"
                    className="mt-1 w-full bg-industrial-950 border border-industrial-600 rounded-lg px-3 py-2 text-sm font-mono uppercase text-industrial-100 placeholder-industrial-500 focus:outline-none focus:border-brand-500"
                  />
                </label>
                <label className="text-xs font-medium text-industrial-400">Placa 3
                  <input
                    value={formMotorista.placa_3}
                    onChange={(e) => setFormMotorista({ ...formMotorista, placa_3: e.target.value.toUpperCase() })}
                    placeholder="opcional"
                    className="mt-1 w-full bg-industrial-950 border border-industrial-600 rounded-lg px-3 py-2 text-sm font-mono uppercase text-industrial-100 placeholder-industrial-500 focus:outline-none focus:border-brand-500"
                  />
                </label>
                <label className="text-xs font-medium text-industrial-400">Placa 4
                  <input
                    value={formMotorista.placa_4}
                    onChange={(e) => setFormMotorista({ ...formMotorista, placa_4: e.target.value.toUpperCase() })}
                    placeholder="opcional"
                    className="mt-1 w-full bg-industrial-950 border border-industrial-600 rounded-lg px-3 py-2 text-sm font-mono uppercase text-industrial-100 placeholder-industrial-500 focus:outline-none focus:border-brand-500"
                  />
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setFormMotorista(null)}
                className="rounded-lg border border-industrial-600 px-4 py-2 text-sm font-medium text-industrial-300 hover:bg-industrial-800">Cancelar</button>
              <button
                type="button"
                onClick={cadastrarMotorista}
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
                {salvandoMotorista ? 'Salvando…' : 'Cadastrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
