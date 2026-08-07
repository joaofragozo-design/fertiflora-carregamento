'use client'

import { useMemo, useRef, useState } from 'react'
import { Plus, X, Container, KeyRound, Copy, Pencil, ChevronDown, ChevronRight, Trash2, Users } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { TransportadorasService } from '@/services/transportadoras.service'
import type { Transportadora, Motorista } from '@/types/transportadora'
import { formatPlacaCompleta } from '@/lib/utils/format'
import { cn } from '@/lib/utils/cn'

interface GestaoTransportadorasProps {
  initialTransportadoras: Transportadora[]
  initialMotoristas:      Motorista[]
}

interface FormMotoristaState {
  transportadora_id: string
  id:                 string | null // null = cadastro novo
  nome:               string
  whatsapp:           string
  cpf:                string
  rg:                 string
  cnh:                string
  placa_cavalo:       string
  placa_1:            string
  placa_2:            string
  placa_3:            string
  placa_4:            string
}

function formMotoristaVazio(transportadoraId: string): FormMotoristaState {
  return {
    transportadora_id: transportadoraId, id: null,
    nome: '', whatsapp: '', cpf: '', rg: '', cnh: '',
    placa_cavalo: '', placa_1: '', placa_2: '', placa_3: '', placa_4: '',
  }
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
export function GestaoTransportadoras({ initialTransportadoras, initialMotoristas }: GestaoTransportadorasProps) {
  const [transportadoras, setTransportadoras] = useState(initialTransportadoras)
  const [form, setForm] = useState<FormState | null>(null)
  const [edit, setEdit] = useState<EditState | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [credenciais, setCredenciais] = useState<{ nome: string; username: string; senha: string } | null>(null)
  const svc = useRef(new TransportadorasService(createClient())).current

  const [motoristas, setMotoristas] = useState(initialMotoristas)
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set())
  const [formMotorista, setFormMotorista] = useState<FormMotoristaState | null>(null)
  const [salvandoMotorista, setSalvandoMotorista] = useState(false)
  const [excluindoMotoristaId, setExcluindoMotoristaId] = useState<string | null>(null)

  const motoristasPorTransportadora = useMemo(() => {
    const mapa = new Map<string, Motorista[]>()
    for (const m of motoristas) mapa.set(m.transportadora_id, [...(mapa.get(m.transportadora_id) ?? []), m])
    return mapa
  }, [motoristas])

  function toggleExpandida(id: string) {
    setExpandidas((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function salvarMotorista() {
    if (!formMotorista) return
    setSalvandoMotorista(true)
    try {
      const dados = {
        nome: formMotorista.nome,
        whatsapp: formMotorista.whatsapp,
        cpf: formMotorista.cpf,
        rg: formMotorista.rg,
        cnh: formMotorista.cnh,
        placa_cavalo: formMotorista.placa_cavalo,
        placa_1: formMotorista.placa_1,
        placa_2: formMotorista.placa_2,
        placa_3: formMotorista.placa_3,
        placa_4: formMotorista.placa_4,
      }
      const salvo = formMotorista.id
        ? await svc.atualizarMotorista(formMotorista.id, dados)
        : await svc.criarMotorista({ transportadora_id: formMotorista.transportadora_id, ...dados })

      setMotoristas((prev) =>
        (formMotorista.id ? prev.map((m) => (m.id === salvo.id ? salvo : m)) : [...prev, salvo])
          .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
      )
      setFormMotorista(null)
      toast.success(formMotorista.id ? `Motorista ${salvo.nome} atualizado.` : `Motorista ${salvo.nome} cadastrado.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar motorista.')
    } finally {
      setSalvandoMotorista(false)
    }
  }

  async function excluirMotorista(m: Motorista) {
    if (!window.confirm(`Excluir o motorista ${m.nome}? Essa ação não pode ser desfeita.`)) return
    setExcluindoMotoristaId(m.id)
    try {
      await svc.excluirMotorista(m.id)
      setMotoristas((prev) => prev.filter((x) => x.id !== m.id))
      toast.success('Motorista excluído.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao excluir motorista.')
    } finally {
      setExcluindoMotoristaId(null)
    }
  }

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
          <h1 className="text-lg font-semibold text-industrial-900">Transportadoras</h1>
          <p className="text-xs text-industrial-600 mt-1">
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
              <p className="text-sm font-semibold text-industrial-900">
                Acesso criado para {credenciais.nome} — repasse agora (a senha não será mostrada de novo):
              </p>
            </div>
            <button type="button" onClick={() => setCredenciais(null)} className="text-industrial-600 hover:text-industrial-900">
              <X className="size-4" />
            </button>
          </div>
          <div className="flex items-center gap-4 mt-2 flex-wrap">
            <span className="text-sm text-industrial-700">Usuário: <span className="font-mono font-bold text-industrial-900">{credenciais.username}</span></span>
            <span className="text-sm text-industrial-700">Senha: <span className="font-mono font-bold text-industrial-900">{credenciais.senha}</span></span>
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
        {transportadoras.map((t) => {
          const motoristasDaTransp = motoristasPorTransportadora.get(t.id) ?? []
          const aberta = expandidas.has(t.id)
          return (
          <div key={t.id} className="rounded-xl border border-industrial-300 bg-industrial-100 overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <button
                type="button"
                onClick={() => toggleExpandida(t.id)}
                className="flex items-center gap-2.5 min-w-0 text-left"
              >
                {aberta ? <ChevronDown className="size-4 text-industrial-500 shrink-0" /> : <ChevronRight className="size-4 text-industrial-500 shrink-0" />}
                <Container className="size-4 text-brand-600 shrink-0" />
                <div className="min-w-0">
                  <span className="font-semibold text-industrial-900 truncate block">{t.nome}</span>
                  <span className="text-xs text-industrial-500 truncate block">
                    {[t.cnpj, t.email].filter(Boolean).join(' · ')}
                    {(t.cnpj || t.email) && ' · '}
                    {motoristasDaTransp.length} motorista{motoristasDaTransp.length === 1 ? '' : 's'}
                  </span>
                </div>
              </button>
              <div className="flex items-center gap-3 shrink-0">
                <span className={cn('text-xs font-medium', t.profile_id ? 'text-brand-700' : 'text-industrial-500')}>
                  {t.profile_id ? 'Com acesso' : 'Sem login'}
                </span>
                <button
                  type="button"
                  onClick={() => setEdit({ id: t.id, nome: t.nome, cnpj: t.cnpj ?? '', email: t.email ?? '' })}
                  title="Editar nome / CNPJ / e-mail"
                  className="text-industrial-600 hover:text-brand-700"
                >
                  <Pencil className="size-4" />
                </button>
              </div>
            </div>

            {aberta && (
              <div className="border-t border-industrial-300 bg-industrial-50 px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-industrial-600">
                    <Users className="size-3.5 text-brand-600" /> Motoristas
                  </p>
                  <button
                    type="button"
                    onClick={() => setFormMotorista(formMotoristaVazio(t.id))}
                    className="flex items-center gap-1 rounded-lg border border-industrial-400 px-2.5 py-1 text-xs font-medium text-industrial-700 hover:border-brand-500 hover:text-brand-700 transition-colors"
                  >
                    <Plus className="size-3.5" /> Novo motorista
                  </button>
                </div>
                {motoristasDaTransp.length === 0 ? (
                  <p className="text-xs text-industrial-500 py-2">Nenhum motorista cadastrado ainda.</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {motoristasDaTransp.map((m) => (
                      <div key={m.id} className="flex items-center justify-between gap-3 flex-wrap rounded-lg border border-industrial-300 bg-industrial-100 px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-industrial-900">{m.nome}</p>
                          <p className="text-xs text-industrial-600 font-mono">{m.whatsapp} · {formatPlacaCompleta(m)}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => setFormMotorista({
                              transportadora_id: t.id, id: m.id,
                              nome: m.nome, whatsapp: m.whatsapp, cpf: m.cpf, rg: m.rg, cnh: m.cnh,
                              placa_cavalo: m.placa_cavalo, placa_1: m.placa_1,
                              placa_2: m.placa_2 ?? '', placa_3: m.placa_3 ?? '', placa_4: m.placa_4 ?? '',
                            })}
                            title="Editar motorista"
                            className="flex items-center justify-center rounded-lg border border-industrial-400 text-industrial-600 hover:border-brand-500 hover:text-brand-700 p-1.5 transition-colors"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => excluirMotorista(m)}
                            disabled={excluindoMotoristaId === m.id}
                            title="Excluir motorista"
                            className="flex items-center justify-center rounded-lg border border-industrial-400 text-industrial-600 hover:border-red-500 hover:text-red-600 p-1.5 transition-colors disabled:opacity-50"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          )
        })}
        {transportadoras.length === 0 && (
          <p className="text-sm text-industrial-500 text-center py-10">Nenhuma transportadora cadastrada ainda.</p>
        )}
      </div>

      {/* Modal de cadastro */}
      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setForm(null)}>
          <div className="w-full max-w-md rounded-xl bg-industrial-100 border border-industrial-300 p-5 flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-industrial-900">Nova transportadora</h2>
              <button type="button" onClick={() => setForm(null)} className="text-industrial-600 hover:text-industrial-900"><X className="size-5" /></button>
            </div>

            <label className="text-xs font-medium text-industrial-600">Nome da transportadora
              <input
                autoFocus
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="ex.: Transportes Oeste Ltda"
                className="mt-1 w-full bg-industrial-50 border border-industrial-400 rounded-lg px-3 py-2 text-sm text-industrial-900 placeholder-industrial-500 focus:outline-none focus:border-brand-500"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-medium text-industrial-600">Usuário (login)
                <input
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, '') })}
                  placeholder="ex.: toeste"
                  className="mt-1 w-full bg-industrial-50 border border-industrial-400 rounded-lg px-3 py-2 text-sm font-mono text-industrial-900 placeholder-industrial-500 focus:outline-none focus:border-brand-500"
                />
              </label>
              <label className="text-xs font-medium text-industrial-600">Senha (mín. 6)
                <input
                  value={form.senha}
                  onChange={(e) => setForm({ ...form, senha: e.target.value })}
                  placeholder="senha de acesso"
                  className="mt-1 w-full bg-industrial-50 border border-industrial-400 rounded-lg px-3 py-2 text-sm font-mono text-industrial-900 placeholder-industrial-500 focus:outline-none focus:border-brand-500"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-medium text-industrial-600">CNPJ (opcional)
                <input
                  value={form.cnpj}
                  onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
                  placeholder="00.000.000/0000-00"
                  className="mt-1 w-full bg-industrial-50 border border-industrial-400 rounded-lg px-3 py-2 text-sm font-mono text-industrial-900 placeholder-industrial-500 focus:outline-none focus:border-brand-500"
                />
              </label>
              <label className="text-xs font-medium text-industrial-600">E-mail (opcional)
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="contato@transportadora.com"
                  className="mt-1 w-full bg-industrial-50 border border-industrial-400 rounded-lg px-3 py-2 text-sm text-industrial-900 placeholder-industrial-500 focus:outline-none focus:border-brand-500"
                />
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setForm(null)}
                className="rounded-lg border border-industrial-400 px-4 py-2 text-sm font-medium text-industrial-700 hover:bg-industrial-200">Cancelar</button>
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
          <div className="w-full max-w-md rounded-xl bg-industrial-100 border border-industrial-300 p-5 flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-industrial-900">Editar transportadora</h2>
              <button type="button" onClick={() => setEdit(null)} className="text-industrial-600 hover:text-industrial-900"><X className="size-5" /></button>
            </div>

            <label className="text-xs font-medium text-industrial-600">Nome da transportadora
              <input
                autoFocus
                value={edit.nome}
                onChange={(e) => setEdit({ ...edit, nome: e.target.value })}
                className="mt-1 w-full bg-industrial-50 border border-industrial-400 rounded-lg px-3 py-2 text-sm text-industrial-900 focus:outline-none focus:border-brand-500"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-medium text-industrial-600">CNPJ (opcional)
                <input
                  value={edit.cnpj}
                  onChange={(e) => setEdit({ ...edit, cnpj: e.target.value })}
                  placeholder="00.000.000/0000-00"
                  className="mt-1 w-full bg-industrial-50 border border-industrial-400 rounded-lg px-3 py-2 text-sm font-mono text-industrial-900 placeholder-industrial-500 focus:outline-none focus:border-brand-500"
                />
              </label>
              <label className="text-xs font-medium text-industrial-600">E-mail (opcional)
                <input
                  type="email"
                  value={edit.email}
                  onChange={(e) => setEdit({ ...edit, email: e.target.value })}
                  placeholder="contato@transportadora.com"
                  className="mt-1 w-full bg-industrial-50 border border-industrial-400 rounded-lg px-3 py-2 text-sm text-industrial-900 placeholder-industrial-500 focus:outline-none focus:border-brand-500"
                />
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setEdit(null)}
                className="rounded-lg border border-industrial-400 px-4 py-2 text-sm font-medium text-industrial-700 hover:bg-industrial-200">Cancelar</button>
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

      {/* Modal de novo/editar motorista */}
      {formMotorista && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto" onClick={() => setFormMotorista(null)}>
          <div className="w-full max-w-md rounded-xl bg-industrial-100 border border-industrial-300 p-5 flex flex-col gap-3 my-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-industrial-900">{formMotorista.id ? 'Editar motorista' : 'Novo motorista'}</h2>
              <button type="button" onClick={() => setFormMotorista(null)} className="text-industrial-600 hover:text-industrial-900"><X className="size-5" /></button>
            </div>

            <label className="text-xs font-medium text-industrial-600">Nome do motorista
              <input
                autoFocus
                value={formMotorista.nome}
                onChange={(e) => setFormMotorista({ ...formMotorista, nome: e.target.value })}
                placeholder="ex.: José da Silva"
                className="mt-1 w-full bg-industrial-50 border border-industrial-400 rounded-lg px-3 py-2 text-sm text-industrial-900 placeholder-industrial-500 focus:outline-none focus:border-brand-500"
              />
            </label>
            <label className="text-xs font-medium text-industrial-600">WhatsApp com DDD (obrigatório — recebe o aviso de liberação)
              <input
                value={formMotorista.whatsapp}
                onChange={(e) => setFormMotorista({ ...formMotorista, whatsapp: e.target.value })}
                placeholder="ex.: (45) 99999-9999"
                className="mt-1 w-full bg-industrial-50 border border-industrial-400 rounded-lg px-3 py-2 text-sm font-mono text-industrial-900 placeholder-industrial-500 focus:outline-none focus:border-brand-500"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-medium text-industrial-600">CPF
                <input
                  value={formMotorista.cpf}
                  onChange={(e) => setFormMotorista({ ...formMotorista, cpf: e.target.value })}
                  placeholder="000.000.000-00"
                  className="mt-1 w-full bg-industrial-50 border border-industrial-400 rounded-lg px-3 py-2 text-sm font-mono text-industrial-900 placeholder-industrial-500 focus:outline-none focus:border-brand-500"
                />
              </label>
              <label className="text-xs font-medium text-industrial-600">RG
                <input
                  value={formMotorista.rg}
                  onChange={(e) => setFormMotorista({ ...formMotorista, rg: e.target.value })}
                  className="mt-1 w-full bg-industrial-50 border border-industrial-400 rounded-lg px-3 py-2 text-sm font-mono text-industrial-900 focus:outline-none focus:border-brand-500"
                />
              </label>
            </div>

            <label className="text-xs font-medium text-industrial-600">Número da CNH
              <input
                value={formMotorista.cnh}
                onChange={(e) => setFormMotorista({ ...formMotorista, cnh: e.target.value })}
                className="mt-1 w-full bg-industrial-50 border border-industrial-400 rounded-lg px-3 py-2 text-sm font-mono text-industrial-900 focus:outline-none focus:border-brand-500"
              />
            </label>

            <div className="border-t border-industrial-300 pt-3 mt-1">
              <p className="text-xs font-semibold text-industrial-700 mb-2">Placas do veículo</p>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs font-medium text-industrial-600">Placa cavalo
                  <input
                    value={formMotorista.placa_cavalo}
                    onChange={(e) => setFormMotorista({ ...formMotorista, placa_cavalo: e.target.value.toUpperCase() })}
                    placeholder="ABC1D23"
                    className="mt-1 w-full bg-industrial-50 border border-industrial-400 rounded-lg px-3 py-2 text-sm font-mono uppercase text-industrial-900 placeholder-industrial-500 focus:outline-none focus:border-brand-500"
                  />
                </label>
                <label className="text-xs font-medium text-industrial-600">Placa 1
                  <input
                    value={formMotorista.placa_1}
                    onChange={(e) => setFormMotorista({ ...formMotorista, placa_1: e.target.value.toUpperCase() })}
                    placeholder="ABC1D23"
                    className="mt-1 w-full bg-industrial-50 border border-industrial-400 rounded-lg px-3 py-2 text-sm font-mono uppercase text-industrial-900 placeholder-industrial-500 focus:outline-none focus:border-brand-500"
                  />
                </label>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-3">
                <label className="text-xs font-medium text-industrial-600">Placa 2
                  <input
                    value={formMotorista.placa_2}
                    onChange={(e) => setFormMotorista({ ...formMotorista, placa_2: e.target.value.toUpperCase() })}
                    placeholder="opcional"
                    className="mt-1 w-full bg-industrial-50 border border-industrial-400 rounded-lg px-3 py-2 text-sm font-mono uppercase text-industrial-900 placeholder-industrial-500 focus:outline-none focus:border-brand-500"
                  />
                </label>
                <label className="text-xs font-medium text-industrial-600">Placa 3
                  <input
                    value={formMotorista.placa_3}
                    onChange={(e) => setFormMotorista({ ...formMotorista, placa_3: e.target.value.toUpperCase() })}
                    placeholder="opcional"
                    className="mt-1 w-full bg-industrial-50 border border-industrial-400 rounded-lg px-3 py-2 text-sm font-mono uppercase text-industrial-900 placeholder-industrial-500 focus:outline-none focus:border-brand-500"
                  />
                </label>
                <label className="text-xs font-medium text-industrial-600">Placa 4
                  <input
                    value={formMotorista.placa_4}
                    onChange={(e) => setFormMotorista({ ...formMotorista, placa_4: e.target.value.toUpperCase() })}
                    placeholder="opcional"
                    className="mt-1 w-full bg-industrial-50 border border-industrial-400 rounded-lg px-3 py-2 text-sm font-mono uppercase text-industrial-900 placeholder-industrial-500 focus:outline-none focus:border-brand-500"
                  />
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setFormMotorista(null)}
                className="rounded-lg border border-industrial-400 px-4 py-2 text-sm font-medium text-industrial-700 hover:bg-industrial-200">Cancelar</button>
              <button
                type="button"
                onClick={salvarMotorista}
                disabled={
                  salvandoMotorista ||
                  !formMotorista.nome.trim() ||
                  formMotorista.whatsapp.replace(/\D/g, '').length < 10 ||
                  formMotorista.cpf.replace(/\D/g, '').length !== 11 ||
                  !formMotorista.rg.trim() ||
                  !formMotorista.cnh.trim() ||
                  !formMotorista.placa_cavalo.trim() ||
                  !formMotorista.placa_1.trim()
                }
                className="rounded-lg bg-brand-700 hover:bg-brand-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {salvandoMotorista ? 'Salvando…' : formMotorista.id ? 'Salvar' : 'Cadastrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
