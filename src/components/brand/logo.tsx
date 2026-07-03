import Image from 'next/image'

interface LogoMarkProps {
  size?: number
  className?: string
}

/** Ícone isolado — usa a logo completa em proporção quadrada */
export function LogoMark({ size = 32, className }: LogoMarkProps) {
  const width = Math.round(size * 3.3)
  return (
    <Image
      src="/fertiflora-logo.png"
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

/** Logo completo */
export function LogoFull({ className, showTagline: _showTagline = true }: LogoFullProps) {
  return (
    <div className={`flex items-center ${className ?? ''}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/fertiflora-logo.png"
        alt="Fertiflora"
        style={{ height: 60, width: 'auto', objectFit: 'contain' }}
      />
    </div>
  )
}
