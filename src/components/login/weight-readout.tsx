'use client'

import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'

/** Fita 0-9 repetida: cada algarismo dá voltas inteiras antes de parar no valor
 *  final. Precisa caber `10 × voltas + 9` linhas — por isso as voltas têm teto. */
const FITA = Array.from({ length: 70 }, (_, i) => i % 10)
const VOLTAS_MAX = 5

interface WeightReadoutProps {
  /** Valor já formatado, ex.: "1.284,50". Só os dígitos rolam; separadores ficam parados. */
  value: string
  unit?: string
  /** Rótulo lido por leitores de tela (o visual é decorativo). */
  label: string
  /** Enquanto `false`, o contador fica zerado esperando (ex.: caminhão ainda entrando na balança). */
  iniciar?: boolean
  /** Chamado quando o último algarismo assenta (a balança "estabilizou"). */
  onSettled?: () => void
  className?: string
}

/**
 * Indicador do painel da balança: contador mecânico de placas (split-flap).
 * Quando `iniciar` vira true, os algarismos rolam do zero até o valor — os da
 * direita dão mais voltas e param por último, como num contador de verdade —
 * e o último a assentar avisa o pai. Com prefers-reduced-motion mostra o
 * valor final direto, sem rolagem nem desfoque.
 */
export function WeightReadout({ value, unit = 't', label, iniciar = true, onSettled, className }: WeightReadoutProps) {
  const reduceMotion = useReducedMotion()
  const chars = value.split('')
  const totalDigitos = chars.filter((c) => /\d/.test(c)).length
  const rodando = reduceMotion || iniciar
  let ordem = 0

  return (
    <div
      role="img"
      aria-label={`${label} ${value} ${unit === 't' ? 'toneladas' : unit}`}
      className={cn('flex items-baseline justify-center font-mono font-extrabold leading-none text-brand-400', className)}
      style={{ textShadow: '0 0 22px rgb(79 177 66 / 0.38)' }}
    >
      {chars.map((ch, i) => {
        if (!/\d/.test(ch)) {
          return (
            <span key={i} aria-hidden="true" className="px-[0.03em] -translate-y-[0.04em] text-brand-500">
              {ch}
            </span>
          )
        }
        const digito = Number(ch)
        const idx = ordem++
        const ultimo = idx === totalDigitos - 1
        const linhaFinal = 10 * Math.min(idx + 1, VOLTAS_MAX) + digito
        return (
          <span
            key={i}
            aria-hidden="true"
            className="relative mx-[0.03em] inline-block h-[1em] w-[0.7em] overflow-hidden rounded-[0.05em] bg-black/40 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.05)]"
          >
            <motion.span
              className="block will-change-transform"
              initial={reduceMotion ? false : { y: '0em', filter: 'blur(0px)' }}
              animate={
                rodando
                  ? { y: `-${linhaFinal}em`, filter: reduceMotion ? 'blur(0px)' : ['blur(0px)', 'blur(2.5px)', 'blur(0px)'] }
                  : { y: '0em', filter: 'blur(0px)' }
              }
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : { duration: 1.05 + idx * 0.14, ease: [0.18, 0.86, 0.22, 1], filter: { duration: 1.05 + idx * 0.14, times: [0, 0.2, 1] } }
              }
              onAnimationComplete={ultimo && rodando ? onSettled : undefined}
            >
              {FITA.map((n, linha) => (
                <span key={linha} className="flex h-[1em] items-center justify-center">
                  {n}
                </span>
              ))}
            </motion.span>
            {/* vinco central da placa do contador */}
            <span className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-black/60" />
          </span>
        )
      })}
      <span aria-hidden="true" className="ml-[0.14em] text-[0.42em] font-bold lowercase text-brand-500">
        {unit}
      </span>
    </div>
  )
}
