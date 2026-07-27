import Image from 'next/image'

const LOGO_ASPECT_RATIO = 1528 / 463
const MARK_ASPECT_RATIO = 330 / 463

interface LogoMarkProps {
  size?: number
  className?: string
}

/** Ícone isolado — folha da marca, recortada do lockup completo */
export function LogoMark({ size = 32, className }: LogoMarkProps) {
  const width = Math.round(size * MARK_ASPECT_RATIO)
  return (
    <Image
      src="/fertiflora-mark.png"
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
  const height = 60
  return (
    <div className={`flex items-center ${className ?? ''}`}>
      <Image
        src="/fertiflora-logo.png"
        alt="Fertiflora"
        width={Math.round(height * LOGO_ASPECT_RATIO)}
        height={height}
        style={{ height, width: 'auto', objectFit: 'contain' }}
        priority
      />
    </div>
  )
}
