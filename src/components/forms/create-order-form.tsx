'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { PenLine, Send, Pin, PinOff, EyeOff, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react'
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
      setErroInsumo('Selecione ou digite o insumo.')
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
    <div className="space-y-5">

      {/* ── Cabeçalho da seção Insumo ──────────────────────────── */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-industrial-500">
          Insumo
          {insumoFinal && (
            <span className="ml-2 normal-case font-bold text-brand-700">{insumoFinal}</span>
          )}
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
          title="Restaurar estado padrão de todos os insumos"
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-industrial-600 transition-colors hover:bg-industrial-800 hover:text-industrial-400"
        >
          <RotateCcw className="h-3 w-3" />
          Restaurar padrão
        </button>
      </div>

      {/* ── Fixados ────────────────────────────────────────────── */}
      {pinnedList.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-yellow-600/60">
            ⭐ Fixados
          </p>
          <div className="flex flex-wrap gap-2">
            {pinnedList.map((nome) => (
              <InsumoChip
                key={nome}
                nome={nome}
                selected={insumo === nome && !manual}
                variant="pinned"
                onClick={() => selecionarInsumo(nome)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Grid normal ────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {normalList.map((nome) => (
          <InsumoChip
            key={nome}
            nome={nome}
            selected={insumo === nome && !manual}
            variant="normal"
            onClick={() => selecionarInsumo(nome)}
          />
        ))}

        <button
          type="button"
          onClick={abrirManual}
          className={cn(
            'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold transition-all',
            manual
              ? 'border-2 border-brand-500 text-brand-700'
              : 'border-2 border-dashed border-industrial-600 text-industrial-500 hover:border-industrial-400 hover:text-industrial-100'
          )}
        >
          <PenLine className="h-3.5 w-3.5" />
          Outro
        </button>
      </div>

      {/* ── Barra de ações (insumo do grid selecionado) ─────────── */}
      {showActions && (
        <div className="flex items-center gap-2 rounded-lg border-2 border-industrial-700 bg-industrial-900 px-3 py-2">
          <span className="mr-1 text-xs text-industrial-600 shrink-0">Ações:</span>
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
            placeholder="Digite o nome do insumo..."
            autoComplete="off"
            className="w-full rounded-lg border border-industrial-700 bg-industrial-900 px-3 py-2 text-sm text-industrial-100 placeholder:text-industrial-600 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500/30"
          />

          {/* Prompt: salvar como atalho? */}
          {manualValue.trim().length >= 2 && manualSaved === null && (
            <div className="flex items-center gap-2 rounded-lg border border-industrial-700 bg-industrial-900/50 px-3 py-2.5">
              <span className="shrink-0 text-xs text-industrial-500">Salvar atalho?</span>
              <button
                type="button"
                onClick={handleManualPin}
                className="flex items-center gap-1 rounded-md border border-yellow-600/40 bg-yellow-600/10 px-2.5 py-1 text-xs font-semibold text-amber-700 transition-colors hover:bg-yellow-600/20"
              >
                ⭐ Fixar
              </button>
              <button
                type="button"
                onClick={handleManualSkip}
                className="flex items-center gap-1 rounded-md border border-industrial-700 bg-industrial-900 px-2.5 py-1 text-xs font-semibold text-industrial-400 transition-colors hover:text-industrial-200"
              >
                ✕ Só agora
              </button>
            </div>
          )}

          {manualSaved === true && (
            <p className="text-xs text-amber-700">
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
            className="flex items-center gap-1.5 text-xs text-industrial-600 transition-colors hover:text-industrial-400"
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
                  title="Restaurar insumo"
                  className="flex items-center gap-1.5 rounded-lg border border-industrial-700 bg-industrial-900 px-3 py-1.5 text-xs font-semibold text-industrial-500 transition-all hover:border-industrial-500 hover:text-industrial-200"
                >
                  {nome}
                  <span className="text-brand-500">↩</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Conchas ────────────────────────────────────────────── */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-industrial-500">
          Conchas
          {quantidade !== null && (
            <span className="ml-2 normal-case font-bold text-brand-700">{quantidade} conchas</span>
          )}
        </p>

        <div className="grid grid-cols-3 gap-3">
          {QUANTIDADES.map((qtd) => (
            <button
              key={qtd}
              type="button"
              onClick={() => { setQuantidade(qtd); setErroQtd('') }}
              className={cn(
                'flex h-20 items-center justify-center rounded-2xl border-2 text-4xl font-black transition-all select-none active:scale-95',
                quantidade === qtd
                  ? 'border-2 border-brand-600 bg-brand-600 text-white'
                  : 'border-2 border-industrial-700 bg-transparent text-industrial-400 hover:border-industrial-400 hover:text-industrial-100'
              )}
            >
              {qtd}
            </button>
          ))}
        </div>

        {erroQtd && <p className="mt-1.5 text-xs text-danger-400">{erroQtd}</p>}
      </div>

      {/* ── Preview ────────────────────────────────────────────── */}
      {insumoFinal && quantidade !== null && (
        <div className="rounded-xl border border-brand-500/30 bg-brand-500/5 px-4 py-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-brand-700">
            Solicitação
          </p>
          <p className="text-base font-bold text-industrial-100">
            {insumoFinal}
            <span className="ml-3 text-brand-600">{quantidade} conchas</span>
          </p>
        </div>
      )}

      {/* ── Enviar ─────────────────────────────────────────────── */}
      <button
        type="button"
        disabled={!pronto || loading}
        onClick={enviar}
        className={cn(
          'w-full flex items-center justify-center gap-3 rounded-2xl py-5 text-lg font-black uppercase tracking-wider transition-all active:scale-[0.98]',
          pronto && !loading
            ? 'border-2 border-brand-600 bg-brand-600 text-white hover:bg-brand-500 hover:border-brand-500 cursor-pointer'
            : 'border-2 border-industrial-700 bg-transparent text-industrial-600 cursor-not-allowed'
        )}
      >
        {loading ? (
          <span className="animate-pulse">Enviando...</span>
        ) : (
          <>
            <Send className="h-5 w-5" />
            Enviar Solicitação
          </>
        )}
      </button>
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
      className={cn(
        'rounded-lg border-2 px-3 py-1.5 text-sm font-semibold transition-all active:scale-95',
        selected && variant === 'pinned'
          ? 'border-yellow-500 bg-yellow-50 text-yellow-800'
          : selected
          ? 'border-brand-600 bg-brand-600 text-white'
          : variant === 'pinned'
          ? 'border-yellow-400 bg-yellow-50 text-yellow-700 hover:border-yellow-500 hover:text-yellow-800'
          : 'border-industrial-700 bg-transparent text-industrial-400 hover:border-industrial-400 hover:text-industrial-100'
      )}
    >
      {variant === 'pinned' && <span className="mr-1">⭐</span>}
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
      className="flex items-center gap-1.5 rounded-md border-2 border-industrial-700 px-2.5 py-1 text-xs font-semibold text-industrial-400 transition-all hover:border-industrial-400 hover:bg-industrial-900 hover:text-industrial-100"
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
  )
}
