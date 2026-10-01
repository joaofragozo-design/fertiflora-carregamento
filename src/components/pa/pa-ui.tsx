'use client'

/*
  Pá Carregadeira — "Painel de senha" (direção A, 2026-10-01; comp em
  .impeccable/mocks/pa-carregadeira/A-painel-senha.png).
  THESIS: a pá é um painel de senha de atendimento — a carga da vez aparece
  enorme, legível a 1 m no sol; a fila vem embaixo, menor. Recusa o
  "dashboard de cards iguais" que tinha antes.
  OWN-WORLD: sistema legado verde-militar (fundo oliva quase-preto, superfície
  industrial-100, verde Fertiflora só na ação da vez), Outfit no nome da
  matéria-prima, mono só no número, barra de conchas segmentada = 1 casa por
  concha (dado real, não enfeite).
  STORY: Richardson (tablet deitado) escolhe matéria-prima + conchas, envia,
  libera da fila e vê o que está na pá; Reginaldo (celular em pé na cabine)
  vê a carga da vez, toca EXECUTAR CONCHA a cada concha e vê as próximas.
  FIRST VIEWPORT: tablet = teclado de matérias à esquerda (5/12) com conchas +
  enviar presos no rodapé; "Na pá agora" + fila à direita. Celular = selo de
  estado, nome gigante, contador 6,5rem, barra, botão de 120 px no polegar.
  FORM: estrutura nº 5 da lista ("painel de senha de atendimento"), seed
  02c4a64f (re-roll do 6f741309, cuja nº 7 — linha do tempo de rádio — falhava
  na leitura a distância de uma tarefa só); comp A aprovado pelo usuário.
*/

import { useEffect, useState } from 'react'
import { Trash2, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Carregamento } from '@/types'

/** Acima disso, uma casa por concha fica fina demais — vira barra contínua. */
const MAX_CASAS = 30

export function ConchaBar({ feitas, total, size = 'lg', className }: {
  feitas: number
  total: number
  size?: 'md' | 'lg' | 'xl'
  className?: string
}) {
  const h = size === 'xl' ? 'h-7' : size === 'lg' ? 'h-5' : 'h-3'
  const pct = total > 0 ? Math.min(100, Math.round((feitas / total) * 100)) : 0
  const aria = {
    role: 'progressbar' as const,
    'aria-valuemin': 0,
    'aria-valuemax': total,
    'aria-valuenow': feitas,
    'aria-label': `${feitas} de ${total} conchas`,
  }

  if (total > MAX_CASAS) {
    return (
      <div {...aria} className={cn('w-full overflow-hidden rounded-md bg-industrial-50 ring-2 ring-inset ring-industrial-400', h, className)}>
        <div className="h-full rounded-md bg-brand-500 transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </div>
    )
  }

  return (
    <div {...aria} className={cn('flex w-full gap-1', h, className)}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cn(
            'h-full flex-1 rounded-[3px] transition-colors duration-300',
            i < feitas ? 'bg-brand-500' : 'bg-industrial-50 ring-2 ring-inset ring-industrial-400',
          )}
        />
      ))}
    </div>
  )
}

/** Re-renderiza a cada 30 s pra "há X min" não congelar no tablet fixo. */
function useAgora(ms = 30_000) {
  const [, set] = useState(0)
  useEffect(() => {
    const t = setInterval(() => set((n) => n + 1), ms)
    return () => clearInterval(t)
  }, [ms])
}

