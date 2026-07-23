'use client'

import { useMemo, useRef, useState } from 'react'
import { CheckCircle2, Container, MessageCircle } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { ProgramacaoService } from '@/services/programacao.service'
import type { Programacao } from '@/types/programacao'
import { linkWhatsApp, montarMensagemLiberacao } from '@/lib/whatsapp'
import { mascararNomeFormula } from '@/types/formula'

interface PainelSolicitacoesProps {
  initialSolicitacoes: Programacao[]
  usuario:             string
}

function ddmm(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

function tonsDoAgendamento(ag: Programacao): number {
  return (ag.itens ?? []).reduce((s, it) => s + (it.tons ?? 0), 0)
}

/** Fila da Logística: liberar a solicitação (clique 1) e abrir o WhatsApp do
 *  motorista (clique 2) — separados pra evitar bloqueio de pop-up e dar
 *  chance de conferir a mensagem antes de enviar. */
export function PainelSolicitacoes({ initialSolicitacoes, usuario }: PainelSolicitacoesProps) {
  const [agendamentos, setAgendamentos] = useState(initialSolicitacoes)
  const [liberandoId, setLiberandoId] = useState<string | null>(null)
  const [whatsappAbertoIds, setWhatsappAbertoIds] = useState<Set<string>>(new Set())
  const svc = useRef(new ProgramacaoService(createClient())).current

  const solicitacoesPendentes = useMemo(
    () => agendamentos.filter((ag) => ag.solicitacao_status === 'SOLICITADO'),
    [agendamentos],
  )
  const liberadosAguardandoWhatsapp = useMemo(
    () => agendamentos.filter((ag) => ag.solicitacao_status === 'LIBERADO' && !whatsappAbertoIds.has(ag.id)),
    [agendamentos, whatsappAbertoIds],
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
      toast.success(`Liberado — mensagem pronta pra ${ag.motorista.nome}. Clique em "Abrir WhatsApp" para enviar.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao liberar a solicitação.')
    } finally {
      setLiberandoId(null)
    }
  }

  function abrirWhatsapp(ag: Programacao) {
    if (!ag.motorista?.whatsapp) return
    const mensagem = montarMensagemLiberacao({
      motorista: ag.motorista.nome,
      transportadora: ag.transportadora?.nome ?? '',
      data: ag.data,
      itens: (ag.itens ?? []).map((it) => ({
        formulaMascarada: it.formula?.nome ? mascararNomeFormula(it.formula.nome) : '—',
        quantidade: it.quantidade,
        embalagem: it.embalagem,
      })),
    })
    window.open(linkWhatsApp(ag.motorista.whatsapp, mensagem), '_blank', 'noopener')
    setWhatsappAbertoIds((prev) => new Set(prev).add(ag.id))
  }

  if (solicitacoesPendentes.length === 0 && liberadosAguardandoWhatsapp.length === 0) {
    return (
      <div className="rounded-xl border border-industrial-800 p-4">
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-industrial-400">
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
        {solicitacoesPendentes.map((ag) => (
          <div key={ag.id} className="flex items-center justify-between gap-3 flex-wrap rounded-xl bg-industrial-900 border border-industrial-700 px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-bold text-industrial-100">
                {ag.transportadora?.nome ?? 'Transportadora'}
                <span className="font-normal text-industrial-400"> · {ag.cliente || 'sem cliente'} · {ddmm(ag.data)}</span>
              </p>
              <p className="text-xs text-industrial-400 mt-0.5">
                Motorista: <span className="font-semibold text-industrial-200">{ag.motorista?.nome ?? '—'}</span>
                {ag.motorista?.placa_cavalo && <span className="font-mono"> · {ag.motorista.placa_cavalo}</span>}
                {ag.motorista?.whatsapp && <span className="font-mono"> · {ag.motorista.whatsapp}</span>}
                <span className="text-industrial-500"> · {tonsDoAgendamento(ag).toFixed(2)} ton</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => liberarSolicitacao(ag)}
              disabled={liberandoId === ag.id}
              className="flex items-center gap-1.5 rounded-lg bg-brand-700 hover:bg-brand-600 text-white px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 shrink-0"
            >
              <CheckCircle2 className="size-4" />
              {liberandoId === ag.id ? 'Liberando…' : 'Liberar'}
            </button>
          </div>
        ))}
        {liberadosAguardandoWhatsapp.map((ag) => (
          <div key={ag.id} className="flex items-center justify-between gap-3 flex-wrap rounded-xl bg-brand-50 border-2 border-brand-500 px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-bold text-industrial-100 flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-brand-700 shrink-0" />
                {ag.transportadora?.nome ?? 'Transportadora'}
                <span className="font-normal text-industrial-400"> · {ag.cliente || 'sem cliente'} · {ddmm(ag.data)}</span>
              </p>
              <p className="text-xs text-industrial-400 mt-0.5">
                Liberado — motorista: <span className="font-semibold text-industrial-200">{ag.motorista?.nome ?? '—'}</span>
                {ag.motorista?.whatsapp && <span className="font-mono"> · {ag.motorista.whatsapp}</span>}
              </p>
            </div>
            <button
              type="button"
              onClick={() => abrirWhatsapp(ag)}
              className="flex items-center gap-1.5 rounded-lg bg-brand-700 hover:bg-brand-600 text-white px-4 py-2 text-sm font-semibold transition-colors shrink-0"
            >
              <MessageCircle className="size-4" /> Abrir WhatsApp
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
