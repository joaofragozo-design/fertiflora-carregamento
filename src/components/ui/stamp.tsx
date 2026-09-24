import type { CSSProperties } from 'react'
import { AnimatePresence, motion, useReducedMotion, type HTMLMotionProps } from 'motion/react'
import { cn } from '@/lib/utils'

export type StampVariant = 'solicitado' | 'enviado' | 'liberado' | 'confirmado'

const STAMP_COLOR: Record<StampVariant, string> = {
  solicitado: 'text-stamp-solicitado',
  enviado:    'text-stamp-enviado',
  liberado:   'text-stamp-liberado',
  confirmado: 'text-stamp-confirmado',
}

interface StampProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  variant: StampVariant
  /** Uma linha ("Liberado") ou duas ("Enviado" / "Transportadora"). */
  lines: [string] | [string, string]
  /** Graus de rotação — varia por carimbo pra não ficar todo mundo alinhado igual. */
  rotate?: number
  /** Bate também ao montar (padrão: só quando o `variant` muda, pra não animar no load da página). */
  slamOnMount?: boolean
}

/**
 * Carimbo de borracha de status — só faz sentido sobre a superfície clara do
 * Ticket. Ao trocar de `variant` (ex.: enviado → confirmado), bate na tela
 * como um carimbo de verdade sendo carimbado — não é decoração solta, é o
 * próprio evento de mudança de status ficando visível. Respeita
 * prefers-reduced-motion (troca sem física de mola, só corta pro estado final).
 */
export function Stamp({ variant, lines, rotate = -5, slamOnMount = false, className, ...props }: StampProps) {
  const multiline = lines.length > 1
  const reduceMotion = useReducedMotion()

  return (
    <AnimatePresence mode="wait" initial={slamOnMount}>
      <motion.div
        key={variant}
        className={cn('stamp', multiline ? 'stamp-2l' : 'stamp-1l', STAMP_COLOR[variant], className)}
        style={{ '--rot': `${rotate}deg` } as CSSProperties}
        initial={reduceMotion ? false : { opacity: 0, scale: 2.2, rotate: rotate - 22 }}
        animate={{ opacity: 0.94, scale: 1, rotate }}
        exit={reduceMotion ? undefined : { opacity: 0, transition: { duration: 0.1 } }}
        transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 700, damping: 12, mass: 0.8 }}
        {...props}
      >
        {multiline ? lines.map((l) => <span key={l}>{l}</span>) : lines[0]}
      </motion.div>
    </AnimatePresence>
  )
}
