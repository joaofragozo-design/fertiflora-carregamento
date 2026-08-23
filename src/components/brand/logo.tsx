import Image from 'next/image'

const MARK_ASPECT_RATIO = 289 / 366

interface LogoMarkProps {
  size?: number
  className?: string
}

/** Ícone isolado — folha da marca em verde-claro (mesma folha recolorida do
 * lockup, no padrão da identidade compartilhada com o Trilho STO) */
export function LogoMark({ size = 32, className }: LogoMarkProps) {
  const width = Math.round(size * MARK_ASPECT_RATIO)
  return (
    <Image
      src="/fertiflora-mark-verde.png"
      alt="Fertiflora"
      width={width}
      height={size}
      className={className}
      style={{ objectFit: 'contain', width, height: size }}
      priority
    />
  )
}

interface LogoFullProps {
  className?: string
  showTagline?: boolean
}

/** Logo completo — folha + nome do app, como no shell do Trilho STO */
export function LogoFull({ className, showTagline: _showTagline = true }: LogoFullProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className ?? ''}`}>
      <LogoMark size={28} />
      <span className="font-display text-lg font-semibold tracking-tight text-industrial-950">
        FertiLog
      </span>
    </div>
  )
}
