import { forwardRef, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string
  label?: string
  hint?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, label, hint, id, ...props }, ref) => {
    const textareaId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={textareaId} className="text-sm font-medium text-industrial-200">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={cn(
            'min-h-[80px] w-full rounded-md border bg-industrial-900 px-3 py-2 text-sm text-industrial-100 placeholder:text-industrial-500 resize-y',
            'transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-industrial-900',
            error
              ? 'border-danger-500 focus:ring-danger-500'
              : 'border-industrial-700 hover:border-industrial-600',
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-danger-400">{error}</p>}
        {!error && hint && <p className="text-xs text-industrial-400">{hint}</p>}
      </div>
    )
  }
)

Textarea.displayName = 'Textarea'
