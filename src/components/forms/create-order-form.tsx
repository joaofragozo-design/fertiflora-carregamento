'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Send, Pin, PinOff, EyeOff, RotateCcw, ChevronDown, ChevronUp, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { OrdemService } from '@/services/ordem.service'
import { createClient } from '@/lib/supabase/client'
import { INSUMOS_FIXOS } from '@/constants/order'
import { useInsumoPrefs } from '@/hooks/use-insumo-prefs'
import type { AppUser, Carregamento } from '@/types'

const QUANTIDADES = [1, 2, 3] as const

interface CreateOrderFormProps {
  user: AppUser
  onCreated?: (item: Carregamento) => void
}

export function CreateOrderForm({ user, onCreated }: CreateOrderFormProps) {
  const { prefs, pin, unpin, hide, restore, addCustom, resetAll } = useInsumoPrefs(user.id)

  // Insumo
  const [insumo,       setInsumo]       = useState('')
  const [manual,       setManual]       = useState(false)
  const [manualValue,  setManualValue]  = useState('')
  const [manualSaved,  setManualSaved]  = useState<boolean | null>(null)
  const [showOcultos,  setShowOcultos]  = useState(false)
  const [erroInsumo,   setErroInsumo]   = useState('')

  // Pedido
  const [quantidade, setQuantidade] = useState<number | null>(null)
  const [erroQtd,    setErroQtd]    = useState('')
  const [loading,    setLoading]    = useState(false)

  const manualRef = useRef<HTMLInputElement>(null)

  const insumoFinal = manual ? manualValue.trim() : insumo
  const pronto      = insumoFinal.length >= 2 && quantidade !== null

  // Listas derivadas — custom > INSUMOS_FIXOS, sem duplicatas
  const baseList    = [...new Set([...prefs.custom, ...INSUMOS_FIXOS])]
  const pinnedList  = baseList.filter((n) =>  prefs.pinned.includes(n))
  const normalList  = baseList.filter((n) => !prefs.pinned.includes(n) && !prefs.hidden.includes(n))
  const hiddenList  = baseList.filter((n) =>  prefs.hidden.includes(n))

  const isPinned     = !!insumo && prefs.pinned.includes(insumo)
  const showActions  = !!insumo && !manual

  // ── Handlers ────────────────────────────────────────────────────
  function selecionarInsumo(nome: string) {
    setManual(false)
    setManualValue('')
    setManualSaved(null)
    setInsumo(nome)
    setErroInsumo('')
  }

  function abrirManual() {
    setManual(true)
    setInsumo('')
    setManualSaved(null)
    setErroInsumo('')
    setTimeout(() => manualRef.current?.focus(), 50)
  }

  function handleManualPin() {
    const name = manualValue.trim()
    if (name.length < 2) return
    addCustom(name, true)
    setManualSaved(true)
    toast.success(`"${name}" fixado como atalho.`)
  }

  function handleManualSkip() {
    setManualSaved(false)
  }

  async function enviar() {
    if (insumoFinal.length < 2) {
      setErroInsumo('Selecione ou digite a matéria prima.')
      return
    }
    if (quantidade === null) {
      setErroQtd('Selecione a quantidade.')
      return
    }

    setLoading(true)
    try {
      const item = await new OrdemService(createClient()).criar({ insumo: insumoFinal, quantidade })
      toast.success(`Solicitação enviada: ${insumoFinal} — ${quantidade} conchas`)
      setInsumo('')
      setManual(false)
      setManualValue('')
      setManualSaved(null)
      setQuantidade(null)
      onCreated?.(item)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar solicitação.')
    } finally {
      setLoading(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* ── Cabeçalho da seção Insumo ──────────────────────────── */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold uppercase tracking-wider text-industrial-600">
          Matéria-prima
        </p>
        <button
          type="button"
          onClick={() => {
            resetAll()
            setInsumo('')
            setManual(false)
            setManualValue('')
            setManualSaved(null)
          }}
          title="Restaurar estado padrão de todas as matérias primas"
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-industrial-400 transition-colors hover:bg-industrial-200 hover:text-industrial-600"
        >
          <RotateCcw className="h-3 w-3" />
          Restaurar padrão
        </button>
      </div>

      {/* ── Teclado de matérias-primas (fixados primeiro) ─────── */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-2">
        {[...pinnedList, ...normalList].map((nome) => (
          <InsumoChip
            key={nome}
            nome={nome}
            selected={insumo === nome && !manual}
            variant={prefs.pinned.includes(nome) ? 'pinned' : 'normal'}
            onClick={() => selecionarInsumo(nome)}
          />
        ))}

        <button
          type="button"
          onClick={abrirManual}
          aria-pressed={manual}
          className={cn(
            'flex min-h-[3.75rem] items-center justify-center gap-2 rounded-xl border-2 px-2 font-display text-base font-bold transition-colors active:scale-[0.97]',
            manual
              ? 'border-brand-500 bg-brand-500/15 text-brand-300'
              : 'border-dashed border-industrial-400 text-industrial-600 hover:border-industrial-600 hover:text-industrial-900'
          )}
        >
          <Plus className="size-5" />
          Outro
        </button>
      </div>

      {/* ── Barra de ações (insumo do grid selecionado) ─────────── */}
      {showActions && (
        <div className="flex items-center gap-2 rounded-lg border-2 border-industrial-300 bg-industrial-100 px-3 py-2">
          <span className="mr-1 text-xs text-industrial-400 shrink-0">Ações:</span>
          {isPinned ? (
            <ActionChip icon={PinOff} label="Desfixar"  onClick={() => unpin(insumo)} />
          ) : (
            <ActionChip icon={Pin}    label="Fixar ⭐"  onClick={() => pin(insumo)} />
          )}
          <ActionChip
            icon={EyeOff}
            label="Ocultar"
            onClick={() => { hide(insumo); setInsumo('') }}
          />
        </div>
      )}

      {erroInsumo && <p className="text-xs text-danger-400">{erroInsumo}</p>}

      {/* ── Input manual ───────────────────────────────────────── */}
      {manual && (
        <div className="space-y-2.5">
          <input
            ref={manualRef}
            value={manualValue}
            onChange={(e) => {
              setManualValue(e.target.value)
              setErroInsumo('')
              setManualSaved(null)
            }}
            placeholder="Digite o nome da matéria prima..."
            autoComplete="off"
            className="w-full rounded-lg border border-industrial-300 bg-industrial-100 px-3 py-2 text-sm text-industrial-900 placeholder:text-industrial-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500/30"
          />

          {/* Prompt: salvar como atalho? */}
          {manualValue.trim().length >= 2 && manualSaved === null && (
            <div className="flex items-center gap-2 rounded-lg border border-industrial-300 bg-industrial-100/50 px-3 py-2.5">
              <span className="shrink-0 text-xs text-industrial-500">Salvar atalho?</span>
              <button
                type="button"
                onClick={handleManualPin}
                className="flex items-center gap-1 rounded-md border border-yellow-600/40 bg-yellow-600/10 px-2.5 py-1 text-xs font-semibold text-amber-400 transition-colors hover:bg-yellow-600/20"
              >
                ⭐ Fixar
              </button>
              <button
                type="button"
                onClick={handleManualSkip}
                className="flex items-center gap-1 rounded-md border border-industrial-300 bg-industrial-100 px-2.5 py-1 text-xs font-semibold text-industrial-600 transition-colors hover:text-industrial-800"
              >
                ✕ Só agora
              </button>
            </div>
          )}

          {manualSaved === true && (
            <p className="text-xs text-amber-400">
              ⭐ &ldquo;{manualValue.trim()}&rdquo; fixado. Aparecerá no topo da lista.
            </p>
          )}
        </div>
      )}

      {/* ── Ocultos ────────────────────────────────────────────── */}
      {hiddenList.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowOcultos((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-industrial-400 transition-colors hover:text-industrial-600"
          >
            {showOcultos ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            Ocultos ({hiddenList.length})
          </button>

          {showOcultos && (
            <div className="mt-2 flex flex-wrap gap-2">
              {hiddenList.map((nome) => (
                <button
                  key={nome}
                  type="button"
                  onClick={() => restore(nome)}
                  title="Restaurar matéria prima"
                  className="flex items-center gap-1.5 rounded-lg border border-industrial-300 bg-industrial-100 px-3 py-1.5 text-xs font-semibold text-industrial-500 transition-all hover:border-industrial-500 hover:text-industrial-800"
                >
                  {nome}
                  <span className="text-brand-500">↩</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Conchas + Enviar: presos no rodapé do cartão pra nunca sumirem no tablet ── */}
      <div className="sticky bottom-0 -mx-5 -mb-5 space-y-4 rounded-b-2xl border-t border-industrial-200 bg-industrial-100 px-5 pb-5 pt-4 md:-mx-6 md:-mb-6 md:px-6 md:pb-6">
      <div>
        <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-industrial-600">
          Conchas
        </p>

        <div className="grid grid-cols-3 gap-3">
          {QUANTIDADES.map((qtd) => (
            <button
              key={qtd}
              type="button"
              onClick={() => { setQuantidade(qtd); setErroQtd('') }}
              aria-pressed={quantidade === qtd}
              className={cn(
                'flex h-20 flex-col items-center justify-center rounded-xl border-2 transition-colors select-none active:scale-[0.97]',
                quantidade === qtd
                  ? 'border-brand-400 bg-brand-500/15 text-brand-200'
                  : 'border-industrial-300 text-industrial-800 hover:border-industrial-600 hover:text-industrial-900'
              )}
            >
              <span className="font-mono text-4xl font-bold leading-none">{qtd}</span>
              <span className={cn('mt-1 text-sm', quantidade === qtd ? 'text-brand-200/85' : 'text-industrial-600')}>{qtd === 1 ? 'concha' : 'conchas'}</span>
            </button>
          ))}
        </div>

        {erroQtd && <p className="mt-1.5 text-xs text-danger-400">{erroQtd}</p>}
      </div>

      {/* ── Enviar ─────────────────────────────────────────────── */}
      <button
        type="button"
        disabled={!pronto || loading}
        onClick={enviar}
        className={cn(
          'flex min-h-[4.5rem] w-full items-center justify-center gap-3 rounded-xl px-4 py-3 font-display text-xl font-bold uppercase tracking-wide transition-colors active:scale-[0.99]',
          pronto && !loading
            ? 'bg-brand-600 text-white hover:bg-brand-500 active:bg-brand-700'
            : 'border-2 border-industrial-300 text-industrial-500 cursor-not-allowed'
        )}
      >
        {loading ? (
          <span className="animate-pulse">Enviando…</span>
        ) : (
          <>
            <Send className="size-6 shrink-0" />
            <span className="flex flex-col items-start leading-tight">
              Enviar solicitação
              {pronto && (
                <span className="font-sans text-sm font-semibold normal-case tracking-normal text-white/85">
                  {insumoFinal} · {quantidade} {quantidade === 1 ? 'concha' : 'conchas'}
                </span>
              )}
            </span>
          </>
        )}
      </button>
      </div>
    </div>
  )
}

// ── Componentes auxiliares ────────────────────────────────────────

function InsumoChip({ nome, selected, variant, onClick }: {
  nome:     string
  selected: boolean
  variant:  'pinned' | 'normal'
  onClick:  () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'relative flex min-h-[3.75rem] items-center justify-center break-words rounded-xl border-2 px-2 text-center font-display font-bold leading-tight transition-colors active:scale-[0.97]',
        nome.length > 8 ? 'text-sm' : 'text-base',
        selected
          ? 'border-brand-400 bg-brand-500/15 text-brand-200'
          : 'border-industrial-300 text-industrial-800 hover:border-industrial-600 hover:text-industrial-900'
      )}
    >
      {variant === 'pinned' && (
        <Star className="absolute right-2 top-2 size-3.5 fill-yellow-400 text-yellow-400" aria-label="Fixado" />
      )}
      {nome}
    </button>
  )
}

function ActionChip({ icon: Icon, label, onClick }: {
  icon:    React.ElementType
  label:   string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-md border-2 border-industrial-300 px-2.5 py-1 text-xs font-semibold text-industrial-600 transition-all hover:border-industrial-600 hover:bg-industrial-100 hover:text-industrial-900"
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
  )
}
