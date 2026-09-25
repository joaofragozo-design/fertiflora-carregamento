'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, ImagePlus, Loader2, Save, Trash2, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { PageTitle } from '@/components/ui/page-header'
import { ROLE_LABELS } from '@/constants/roles'
import { cn } from '@/lib/utils/cn'
import type { AppUser } from '@/types'

const AVATAR_PX = 384
const APELIDO_MAX = 40

/**
 * Redimensiona e recorta (quadrado, centralizado) no navegador antes de subir —
 * foto de celular tem 3–8 MB; o avatar precisa de ~30 KB.
 */
async function prepararAvatar(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const lado = Math.min(bitmap.width, bitmap.height)
  const sx = (bitmap.width - lado) / 2
  const sy = (bitmap.height - lado) / 2
  const canvas = document.createElement('canvas')
  canvas.width = AVATAR_PX
  canvas.height = AVATAR_PX
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Não foi possível processar a imagem neste navegador.')
  ctx.drawImage(bitmap, sx, sy, lado, lado, 0, 0, AVATAR_PX, AVATAR_PX)
  bitmap.close?.()
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Falha ao gerar a imagem.'))), 'image/jpeg', 0.86)
  })
}

export function Configuracoes({ perfil }: { perfil: AppUser }) {
  const router = useRouter()
  const { user, refreshUser } = useAuth()
  const atual = user ?? perfil

  const [apelido, setApelido] = useState(atual.apelido ?? '')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(atual.avatar_url ?? null)
  const [subindo, setSubindo] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const cameraRef = useRef<HTMLInputElement>(null)
  const arquivoRef = useRef<HTMLInputElement>(null)

  const apelidoLimpo = apelido.trim().slice(0, APELIDO_MAX)
  const apelidoMudou = (atual.apelido ?? '') !== apelidoLimpo
  const nomeExibido = apelidoLimpo || atual.username

  async function salvarPerfil(patch: { apelido?: string | null; avatar_url?: string | null }) {
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from('profiles').update(patch).eq('id', atual.id)
    if (error) throw new Error(error.message)
    // Menu lateral e cabeçalho leem do AuthProvider: recarrega o profile na hora.
    await refreshUser()
    router.refresh()
  }

  async function onFotoEscolhida(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Escolha um arquivo de imagem.')
      return
    }
    setSubindo(true)
    try {
      const blob = await prepararAvatar(file)
      const supabase = createClient()
      const caminho = `${atual.id}/avatar.jpg`
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(caminho, blob, { upsert: true, contentType: 'image/jpeg', cacheControl: '60' })
      if (upErr) throw new Error(upErr.message)
      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(caminho)
      // ?v= fura o cache do navegador/CDN quando a foto é trocada no mesmo caminho.
      const url = `${pub.publicUrl}?v=${Date.now()}`
      await salvarPerfil({ avatar_url: url })
      setAvatarUrl(url)
      toast.success('Foto atualizada.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível enviar a foto.')
    } finally {
      setSubindo(false)
    }
  }

  async function removerFoto() {
    setSubindo(true)
    try {
      const supabase = createClient()
      await supabase.storage.from('avatars').remove([`${atual.id}/avatar.jpg`])
      await salvarPerfil({ avatar_url: null })
      setAvatarUrl(null)
      toast.success('Foto removida.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível remover a foto.')
    } finally {
      setSubindo(false)
    }
  }

  async function salvarApelido(e: React.FormEvent) {
    e.preventDefault()
    if (!apelidoMudou) return
    setSalvando(true)
    try {
      await salvarPerfil({ apelido: apelidoLimpo || null })
      setApelido(apelidoLimpo)
      toast.success(apelidoLimpo ? `Agora você aparece como "${apelidoLimpo}".` : 'Nome de exibição removido — volta a aparecer o login.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível salvar.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <PageTitle className="font-extrabold">Configurações</PageTitle>
        <p className="mt-1 text-xs text-industrial-600">Seu perfil como aparece no menu e no cabeçalho. Nada aqui muda o seu login.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        {/* Foto */}
        <section className="rounded-xl border border-industrial-200 bg-industrial-100 p-5">
          <h2 className="font-display text-sm font-bold text-industrial-900">Foto do perfil</h2>
          <p className="mt-0.5 text-xs text-industrial-600">Tire uma foto agora ou escolha uma imagem. Ela é recortada no quadrado e reduzida antes de subir.</p>

          <div className="mt-4 flex items-center gap-4">
            <div className="relative">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="Sua foto de perfil" className="h-24 w-24 rounded-full object-cover ring-4 ring-brand-500/30" />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-brand-700 font-display text-3xl font-bold uppercase text-white ring-4 ring-brand-500/30">
                  {nomeExibido.charAt(0) || <UserRound className="size-10" />}
                </div>
              )}
              {subindo && (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50">
                  <Loader2 className="size-6 animate-spin text-white" />
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => cameraRef.current?.click()}
                disabled={subindo}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-500 disabled:opacity-50"
              >
                <Camera className="size-4" /> Tirar foto agora
              </button>
              <button
                type="button"
                onClick={() => arquivoRef.current?.click()}
                disabled={subindo}
                className="inline-flex items-center gap-2 rounded-lg border border-industrial-300 px-3 py-2 text-xs font-medium text-industrial-800 transition-colors hover:border-brand-500 hover:text-brand-300 disabled:opacity-50"
              >
                <ImagePlus className="size-4" /> Escolher imagem
              </button>
              {avatarUrl && (
                <button
                  type="button"
                  onClick={removerFoto}
                  disabled={subindo}
                  className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium text-industrial-500 transition-colors hover:text-red-400 disabled:opacity-50"
                >
                  <Trash2 className="size-3.5" /> Remover foto
                </button>
              )}
            </div>
          </div>

          {/* capture="user" abre a câmera frontal no celular; no desktop cai no seletor de arquivo. */}
          <input ref={cameraRef} type="file" accept="image/*" capture="user" className="hidden" onChange={onFotoEscolhida} />
          <input ref={arquivoRef} type="file" accept="image/*" className="hidden" onChange={onFotoEscolhida} />
        </section>

        {/* Nome de exibição */}
        <section className="rounded-xl border border-industrial-200 bg-industrial-100 p-5">
          <h2 className="font-display text-sm font-bold text-industrial-900">Nome de exibição</h2>
          <p className="mt-0.5 text-xs text-industrial-600">
            É como você aparece no sistema. O login continua sendo <code className="rounded bg-industrial-200 px-1 font-mono text-industrial-800">{atual.username}</code>.
          </p>

          <form onSubmit={salvarApelido} className="mt-4 flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-xs font-medium text-industrial-700">
              Nome
              <input
                type="text"
                value={apelido}
                maxLength={APELIDO_MAX}
                onChange={(e) => setApelido(e.target.value)}
                placeholder={atual.username}
                autoComplete="nickname"
                className="rounded-lg border border-industrial-400 bg-industrial-50 px-3 py-2 text-base text-industrial-900 placeholder-industrial-500 focus:border-brand-500 focus:outline-none md:text-sm"
              />
              <span className="text-[11px] font-normal text-industrial-500">{apelido.trim().length}/{APELIDO_MAX} · deixe em branco pra voltar a mostrar o login</span>
            </label>

            <dl className="grid grid-cols-2 gap-3 rounded-lg border border-industrial-200 bg-industrial-50 p-3 text-xs">
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-wide text-industrial-500">Login</dt>
                <dd className="mt-0.5 font-mono text-industrial-900">{atual.username}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-wide text-industrial-500">Perfil</dt>
                <dd className="mt-0.5 text-industrial-900">{ROLE_LABELS[atual.role] ?? atual.role}</dd>
              </div>
            </dl>

            <button
              type="submit"
              disabled={!apelidoMudou || salvando}
              className={cn(
                'inline-flex items-center justify-center gap-2 self-start rounded-lg px-4 py-2 text-xs font-semibold transition-colors',
                'bg-brand-600 text-white hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-40',
              )}
            >
              {salvando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {salvando ? 'Salvando…' : 'Salvar nome'}
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}
