'use client'

import { useEffect, useRef, useState } from 'react'
import type { Map as LeafletMap, Marker } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { FABRICA_COORDS, RAIO_CHEGADA_METROS, distanciaMetros } from '@/lib/geo'
import { type RecebimentoPrevisto, labelPlacaCompleta } from '@/services/recebimentos.service'
import { MATERIAS_PRIMA } from '@/types/formula'

interface MapaChegadasProps {
  recebimentos: RecebimentoPrevisto[]
}

// Sem atualização de posição há mais que isso, trata como "parou de
// compartilhar" (fechou a página, chegou e não tá mais rastreando etc.).
const JANELA_ATIVO_MS = 10 * 60 * 1000

function labelMateriaPrima(r: RecebimentoPrevisto): string {
  const mp = MATERIAS_PRIMA.find((m) => m.key === r.materia_prima_key)
  return mp?.label ?? r.materia_prima ?? 'Matéria-prima'
}

function motoristasAtivos(recebimentos: RecebimentoPrevisto[]) {
  const agora = Date.now()
  return recebimentos.filter((r) => {
    if (r.finalizado_em || r.confirmado_em) return false
    if (r.motorista_lat == null || r.motorista_lng == null || !r.motorista_localizacao_em) return false
    return agora - new Date(r.motorista_localizacao_em).getTime() < JANELA_ATIVO_MS
  })
}

/** Mapa ao vivo dos motoristas de matéria-prima que estão compartilhando
 *  localização a caminho da fábrica (tela /chegada/[id]). Só aparece quem
 *  atualizou a posição nos últimos 10 minutos — sem isso, some do mapa em
 *  vez de ficar "grudado" num ponto antigo enganando quem olha. */
export function MapaChegadas({ recebimentos }: MapaChegadasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const markersRef = useRef<Map<string, Marker>>(new Map())
  // A criação do mapa é assíncrona (import dinâmico do leaflet) — sem isso,
  // o efeito que sincroniza os marcadores pode rodar ANTES do mapa existir
  // (mapRef.current ainda null) e nunca mais ser re-executado, deixando os
  // marcadores de motorista invisíveis mesmo com dados corretos.
  const [mapaPronto, setMapaPronto] = useState(false)

  const ativos = motoristasAtivos(recebimentos)

  // Inicializa o mapa uma única vez.
  useEffect(() => {
    let cancelado = false
    import('leaflet').then((L) => {
      if (cancelado || !containerRef.current || mapRef.current) return

      const map = L.map(containerRef.current).setView([FABRICA_COORDS.lat, FABRICA_COORDS.lng], 12)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 18,
      }).addTo(map)

      const iconFabrica = L.divIcon({
        className: '',
        html: '<div style="display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:9999px;background:#155048;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);font-size:16px;">🏭</div>',
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      })
      L.circle([FABRICA_COORDS.lat, FABRICA_COORDS.lng], {
        radius: RAIO_CHEGADA_METROS,
        color: '#155048',
        fillColor: '#427F49',
        fillOpacity: 0.08,
        weight: 1,
      }).addTo(map)
      L.marker([FABRICA_COORDS.lat, FABRICA_COORDS.lng], { icon: iconFabrica })
        .addTo(map)
        .bindTooltip('Fertiflora — fábrica')

      mapRef.current = map
      setMapaPronto(true)
      setTimeout(() => map.invalidateSize(), 50)
    })

    return () => {
      cancelado = true
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  // Sincroniza os marcadores dos motoristas a cada mudança na lista de ativos.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    import('leaflet').then((L) => {
      const idsAtivos = new Set(ativos.map((r) => r.id))

      // Remove quem saiu da lista de ativos.
      for (const [id, marker] of markersRef.current) {
        if (!idsAtivos.has(id)) {
          marker.remove()
          markersRef.current.delete(id)
        }
      }

      for (const r of ativos) {
        const pos: [number, number] = [r.motorista_lat!, r.motorista_lng!]
        const dist = Math.round(distanciaMetros(FABRICA_COORDS, { lat: pos[0], lng: pos[1] }))
        const tooltip = `${labelMateriaPrima(r)} · ${(r.quantidade_ton ?? 0).toFixed(1)}t`
          + (labelPlacaCompleta(r) ? ` · ${labelPlacaCompleta(r)}` : '')
          + ` · ${dist < 1000 ? `${dist} m` : `${(dist / 1000).toFixed(1)} km`}`

        const existente = markersRef.current.get(r.id)
        if (existente) {
          existente.setLatLng(pos)
          existente.setTooltipContent(tooltip)
        } else {
          const icon = L.divIcon({
            className: '',
            html: '<div style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:9999px;background:#427F49;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);font-size:14px;">🚚</div>',
            iconSize: [28, 28],
            iconAnchor: [14, 14],
          })
          const marker = L.marker(pos, { icon }).addTo(map).bindTooltip(tooltip, { permanent: false })
          markersRef.current.set(r.id, marker)
        }
      }
    })
  }, [ativos, mapaPronto])

  return (
    {/* z-0 cria stacking context: os panes internos do Leaflet (z-index
        400–1000) ficam confinados aqui e não passam por cima dos modais. */}
    <div className="relative z-0 overflow-hidden rounded-tl-2xl rounded-br-2xl rounded-tr-lg rounded-bl-lg border border-paper-300 bg-paper-50 shadow-editorial">
      <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-leaf-400 to-spruce-600" />

      <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-paper-500">
            Recebimento · GPS ao vivo
          </p>
          <h2 className="font-display text-lg font-semibold text-paper-900">Motoristas a caminho</h2>
        </div>
        <span className="flex items-center gap-1.5 rounded-full border border-leaf-500/30 bg-leaf-500/15 px-3 py-1 text-xs font-bold text-leaf-300">
          {ativos.length} {ativos.length === 1 ? 'ativo' : 'ativos'}
        </span>
      </div>

      <div ref={containerRef} className="h-72 w-full" />

      {ativos.length === 0 && (
        <p className="p-4 text-center text-xs text-paper-500">
          Ninguém compartilhando localização agora — o motorista precisa abrir o link de chegada e tocar em &quot;Compartilhar minha localização&quot;.
        </p>
      )}
    </div>
  )
}
