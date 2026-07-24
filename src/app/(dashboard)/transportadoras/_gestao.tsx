'use client'

import { useRef, useState } from 'react'
import { Plus, X, Container, KeyRound, Copy, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { TransportadorasService } from '@/services/transportadoras.service'
import type { Transportadora } from '@/types/transportadora'
import { cn } from '@/lib/utils/cn'

interface GestaoTransportadorasProps {
  initialTransportadoras: Transportadora[]
}

interface FormState {
  nome:     string
  username: string
  senha:    string
  cnpj:     string
  email:    string
}

interface EditState {
  id:    string
  nome:  string
  cnpj:  string
  email: string
}

const FORM_VAZIO: FormState = { nome: '', username: '', senha: '', cnpj: '', email: '' }

/** Gestão de transportadoras: a Logística cria o login que a transportadora
 *  usa pra cadastrar motoristas e enviar solicitações de carregamento. */
export function GestaoTransportadoras({ initialTransportadoras }: GestaoTransportadorasProps) {
  const [transportadoras, setTransportadoras] = useState(initialTransportadoras)
  const [form, setForm] = useState<FormState | null>(null)
  const [edit, setEdit] = useState<EditState | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [credenciais, setCredenciais] = useState<{ nome: string; username: string; senha: string } | null>(null)
  const svc = useRef(new TransportadorasService(createClient())).current

  async function criar() {
    if (!form) return
    setSalvando(true)
    try {
      const res = await fetch('/api/transportadoras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Erro ao cadastrar transportadora.')

      setTransportadoras((prev) =>
        [...prev, json.transportadora as Transportadora].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
      )
      // Mostra as credenciais UMA vez pra Logística repassar à transportadora.
      setCredenciais({ nome: form.nome, username: form.username, senha: form.senha })
      setForm(null)
      toast.success('Transportadora cadastrada.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao cadastrar transportadora.')
    } finally {
      setSalvando(false)
    }
  }

  async function salvarEdicao() {
    if (!edit) return
    setSalvando(true)
    try {
      const atualizada = await svc.atualizar(edit.id, {
        nome:  edit.nome.trim(),
        cnpj:  edit.cnpj.trim() || null,
        email: edit.email.trim() || null,
      })
      setTransportadoras((prev) =>
        prev.map((t) => (t.id === atualizada.id ? atualizada : t)).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
      )
      setEdit(null)
      toast.success('Transportadora atualizada.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar transportadora.')
    } finally {
      setSalvando(false)
    }
  }

  function copiarCredenciais() {
    if (!credenciais) return
    const texto = `Acesso ao sistema de carregamento FERTIFLORA\nUsuário: ${credenciais.username}\nSenha: ${credenciais.senha}\n${window.location.origin}/login`
    navigator.clipboard.writeText(texto).then(
      () => toast.success('Credenciais copiadas.'),
      () => toast.error('Não foi possível copiar.'),
    )
  }

  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-semibold text-industrial-100">Transportadoras</h1>
          <p className="text-xs text-industrial-400 mt-1">
            Cada transportadora ganha um login próprio pra cadastrar motoristas e enviar solicitações de carregamento.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setForm({ ...FORM_VAZIO })}
          className="flex items-center gap-1.5 rounded-lg bg-brand-700 hover:bg-brand-600 text-white px-4 py-2 text-sm font-medium transition-colors"
        >
          <Plus className="size-4" /> Nova transportadora
        </button>
      </div>

      {/* Credenciais recém-criadas (a senha não fica salva em lugar nenhum depois) */}
      {credenciais && (
        <div className="rounded-xl border-2 border-brand-500 bg-brand-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <KeyRound className="size-4 text-brand-700" />
              <p className="text-sm font-semibold text-industrial-100">
                Acesso criado para {credenciais.nome} — repasse agora (a senha não será mostrada de novo):
              </p>
            </div>
            <button type="button" onClick={() => setCredenciais(null)} className="text-industrial-400 hover:text-industrial-100">
              <X className="size-4" />
            </button>
          </div>
          <div className="flex items-center gap-4 mt-2 flex-wrap">
            <span className="text-sm text-industrial-300">Usuário: <span className="font-mono font-bold text-industrial-100">{credenciais.username}</span></span>
            <span className="text-sm text-industrial-300">Senha: <span className="font-mono font-bold text-industrial-100">{credenciais.senha}</span></span>
            <button
              type="button"
              onClick={copiarCredenciais}
              className="flex items-center gap-1.5 rounded-lg border border-brand-500 text-brand-700 hover:bg-brand-100 px-3 py-1.5 text-xs font-semibold transition-colors"
            >
              <Copy className="size-3.5" /> Copiar
            </button>
          </div>
        </div>
      )}

      {/* Lista */}
      <div className="flex flex-col gap-2">
        {transportadoras.map((t) => (
          <div key={t.id} className="flex items-center justify-between gap-3 rounded-xl border border-industrial-700 bg-industrial-900 px-4 py-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <Container className="size-4 text-brand-600 shrink-0" />
              <div className="min-w-0">
                <span className="font-semibold text-industrial-100 truncate block">{t.nome}</span>
                {(t.cnpj || t.email) && (
                  <span className="text-xs text-industrial-500 truncate block">
                    {[t.cnpj, t.email].filter(Boolean).join(' · ')}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className={cn('text-xs font-medium', t.profile_id ? 'text-brand-700' : 'text-industrial-500')}>
                {t.profile_id ? 'Com acesso' : 'Sem login'}
              </span>
              <button
                type="button"
                onClick={() => setEdit({ id: t.id, nome: t.nome, cnpj: t.cnpj ?? '', email: t.email ?? '' })}
                title="Editar nome / CNPJ / e-mail"
                className="text-industrial-400 hover:text-brand-700"
              >
                <Pencil className="size-4" />
              </button>
            </div>
          </div>
        ))}
        {transportadoras.length === 0 && (
          <p className="text-sm text-industrial-500 text-center py-10">Nenhuma transportadora cadastrada ainda.</p>
        )}
      </div>

      {/* Modal de cadastro */}
      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setForm(null)}>
          <div className="w-full max-w-md rounded-xl bg-industrial-900 border border-industrial-700 p-5 flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-industrial-100">Nova transportadora</h2>
              <button type="button" onClick={() => setForm(null)} className="text-industrial-400 hover:text-industrial-100"><X className="size-5" /></button>
            </div>

            <label className="text-xs font-medium text-industrial-400">Nome da transportadora
              <input
                autoFocus
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="ex.: Transportes Oeste Ltda"
                className="mt-1 w-full bg-industrial-950 border border-industrial-600 rounded-lg px-3 py-2 text-sm text-industrial-100 placeholder-industrial-500 focus:outline-none focus:border-brand-500"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-medium text-industrial-400">Usuário (login)
                <input
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, '') })}
                  placeholder="ex.: toeste"
                  className="mt-1 w-full bg-industrial-950 border border-industrial-600 rounded-lg px-3 py-2 text-sm font-mono text-industrial-100 placeholder-industrial-500 focus:outline-none focus:border-brand-500"
                />
              </label>
              <label className="text-xs font-medium text-industrial-400">Senha (mín. 6)
                <input
                  value={form.senha}
                  onChange={(e) => setForm({ ...form, senha: e.target.value })}
                  placeholder="senha de acesso"
                  className="mt-1 w-full bg-industrial-950 border border-industrial-600 rounded-lg px-3 py-2 text-sm font-mono text-industrial-100 placeholder-industrial-500 focus:outline-none focus:border-brand-500"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-medium text-industrial-400">CNPJ (opcional)
                <input
                  value={form.cnpj}
                  onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
                  placeholder="00.000.000/0000-00"
                  className="mt-1 w-full bg-industrial-950 border border-industrial-600 rounded-lg px-3 py-2 text-sm font-mono text-industrial-100 placeholder-industrial-500 focus:outline-none focus:border-brand-500"
                />
              </label>
              <label className="text-xs font-medium text-industrial-400">E-mail (opcional)
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="contato@transportadora.com"
                  className="mt-1 w-full bg-industrial-950 border border-industrial-600 rounded-lg px-3 py-2 text-sm text-industrial-100 placeholder-industrial-500 focus:outline-none focus:border-brand-500"
                />
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setForm(null)}
                className="rounded-lg border border-industrial-600 px-4 py-2 text-sm font-medium text-industrial-300 hover:bg-industrial-800">Cancelar</button>
              <button
                type="button"
                onClick={criar}
                disabled={salvando || !form.nome.trim() || form.username.length < 3 || form.senha.length < 6}
                className="rounded-lg bg-brand-700 hover:bg-brand-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {salvando ? 'Criando…' : 'Criar acesso'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de edição (nome/CNPJ/e-mail) */}
      {edit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setEdit(null)}>
          <div className="w-full max-w-md rounded-xl bg-industrial-900 border border-industrial-700 p-5 flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-industrial-100">Editar transportadora</h2>
              <button type="button" onClick={() => setEdit(null)} className="text-industrial-400 hover:text-industrial-100"><X className="size-5" /></button>
            </div>

            <label className="text-xs font-medium text-industrial-400">Nome da transportadora
              <input
                autoFocus
                value={edit.nome}
                onChange={(e) => setEdit({ ...edit, nome: e.target.value })}
                className="mt-1 w-full bg-industrial-950 border border-industrial-600 rounded-lg px-3 py-2 text-sm text-industrial-100 focus:outline-none focus:border-brand-500"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-medium text-industrial-400">CNPJ (opcional)
                <input
                  value={edit.cnpj}
                  onChange={(e) => setEdit({ ...edit, cnpj: e.target.value })}
                  placeholder="00.000.000/0000-00"
                  className="mt-1 w-full bg-industrial-950 border border-industrial-600 rounded-lg px-3 py-2 text-sm font-mono text-industrial-100 placeholder-industrial-500 focus:outline-none focus:border-brand-500"
                />
              </label>
              <label className="text-xs font-medium text-industrial-400">E-mail (opcional)
                <input
                  type="email"
                  value={edit.email}
                  onChange={(e) => setEdit({ ...edit, email: e.target.value })}
                  placeholder="contato@transportadora.com"
                  className="mt-1 w-full bg-industrial-950 border border-industrial-600 rounded-lg px-3 py-2 text-sm text-industrial-100 placeholder-industrial-500 focus:outline-none focus:border-brand-500"
                />
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setEdit(null)}
                className="rounded-lg border border-industrial-600 px-4 py-2 text-sm font-medium text-industrial-300 hover:bg-industrial-800">Cancelar</button>
              <button
                type="button"
                onClick={salvarEdicao}
                disabled={salvando || !edit.nome.trim()}
                className="rounded-lg bg-brand-700 hover:bg-brand-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {salvando ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
