import { forwardRef, type HTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface TicketProps extends HTMLAttributes<HTMLDivElement> {
  /** Número de sequência real (ex.: ordem de carregamento) — mostrado no canto
   *  como "Nº 000206". Se `seqHref` vier junto, o número vira link (PDF etc). */
  seq?: string
  seqHref?: string
  seqTitle?: string
  /**
   * `canhoto` (padrão): topo em ziguezague + furo de picote — a ficha destacada
   * de cada carga. `continuo`: página inteira de formulário contínuo, rasgo
   * reto irregular e furos de tracionamento nas duas bordas — a via que acabou
   * de sair da impressora da balança (login).
   */
  variant?: 'canhoto' | 'continuo'
}

/**
 * Canhoto de ficha de balança — a superfície de cada carga/login no sistema
 * "Ficha de Balança" (ver DESIGN.md). Topo rasgado em ziguezague, furo de
 * picote e número de sequência real (nunca inventado — vazio se não existir).
 */
export const Ticket = forwardRef<HTMLDivElement, TicketProps>(
  ({ seq, seqHref, seqTitle, variant = 'canhoto', className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('ticket-shell group px-5 pb-4 pt-[30px]', variant === 'continuo' && 'ticket-continuo', className)}
      {...props}
    >
      <span className="ticket-punch" aria-hidden="true" />
      {seq && (
        seqHref ? (
          <a href={seqHref} title={seqTitle} target="_blank" rel="noopener noreferrer"
            className="ticket-seq hover:text-ticket-ink hover:underline">
            {seq}
          </a>
        ) : (
          <span className="ticket-seq" title={seqTitle}>{seq}</span>
        )
      )}
      {children}
    </div>
  ),
)
Ticket.displayName = 'Ticket'

export function TicketRule({ className }: { className?: string }) {
  return <div className={cn('ticket-rule', className)} />
}

export function TicketLabel({ children }: { children: ReactNode }) {
  return <span className="block text-[10px] tracking-[.09em] uppercase text-ticket-soft">{children}</span>
}
