'use client'

import { useEffect, useRef, useState } from 'react'
import { MapPin, CheckCircle2, LoaderCircle, TriangleAlert, Navigation, Radar, Square } from 'lucide-react'
import { FABRICA_COORDS } from '@/lib/geo'

type Estado =
  | { fase: 'idle' }
  | { fase: 'compartilhando'; distanciaMetros: number | null }
  | { fase: 'confirmando' }
  | { fase: 'sucesso'; distanciaMetros: number }
  | { fase: 'erro'; mensagem: string }

interface ChegadaClientProps {
  recebimentoId: string
  jaConfirmado: boolean
}

const INTERVALO_MIN_MS = 8000 // não manda atualização de posição mais que 1x a cada 8s

function linkRota(): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${FABRICA_COORDS.lat},${FABRICA_COORDS.lng}&travelmode=driving`
}

export function ChegadaClient({ recebimentoId, jaConfirmado }: ChegadaClientProps) {
  const [estado, setEstado] = useState<Estado>(jaConfirmado ? { fase: 'sucesso', distanciaMetros: -1 } : { fase: 'idle' })
  const watchIdRef = useRef<number | null>(null)
  const ultimoEnvioRef = useRef(0)
  const enviandoRef = useRef(false)

  useEffect(() => {
    // limpa o watch ao sair da página, senão o navegador continua captando
    // GPS em segundo plano à toa até o processo do navegador encerrar.
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current)
    }
  }, [])

  function pararCompartilhamento() {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    setEstado({ fase: 'idle' })
  }

  async function enviarPosicao(lat: number, lng: number) {
    if (enviandoRef.current) return
    enviandoRef.current = true
    try {
      const res = await fetch(`/api/recebimento/${recebimentoId}/localizacao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng }),
      })
      const json = await res.json()
      if (res.ok) {
        if (json.confirmado) {
          if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current)
          setEstado({ fase: 'sucesso', distanciaMetros: json.distanciaMetros })
        } else {
          setEstado({ fase: 'compartilhando', distanciaMetros: json.distanciaMetros })
        }
      }
    } catch {
      // Falha pontual de rede não interrompe o compartilhamento — a próxima
      // posição do watchPosition tenta de novo sozinha.
    } finally {
      enviandoRef.current = false
    }
  }

  function iniciarCompartilhamento() {
    if (!('geolocation' in navigator)) {
      setEstado({ fase: 'erro', mensagem: 'Seu navegador não suporta localização. Avise a portaria pra confirmar manualmente.' })
      return
    }
    setEstado({ fase: 'compartilhando', distanciaMetros: null })

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const agora = Date.now()
        if (agora - ultimoEnvioRef.current < INTERVALO_MIN_MS) return
        ultimoEnvioRef.current = agora
        enviarPosicao(pos.coords.latitude, pos.coords.longitude)
      },
      (geoErr) => {
        const msg = geoErr.code === geoErr.PERMISSION_DENIED
          ? 'Você precisa permitir o acesso à localização pra compartilhar. Toque no botão de novo e aceite a permissão.'
          : 'Não consegui obter sua localização. Verifique se o GPS do celular está ligado.'
        setEstado({ fase: 'erro', mensagem: msg })
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 },
    )
  }

  function confirmarAgora() {
    if (!('geolocation' in navigator)) {
      setEstado({ fase: 'erro', mensagem: 'Seu navegador não suporta localização. Avise a portaria pra confirmar manualmente.' })
      return
    }
    setEstado({ fase: 'confirmando' })
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(`/api/recebimento/${recebimentoId}/confirmar-chegada`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          })
          const json = await res.json()
          if (!res.ok) {
            if (json.jaConfirmado) setEstado({ fase: 'sucesso', distanciaMetros: -1 })
            else setEstado({ fase: 'erro', mensagem: json.error ?? 'Não foi possível confirmar.' })
            return
          }
          setEstado({ fase: 'sucesso', distanciaMetros: json.distanciaMetros })
        } catch {
          setEstado({ fase: 'erro', mensagem: 'Sem conexão — tente novamente em alguns instantes.' })
        }
      },
      () => setEstado({ fase: 'erro', mensagem: 'Não consegui obter sua localização.' }),
      { enableHighAccuracy: true, timeout: 15000 },
    )
  }

  if (estado.fase === 'sucesso') {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-leaf-500/30 bg-leaf-100/50 p-6 text-center">
        <CheckCircle2 className="size-10 text-leaf-700" />
        <p className="font-display text-lg font-semibold text-paper-900">Chegada confirmada</p>
        <p className="text-sm text-paper-600">
          {estado.distanciaMetros >= 0
            ? `Registrado a ${estado.distanciaMetros}m do portão. Aguarde ser chamado pra descarga.`
            : 'Já estava confirmada. Aguarde ser chamado pra descarga.'}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <a
        href={linkRota()}
        target="_blank"
        rel="noopener noreferrer"
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-paper-300 bg-paper-50 px-4 py-3 text-sm font-semibold text-paper-800 transition-colors hover:border-spruce-500 hover:text-spruce-700"
      >
        <Navigation className="size-4" />
        Traçar rota até a fábrica
      </a>

      {estado.fase === 'compartilhando' ? (
        <div className="flex flex-col gap-2.5 rounded-lg border border-spruce-600/30 bg-spruce-600/8 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-spruce-700">
            <Radar className="size-4 animate-pulse" />
            Compartilhando localização…
          </div>
          <p className="text-sm text-paper-700">
            {estado.distanciaMetros !== null
              ? `Você está a ${estado.distanciaMetros >= 1000 ? `${(estado.distanciaMetros / 1000).toFixed(1)} km` : `${estado.distanciaMetros} m`} da fábrica.`
              : 'Obtendo sua posição…'}
            {' '}A chegada confirma sozinha quando você entrar no pátio.
          </p>
          <button
            type="button"
            onClick={pararCompartilhamento}
            className="flex items-center justify-center gap-1.5 self-start rounded-md px-2 py-1 text-xs font-medium text-paper-500 hover:text-paper-800"
          >
            <Square className="size-3" />
            Parar de compartilhar
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={iniciarCompartilhamento}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-spruce-600 px-4 py-3.5 text-base font-semibold text-paper-50 shadow-[0_10px_24px_-10px_rgba(66,127,73,0.5)] transition-colors hover:bg-spruce-500"
        >
          <Radar className="size-5" />
          Compartilhar minha localização
        </button>
      )}

      {estado.fase === 'erro' && (
        <div className="flex items-start gap-2.5 rounded-lg border border-danger-500/30 bg-danger-500/8 p-3.5 text-sm text-danger-600">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <p>{estado.mensagem}</p>
        </div>
      )}

      <button
        type="button"
        onClick={confirmarAgora}
        disabled={estado.fase === 'confirmando'}
        className="flex items-center justify-center gap-1.5 py-1 text-xs font-medium text-paper-500 hover:text-paper-800 disabled:opacity-50"
      >
        {estado.fase === 'confirmando' ? <LoaderCircle className="size-3.5 animate-spin" /> : <MapPin className="size-3.5" />}
        {estado.fase === 'confirmando' ? 'Confirmando…' : 'Já estou na fábrica, confirmar agora'}
      </button>

      <p className="text-center text-xs text-paper-500">
        Compartilhar a localização exige manter esta página aberta durante a viagem.
      </p>
    </div>
  )
}
