'use client'

import { useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, Save, Upload, Gauge, PenSquare } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { EstoqueService, type LinhaCsvEstoque } from '@/services/estoque.service'
import { MATERIAS_PRIMA } from '@/types/formula'
import type { EstoqueAtual, EstoqueConfig } from '@/types/estoque'
import { cn } from '@/lib/utils/cn'

interface EstoqueConfigPainelProps {
  initialConfig:      EstoqueConfig[]
  initialEstoqueAtual: EstoqueAtual[]
  usuario:            string
}

function normalizar(s: string): string {
  return s.trim().toLowerCase()
}

/** Faz o parse de um CSV simples de duas colunas (matéria-prima, quantidade em
 *  toneladas) — aceita nome (rótulo) ou chave da matéria-prima, com ou sem
 *  linha de cabeçalho. Separador: ';' se a linha tiver um (padrão Excel/
 *  Sheets em pt-BR, onde ',' é o decimal) — só usa ',' como separador se a
 *  linha não tiver ';' nenhum (CSV internacional, decimal com ponto). Nunca
 *  os dois ao mesmo tempo, senão "MAP;35,5" vira 3 colunas e perde o ",5". */
function parseCsvEstoque(texto: string): { linhas: LinhaCsvEstoque[]; erros: string[] } {
  const linhas: LinhaCsvEstoque[] = []
  const erros: string[] = []
  const linhasTexto = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)

  for (const [i, linha] of linhasTexto.entries()) {
    const usaPontoEVirgula = linha.includes(';')
    const partes = linha.split(usaPontoEVirgula ? ';' : ',').map((p) => p.trim())
    if (partes.length < 2) continue

    const [nomeOuChave, qtdTextoBruto] = partes
    const mp = MATERIAS_PRIMA.find(
      (m) => m.key === normalizar(nomeOuChave) || normalizar(m.label) === normalizar(nomeOuChave),
    )
    // pt-BR (';'): vírgula é decimal, ponto é milhar — remove pontos de
    // milhar ANTES de trocar a vírgula por ponto decimal (ex.: "1.234,56").
    // Internacional (','): número já vem com ponto decimal, sem alteração.
    const qtdTexto = usaPontoEVirgula ? qtdTextoBruto.replace(/\./g, '').replace(',', '.') : qtdTextoBruto
    const qtd = Number(qtdTexto)

    if (!mp) {
      // Só trata como cabeçalho se a primeira linha claramente parecer um
      // (contém uma palavra de cabeçalho) — senão um erro de digitação real
      // na primeira linha seria descartado sem avisar o usuário.
      const pareceCabecalho = i === 0 && /materia|prima|quantidade|produto|nome/i.test(nomeOuChave)
      if (pareceCabecalho) continue
      erros.push(`Linha ${i + 1}: matéria-prima "${nomeOuChave}" não reconhecida.`)
      continue
    }
    if (!Number.isFinite(qtd) || qtd <= 0) {
      erros.push(`Linha ${i + 1}: quantidade inválida ("${qtdTextoBruto}").`)
      continue
    }
    linhas.push({ materia_prima_key: mp.key, quantidade_ton: qtd })
  }

  return { linhas, erros }
}

/** Configuração dos limites do termômetro (por matéria-prima) + importação de
 *  CSV de estoque (soma ao saldo atual — não substitui). Só admin/logística. */
