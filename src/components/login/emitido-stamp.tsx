'use client'

import { Stamp } from '@/components/ui/stamp'
import { useTicketPrinted } from './login-scene'

/** Carimbo EMITIDO da 1ª via — só bate no papel depois que a impressora termina de soltar a via. */
export function EmitidoStamp() {
  const printed = useTicketPrinted()
  if (!printed) return null
  return (
    <div className="pointer-events-none absolute bottom-3 right-10">
      {/* "liberado" só pela cor: é o verde fosco de carimbo, não um status de carga. */}
      <Stamp variant="liberado" lines={['Emitido']} rotate={-7} slamOnMount />
    </div>
  )
}
