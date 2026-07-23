'use client'

import { useEffect } from 'react'

const RELOAD_FLAG = 'ff-chunk-reload-attempted'

function ehErroDeChunk(msg: string | undefined): boolean {
  if (!msg) return false
  return /ChunkLoadError|Loading chunk .* failed|Failed to fetch dynamically imported module|Importing a module script failed/i.test(msg)
}

// Depois de um deploy novo, uma aba aberta ANTES do deploy ainda roda o JS do
// build antigo -- ao navegar (Link/router, sem recarregar a página inteira),
// o Next tenta buscar um chunk daquele build antigo, que a Vercel já
// substituiu (404 -> ChunkLoadError). Em vez de deixar o usuário travado numa
// tela de erro achando que é um bug, recarrega a página sozinho (uma vez só,
// pra não entrar em loop se o erro persistir por outro motivo).
function recarregarUmaVez() {
  if (sessionStorage.getItem(RELOAD_FLAG)) return
  sessionStorage.setItem(RELOAD_FLAG, '1')
  window.location.reload()
}

export function SwRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }

    function onError(e: ErrorEvent) {
      if (ehErroDeChunk(e.message)) recarregarUmaVez()
    }
    function onRejection(e: PromiseRejectionEvent) {
      const msg = e.reason instanceof Error ? e.reason.message : String(e.reason)
      if (ehErroDeChunk(msg)) recarregarUmaVez()
    }
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])
  return null
}