export function EstoqueConfigPainel({ initialConfig, initialEstoqueAtual, usuario }: EstoqueConfigPainelProps) {
  const [aberto, setAberto] = useState(false)
  const [config, setConfig] = useState(initialConfig)
  const [estoqueAtual, setEstoqueAtual] = useState(initialEstoqueAtual)
  const [salvandoKey, setSalvandoKey] = useState<string | null>(null)
  const [ajusteAberto, setAjusteAberto] = useState<string | null>(null)
  const [ajusteValor, setAjusteValor] = useState('')
  const [ajusteMotivo, setAjusteMotivo] = useState('')
  const [ajustando, setAjustando] = useState(false)
  const [csvTexto, setCsvTexto] = useState('')
  const [importando, setImportando] = useState(false)
  const svc = useRef(new EstoqueService(createClient())).current
  const fileInputRef = useRef<HTMLInputElement>(null)

  const configPorChave = useMemo(() => new Map(config.map((c) => [c.materia_prima_key, c])), [config])
  const estoquePorChave = useMemo(() => new Map(estoqueAtual.map((e) => [e.materia_prima_key, e])), [estoqueAtual])

  const preview = useMemo(() => parseCsvEstoque(csvTexto), [csvTexto])

  function abrirAjuste(key: string) {
    const atual = estoquePorChave.get(key)
    setAjusteAberto(key)
    setAjusteValor((atual?.quantidade_ton ?? 0).toFixed(3))
    setAjusteMotivo('')
  }

  async function confirmarAjuste(key: string) {
    const atual = estoquePorChave.get(key)
    const quantidadeAtual = atual?.quantidade_ton ?? 0
    const quantidadeNova = Number(ajusteValor.replace(',', '.'))
    if (!Number.isFinite(quantidadeNova) || quantidadeNova < 0) {
      toast.error('Informe uma quantidade válida.')
      return
    }
    setAjustando(true)
    try {
      await svc.ajustarManual(key, quantidadeAtual, quantidadeNova, usuario, ajusteMotivo)
      setEstoqueAtual((prev) =>
        prev.map((e) => (e.materia_prima_key === key ? { ...e, quantidade_ton: quantidadeNova, updated_at: new Date().toISOString() } : e)),
      )
      toast.success(`Estoque de ${MATERIAS_PRIMA.find((m) => m.key === key)?.label} ajustado para ${quantidadeNova.toFixed(3)} ton.`)
      setAjusteAberto(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao ajustar o estoque.')
    } finally {
      setAjustando(false)
    }
  }

  async function salvarLimites(key: string, campo: keyof Omit<EstoqueConfig, 'materia_prima_key' | 'updated_at'>, valor: string) {
    const atual = configPorChave.get(key)
    if (!atual) return
    const num = Number(valor.replace(',', '.')) || 0
    setSalvandoKey(key)
    try {
      const atualizado = await svc.atualizarConfig(key, {
        limite_perigo: campo === 'limite_perigo' ? num : atual.limite_perigo,
        limite_cuidado: campo === 'limite_cuidado' ? num : atual.limite_cuidado,
        limite_confortavel: campo === 'limite_confortavel' ? num : atual.limite_confortavel,
      })
      setConfig((prev) => prev.map((c) => (c.materia_prima_key === key ? atualizado : c)))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar limite.')
    } finally {
      setSalvandoKey(null)
    }
  }

  function onArquivoSelecionado(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0]
    if (!arquivo) return
    const reader = new FileReader()
    reader.onload = () => setCsvTexto(String(reader.result ?? ''))
    reader.readAsText(arquivo, 'utf-8')
    e.target.value = ''
  }

  async function importar() {
    if (preview.linhas.length === 0) {
      toast.error('Nenhuma linha válida pra importar.')
      return
    }
    setImportando(true)
    try {
      await svc.importarCsv(preview.linhas, usuario)
      toast.success(`${preview.linhas.length} lançamento(s) somado(s) ao estoque.`)
      setCsvTexto('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao importar CSV.')
    } finally {
      setImportando(false)
    }
  }

  return (
    <div className="rounded-xl border border-industrial-200">
      <button
        type="button"
        onClick={() => setAberto((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-industrial-800 hover:text-industrial-900"
      >
        <span className="flex items-center gap-2"><Gauge className="size-4 text-brand-600" /> Configurar estoque de matéria-prima</span>
        {aberto ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
      </button>

      {aberto && (
        <div className="px-4 pb-4 flex flex-col gap-5 border-t border-industrial-200 pt-4">
          {/* Limites do termômetro */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-industrial-600 mb-2">
              Limites do termômetro (toneladas) — abaixo de &ldquo;perigo&rdquo; acende vermelho, abaixo de &ldquo;cuidado&rdquo; acende amarelo, acima de &ldquo;confortável&rdquo; fica bem tranquilo.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse min-w-[560px]">
                <thead>
                  <tr className="text-left text-industrial-500">
                    <th className="py-1.5 pr-2">Matéria-prima</th>
                    <th className="py-1.5 px-2">Perigo (≤)</th>
                    <th className="py-1.5 px-2">Cuidado (≤)</th>
                    <th className="py-1.5 px-2">Confortável (≤)</th>
                  </tr>
                </thead>
                <tbody>
                  {MATERIAS_PRIMA.map((mp) => {
                    const c = configPorChave.get(mp.key)
                    if (!c) return null
                    return (
                      <tr key={mp.key} className={cn('border-t border-industrial-200', salvandoKey === mp.key && 'opacity-50')}>
                        <td className="py-1.5 pr-2 font-medium text-industrial-800">{mp.label}</td>
                        {(['limite_perigo', 'limite_cuidado', 'limite_confortavel'] as const).map((campo) => (
                          <td key={campo} className="py-1.5 px-2">
                            <input
                              type="number"
                              defaultValue={c[campo]}
                              onBlur={(e) => {
                                if (Number(e.target.value) !== c[campo]) salvarLimites(mp.key, campo, e.target.value)
                              }}
                              disabled={salvandoKey === mp.key}
                              className="w-20 bg-industrial-50 border border-industrial-400 rounded px-1.5 py-1 text-industrial-900 font-mono focus:outline-none focus:border-brand-500"
                            />
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Ajuste manual do saldo */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-industrial-600 mb-2">
              Ajustar saldo manualmente — corrige o estoque de uma matéria-prima pra um valor exato (contagem física, erro de lançamento etc.)
            </p>
            <div className="flex flex-col gap-1.5">
              {MATERIAS_PRIMA.map((mp) => {
                const e = estoquePorChave.get(mp.key)
                if (!e) return null
                const emEdicao = ajusteAberto === mp.key
                return (
                  <div
                    key={mp.key}
                    className={cn(
                      'rounded-lg border px-3 py-2',
                      emEdicao ? 'border-warning-500/50 bg-warning-500/8' : 'border-industrial-200',
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-medium text-industrial-800">{mp.label}</span>
                      {emEdicao ? (
                        <div className="flex flex-1 items-center gap-2 justify-end flex-wrap">
                          <input
                            type="number"
                            autoFocus
                            value={ajusteValor}
                            onChange={(ev) => setAjusteValor(ev.target.value)}
                            disabled={ajustando}
                            className="w-24 bg-industrial-50 border border-industrial-400 rounded px-1.5 py-1 text-xs text-industrial-900 font-mono focus:outline-none focus:border-warning-500"
                          />
                          <input
                            type="text"
                            value={ajusteMotivo}
                            onChange={(ev) => setAjusteMotivo(ev.target.value)}
                            placeholder="motivo (opcional)"
                            disabled={ajustando}
                            className="w-40 bg-industrial-50 border border-industrial-400 rounded px-1.5 py-1 text-xs text-industrial-900 placeholder-industrial-500 focus:outline-none focus:border-warning-500"
                          />
                          <button
                            type="button"
                            onClick={() => confirmarAjuste(mp.key)}
                            disabled={ajustando}
                            className="flex items-center gap-1 rounded-md bg-warning-500 hover:bg-warning-400 text-white px-2.5 py-1 text-xs font-semibold disabled:opacity-50"
                          >
                            <Save className="size-3" /> {ajustando ? 'Salvando…' : 'Confirmar'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setAjusteAberto(null)}
                            disabled={ajustando}
                            className="rounded-md px-2 py-1 text-xs font-medium text-industrial-600 hover:text-industrial-900"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xs font-bold text-industrial-900">{e.quantidade_ton.toFixed(3)} ton</span>
                          <button
                            type="button"
                            onClick={() => abrirAjuste(mp.key)}
                            className="flex items-center gap-1 text-xs font-medium text-industrial-600 hover:text-brand-700 transition-colors"
                          >
                            <PenSquare className="size-3.5" /> Ajustar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Importação de CSV */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-industrial-600 mb-2">
              Importar CSV de estoque (soma ao saldo atual — duas colunas: matéria-prima, quantidade em toneladas)
            </p>
            <div className="flex items-center gap-2 mb-2">
              <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={onArquivoSelecionado} className="hidden" />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 rounded-lg border border-industrial-400 px-3 py-2 text-xs font-medium text-industrial-700 hover:border-brand-500 hover:text-brand-700 transition-colors"
              >
                <Upload className="size-3.5" /> Escolher arquivo CSV
              </button>
            </div>
            <textarea
              value={csvTexto}
              onChange={(e) => setCsvTexto(e.target.value)}
              placeholder={'ou cole aqui, ex.:\nMAP,120\nUREIA,80'}
              rows={4}
              className="w-full bg-industrial-50 border border-industrial-400 rounded-lg px-3 py-2 text-xs font-mono text-industrial-900 placeholder-industrial-500 focus:outline-none focus:border-brand-500"
            />
            {csvTexto.trim() && (
              <div className="mt-2 text-xs">
                {preview.linhas.length > 0 && (
                  <p className="text-brand-700 font-medium mb-1">
                    {preview.linhas.length} linha(s) prontas: {preview.linhas.map((l) => `${MATERIAS_PRIMA.find((m) => m.key === l.materia_prima_key)?.label} +${l.quantidade_ton}t`).join(', ')}
                  </p>
                )}
                {preview.erros.length > 0 && (
                  <p className="text-red-600">{preview.erros.join(' · ')}</p>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={importar}
              disabled={importando || preview.linhas.length === 0}
              className="mt-2 flex items-center gap-1.5 rounded-lg bg-brand-700 hover:bg-brand-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              <Save className="size-4" /> {importando ? 'Importando…' : 'Somar ao estoque'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
