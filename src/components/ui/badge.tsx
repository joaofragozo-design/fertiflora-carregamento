import { type HTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default:  'border-industrial-300 bg-industrial-200 text-industrial-700',
        success:  'border-brand-500/30 bg-brand-500/10 text-brand-300',
        warning:  'border-warning-500/30 bg-warning-500/10 text-warning-400',
        danger:   'border-danger-500/30 bg-danger-500/10 text-danger-400',
        info:     'border-info-500/30 bg-info-500/10 text-info-400',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>['variant']>

interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}
