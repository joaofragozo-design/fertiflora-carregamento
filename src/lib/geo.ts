export interface Coordenada {
  lat: number
  lng: number
}

// Coordenadas do portão da fábrica (PR-317, Km 05, Toledo-PR) — usadas pra
// validar por GPS que quem confirma a chegada de fato está no local, em vez
// de confiar cegamente num clique.
export const FABRICA_COORDS: Coordenada = { lat: -24.750206, lng: -53.8053717 }

// Raio de tolerância em metros. Cobre o pátio/terreno da fábrica, não só um
// ponto exato — GPS de celular em área rural varia dezenas de metros, e o
// caminhão pode estar em qualquer ponto do terreno, não só no portão.
export const RAIO_CHEGADA_METROS = 800

/** Distância em metros entre duas coordenadas (fórmula de Haversine). */
export function distanciaMetros(a: Coordenada, b: Coordenada): number {
  const R = 6371000 // raio médio da Terra, em metros
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)

  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}
