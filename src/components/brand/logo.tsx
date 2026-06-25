'use client'

interface LogoMarkProps {
  size?: number
  className?: string
}

/** Marca visual da Fertiflora — folha com setas circulares */
export function LogoMark({ size = 32, className }: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Arco externo esquerdo */}
      <path
        d="M8 20 A14 14 0 0 1 20 6"
        stroke="#6BBF6A"
        strokeWidth="3.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* Arco externo direito */}
      <path
        d="M20 6 A14 14 0 0 1 32 20"
        stroke="#3DA86E"
        strokeWidth="3.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* Folha central */}
      <path
        d="M20 34 C14 28 10 22 12 16 C14 10 20 8 20 8 C20 8 26 10 28 16 C30 22 26 28 20 34Z"
        fill="#0D7A5F"
      />
      {/* Nervura central da folha */}
      <path
        d="M20 32 L20 14"
        stroke="#6BBF6A"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.6"
      />
      {/* Ponta inferior da folha */}
      <path
        d="M20 34 L19 37 L20 36 L21 37 Z"
        fill="#0D7A5F"
      />
    </svg>
  )
}

interface LogoFullProps {
  className?: string
  showTagline?: boolean
}

/** Logo completo — ícone + nome */
export function LogoFull({ className, showTagline = true }: LogoFullProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className ?? ''}`}>
      <LogoMark size={34} />
      <div>
        <p className="text-sm font-black tracking-[0.12em] text-industrial-100 leading-none">
          FERTIFLORA
        </p>
        {showTagline && (
          <p className="text-[10px] font-medium tracking-wider text-[#6BBF6A] leading-none mt-0.5">
            organomineral
          </p>
        )}
      </div>
    </div>
  )
}