export function tempoRelativo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60)    return 'agora'
  if (s < 3600)  return `há ${Math.floor(s / 60)} min`
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`
  return `há ${Math.floor(s / 86400)} d`
}

export function horaCurta(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

/** Ordem de chegada (a mais antiga primeiro). */
export function porChegada(a: Carregamento, b: Carregamento): number {
  return a.created_at.localeCompare(b.created_at)
}

/** Nome da matéria-prima encolhe com o comprimento pra nunca quebrar no meio. */
export function tamanhoInsumo(nome: string, escala: 'painel' | 'celular'): string {
  const n = nome.length
  if (escala === 'celular') {
    if (n <= 6)  return 'text-[4.25rem]'
    if (n <= 9)  return 'text-[3.25rem]'
    if (n <= 12) return 'text-[2.5rem]'
    return 'text-3xl'
  }
  if (n <= 6)  return 'text-6xl'
  if (n <= 10) return 'text-5xl'
  return 'text-4xl'
}

/** "Na pá agora": a carga liberada da vez, enorme. Vazio = pá livre. */
export function NaPaAgora({ liberados, vazio, loadingId, onCancelar }: {
  liberados: Carregamento[]
  vazio: string
  loadingId?: string | null
  onCancelar?: (i: Carregamento) => void
}) {
  useAgora()
  const [atual, ...outros] = [...liberados].sort(porChegada)

  return (
    <section
      aria-label="Na pá agora"
      className={cn(
        'rounded-2xl border bg-industrial-100 p-5 md:p-6',
        atual ? 'border-brand-500/60' : 'border-industrial-200',
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-sm font-bold uppercase tracking-[0.14em] text-industrial-600">Na pá agora</h2>
        {atual && (
          <span className="flex items-center gap-2 text-xs font-semibold text-brand-300">
            <span className="size-2 animate-pulse rounded-full bg-brand-500" />
            liberado {tempoRelativo(atual.started_at ?? atual.created_at)}
          </span>
        )}
      </div>

      {atual ? (
        <>
          <p className={cn('mt-3 break-words font-display font-bold leading-none tracking-tight text-industrial-900', tamanhoInsumo(atual.insumo, 'painel'))}>
            {atual.insumo}
          </p>
          <p className="mt-4 flex items-baseline gap-2 font-mono">
            <span className="text-6xl font-bold leading-none text-brand-300">{String(atual.conchas_executadas ?? 0).padStart(2, '0')}</span>
            <span className="text-3xl font-semibold text-industrial-600">/{atual.quantidade}</span>
            <span className="ml-1 font-sans text-base text-industrial-600">{atual.quantidade === 1 ? 'concha' : 'conchas'}</span>
          </p>
          <ConchaBar feitas={atual.conchas_executadas ?? 0} total={atual.quantidade} size="lg" className="mt-4" />
          {onCancelar && (
            <div className="mt-4 flex flex-wrap gap-2">
              {[atual, ...outros].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  disabled={loadingId === item.id}
                  onClick={() => {
                    if (window.confirm(`Cancelar a descarga de ${item.insumo} já liberada (${item.conchas_executadas ?? 0}/${item.quantidade} conchas)?`)) onCancelar(item)
                  }}
                  className="flex min-h-11 items-center gap-2 rounded-xl border border-danger-400/40 px-4 text-sm font-semibold text-danger-400 transition-colors hover:border-danger-400 hover:bg-danger-400/10 disabled:opacity-40"
                >
                  <Trash2 className="size-4" />
                  Cancelar descarga{outros.length > 0 ? ` de ${item.insumo}` : ''}
                </button>
              ))}
            </div>
          )}
          {outros.length > 0 && (
            <p className="mt-4 text-sm text-industrial-600">
              Também liberado: {outros.map((o) => `${o.insumo} (${o.conchas_executadas ?? 0}/${o.quantidade})`).join(' · ')}
            </p>
          )}
        </>
      ) : (
        <div className="py-8">
          <p className="font-display text-3xl font-bold text-industrial-700">Pá livre</p>
          <p className="mt-2 text-base text-industrial-600">{vazio}</p>
        </div>
      )}
    </section>
  )
}

/** Linha da fila (aguardando liberação). Sem ações = só leitura (visão admin da pá). */
export function FilaLinha({ item, posicao, loading, onLiberar, onCancelar }: {
  item: Carregamento
  posicao: number
  loading?: boolean
  onLiberar?: (i: Carregamento) => void
  onCancelar?: (i: Carregamento) => void
}) {
  useAgora()
  return (
    <li className="flex items-center gap-4 rounded-xl border border-industrial-200 bg-industrial-50 px-4 py-3">
      <span className="w-6 shrink-0 text-center font-mono text-sm font-bold text-industrial-500" aria-label={`Posição ${posicao}`}>
        {posicao}
      </span>
      <div className="min-w-0 flex-1">
        <p className="break-words font-display text-2xl font-bold leading-tight text-industrial-900">{item.insumo}</p>
        <p className="text-sm text-industrial-600">
          <span className="font-mono font-semibold text-industrial-800">{item.quantidade}</span> {item.quantidade === 1 ? 'concha' : 'conchas'} · {tempoRelativo(item.created_at)}
        </p>
      </div>
      {onCancelar && (
        <button
          type="button"
          disabled={loading}
          onClick={() => { if (window.confirm(`Cancelar a solicitação de ${item.insumo}?`)) onCancelar(item) }}
          title="Cancelar solicitação"
          aria-label={`Cancelar ${item.insumo}`}
          className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-danger-400/40 text-danger-400 transition-colors hover:border-danger-400 hover:bg-danger-400/10 disabled:opacity-40"
        >
          <Trash2 className="size-5" />
        </button>
      )}
      {onLiberar && (
        <button
          type="button"
          disabled={loading}
          onClick={() => onLiberar(item)}
          className="flex h-14 shrink-0 items-center gap-2 rounded-xl bg-brand-600 px-5 font-display text-lg font-bold uppercase tracking-wide text-white transition-colors hover:bg-brand-500 active:bg-brand-700 disabled:opacity-50"
        >
          <Zap className="size-5" />
          {loading ? 'Liberando…' : 'Liberar'}
        </button>
      )}
    </li>
  )
}

/** Hora se for hoje; "dd/mm hh:mm" se for de outro dia. */
export function quando(iso: string): string {
  const d = new Date(iso)
  if (d.toDateString() === new Date().toDateString()) return horaCurta(iso)
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${horaCurta(iso)}`
}
