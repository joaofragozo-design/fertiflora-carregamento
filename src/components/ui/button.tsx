import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-industrial-900 disabled:pointer-events-none disabled:opacity-40 active:scale-[0.98]',
  {
    variants: {
      variant: {
        primary:
          'bg-brand-600 text-white hover:bg-brand-500 shadow-sm',
        secondary:
          'bg-industrial-700 text-industrial-100 hover:bg-industrial-600 border border-industrial-600',
        danger:
          'bg-danger-600 text-white hover:bg-danger-500 shadow-sm',
        warning:
          'bg-warning-500 text-white hover:bg-warning-400 shadow-sm',
        ghost:
          'text-industrial-300 hover:bg-industrial-800 hover:text-industrial-100',
        outline:
          'border border-industrial-600 text-industrial-200 hover:bg-industrial-800 hover:border-industrial-500',
      },
      size: {
        sm:   'h-8  px-3   text-xs',
        md:   'h-10 px-4   text-sm',
        lg:   'h-12 px-6   text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
)

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  )
)

Button.displayName = 'Button'
