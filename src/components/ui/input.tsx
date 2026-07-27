import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string
  label?: string
  hint?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, label, hint, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-industrial-800">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'h-10 w-full rounded-md border bg-industrial-100 px-3 text-sm text-industrial-900 placeholder:text-industrial-500',
            'transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-industrial-100',
            error
              ? 'border-danger-500 focus:ring-danger-500'
              : 'border-industrial-300 hover:border-industrial-400',
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-danger-400">{error}</p>}
        {!error && hint && <p className="text-xs text-industrial-600">{hint}</p>}
      </div>
    )
  }
)

Input.displayName = 'Input'
