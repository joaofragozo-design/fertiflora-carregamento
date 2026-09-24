import { type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

/** Título de página — mesmo vocabulário do `CardTitle`, um nível acima.
 *  `text-fluid-title` cresce sutilmente com a viewport (18px→22px) em vez de
 *  pular de tamanho num breakpoint fixo. */
export function PageTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h1
      className={cn('font-display tracking-tight text-fluid-title font-semibold text-industrial-900', className)}
      {...props}
    />
  )
}
