'use client'

import { useState, useCallback } from 'react'
import { Upload, CheckCircle, AlertCircle, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { FormulasService } from '@/services/formulas.service'
import { cn } from '@/lib/utils/cn'
import type { Formula } from '@/types/formula'

// CSV column order (matches our Excel/Google Sheets template)
const CSV_COLUMNS = [
  'nome',
  'mo',
  'map',
  'calcario_concha',
  'sulfato_amonia',
  'carbonato_ca_mg',
  'ureia',
  'cloreto_potassio',
  'boro',
  'enxofre_pastilhado',
  'fte_br_12',
  'oxmag_s',
  'tsp',
  'caltimag',
  'hiphos_25',
] as const

type ParsedRow = Omit<Formula, 'id' | 'created_at' | 'updated_at'>

function parseCSV(text: string): { rows: ParsedRow[]; errors: string[] } {
  const lines = text.trim().split(/\r?\n/)
  const errors: string[] = []
  const rows: ParsedRow[] = []

  const header = lines[0].split(/[,;]/).map((h) => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'))

  // Detect column mapping by checking if header matches expected columns
  const hasHeader = CSV_COLUMNS.some((col) => header.includes(col))
  const startLine = hasHeader ? 1 : 0

  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const parts = line.split(/[,;]/).map((p) => p.trim().replace(/^["']|["']$/g, ''))

    if (hasHeader) {
      const row: Record<string, string> = {}
      header.forEach((col, j) => { row[col] = parts[j] ?? '0' })

      const nome = row['nome']?.trim()
      if (!nome) { errors.push(`Linha ${i + 1}: nome vazio`); continue }

      const parsed = {
        nome,
        ativo: true,
      } as ParsedRow

      const numericCols = CSV_COLUMNS.slice(1) as readonly string[]
      let valid = true
      for (const col of numericCols) {
        const val = parseFloat((row[col] ?? '0').replace(',', '.'))
        if (isNaN(val) || val < 0 || val > 1) {
          errors.push(`Linha ${i + 1} (${nome}): valor inválido em "${col}": ${row[col]}`)
          valid = false
          break
        }
        ;(parsed as Record<string, unknown>)[col] = val
      }
      if (valid) rows.push(parsed)
    } else {
      // No header: assume fixed column order
      if (parts.length < CSV_COLUMNS.length) { errors.push(`Linha ${i + 1}: menos de ${CSV_COLUMNS.length} colunas`); continue }

      const nome = parts[0]
      if (!nome) { errors.push(`Linha ${i + 1}: nome vazio`); continue }

      const parsed = { nome, ativo: true } as ParsedRow
      let valid = true
      for (let j = 1; j < CSV_COLUMNS.length; j++) {
        const val = parseFloat((parts[j] ?? '0').replace(',', '.'))
        const col = CSV_COLUMNS[j]
        if (isNaN(val) || val < 0 || val > 1) {
          errors.push(`Linha ${i + 1} (${nome}): valor inválido em coluna ${j + 1}: ${parts[j]}`)
          valid = false
          break
        }
        ;(parsed as Record<string, unknown>)[col] = val
      }
      if (valid) rows.push(parsed)
    }
  }

  return { rows, errors }
}

export function ImportarFormulasClient() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ParsedRow[]>([])
  const [parseErrors, setParseErrors] = useState<string[]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ count: number } | null>(null)

  const svc = new FormulasService(createClient())

  const handleFile = useCallback((f: File) => {
    setFile(f)
    setResult(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const { rows, errors } = parseCSV(text)
      setPreview(rows)
      setParseErrors(errors)
    }
    reader.readAsText(f, 'UTF-8')
  }, [])

  async function handleImport() {
    if (!preview.length) return
    setImporting(true)
    try {
      const count = await svc.upsertMany(preview)
      setResult({ count })
      setFile(null)
      setPreview([])
      toast.success(`${count} fórmulas importadas com sucesso.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao importar.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6 flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-industrial-100">Importar Fórmulas</h1>
        <p className="text-sm text-industrial-400 mt-1">
          Exporte a planilha de fórmulas como CSV e faça upload aqui. Fórmulas com o mesmo nome serão atualizadas.
        </p>
      </div>

      {/* Template info */}
      <div className="rounded-lg bg-industrial-900 border border-industrial-700 p-4">
        <p className="text-xs text-industrial-300 font-medium mb-2">Formato esperado (cabeçalho opcional):</p>
        <code className="text-[10px] text-brand-400 break-all">
          nome; mo; map; calcario_concha; sulfato_amonia; carbonato_ca_mg; ureia; cloreto_potassio; enxofre_pastilhado; oxmag_s; tsp; caltimag; hiphos_25
        </code>
        <p className="text-[10px] text-industrial-500 mt-2">
          Valores decimais entre 0 e 1 (proporção). Separador: vírgula ou ponto e vírgula.
        </p>
      </div>

      {/* Drop zone */}
      <label
        className={cn(
          'flex flex-col items-center justify-center gap-3 p-10 rounded-xl border-2 border-dashed',
          'cursor-pointer transition-colors',
          'border-industrial-600 hover:border-brand-600 bg-industrial-900/50 hover:bg-industrial-900',
        )}
      >
        <Upload className="size-8 text-industrial-400" />
        <div className="text-center">
          <p className="text-sm text-industrial-200 font-medium">Clique para selecionar o arquivo CSV</p>
          <p className="text-xs text-industrial-500 mt-0.5">ou arraste e solte aqui</p>
        </div>
        {file && (
          <div className="flex items-center gap-2 text-xs text-brand-400">
            <FileText className="size-4" />
            {file.name}
          </div>
        )}
        <input
          type="file"
          accept=".csv,.txt"
          className="sr-only"
          onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }}
        />
      </label>

      {/* Parse errors */}
      {parseErrors.length > 0 && (
        <div className="rounded-lg bg-red-950/50 border border-red-800 p-4">
          <div className="flex items-center gap-2 text-red-400 font-medium text-sm mb-2">
            <AlertCircle className="size-4" />
            {parseErrors.length} linha(s) ignorada(s)
          </div>
          <ul className="text-xs text-red-300 space-y-0.5 max-h-40 overflow-y-auto">
            {parseErrors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      {/* Preview */}
      {preview.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-industrial-300">
            <span className="font-semibold text-brand-400">{preview.length}</span> fórmulas prontas para importar
          </p>
          <div className="overflow-x-auto rounded-lg border border-industrial-700 max-h-64">
            <table className="w-full text-[11px]">
              <thead>
                <tr>
                  {CSV_COLUMNS.map((col) => (
                    <th key={col} className="px-2 py-1.5 text-left text-industrial-400 bg-industrial-900 border-b border-industrial-700 whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 20).map((row, i) => (
                  <tr key={i} className="hover:bg-industrial-800/40">
                    <td className="px-2 py-1 text-industrial-100 whitespace-nowrap">{row.nome}</td>
                    {CSV_COLUMNS.slice(1).map((col) => (
                      <td key={col} className="px-2 py-1 text-right font-mono text-industrial-300">
                        {(row as Record<string, unknown>)[col] as number}
                      </td>
                    ))}
                  </tr>
                ))}
                {preview.length > 20 && (
                  <tr>
                    <td colSpan={13} className="px-2 py-1 text-industrial-500 text-center">
                      … e mais {preview.length - 20} fórmulas
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            onClick={handleImport}
            disabled={importing}
            className={cn(
              'self-start flex items-center gap-2 px-5 py-2 rounded-lg',
              'bg-brand-700 hover:bg-brand-600 text-white text-sm font-medium',
              'transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            {importing ? 'Importando…' : `Importar ${preview.length} fórmulas`}
          </button>
        </div>
      )}

      {/* Success */}
      {result && (
        <div className="flex items-center gap-3 rounded-lg bg-brand-900/30 border border-brand-700 p-4">
          <CheckCircle className="size-5 text-brand-400 shrink-0" />
          <p className="text-sm text-brand-300">
            <span className="font-semibold">{result.count}</span> fórmulas importadas com sucesso.
          </p>
        </div>
      )}

      {/* Google Sheets auto-sync guide */}
      <details className="rounded-lg border border-industrial-700 bg-industrial-900/30">
        <summary className="px-4 py-3 text-sm font-medium text-industrial-300 cursor-pointer select-none">
          Como configurar sincronização automática com Google Sheets
        </summary>
        <div className="px-4 pb-4 pt-2 text-xs text-industrial-400 space-y-3">
          <p>Para sincronizar automaticamente ao salvar a planilha, crie um Apps Script no Google Sheets:</p>
          <ol className="list-decimal list-inside space-y-1.5 text-industrial-300">
            <li>Abra o Google Sheets → Extensões → Apps Script</li>
            <li>Cole o código abaixo e substitua a URL pelo endpoint de importação</li>
            <li>Configure um gatilho: Editar → Gatilhos do projeto → Ao editar</li>
          </ol>
          <pre className="bg-industrial-900 border border-industrial-700 rounded p-3 text-[10px] text-brand-300 overflow-x-auto whitespace-pre">{`function sincronizarFormulas() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const rows = data.slice(1).filter(r => r[0]);

  const payload = rows.map(r => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = r[i]; });
    return obj;
  });

  UrlFetchApp.fetch('https://SEU_DOMINIO/api/formulas/sync', {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-sync-key': 'CHAVE_SECRETA' },
    payload: JSON.stringify(payload),
  });
}`}</pre>
          <p className="text-industrial-500">
            O endpoint <code className="text-industrial-300">/api/formulas/sync</code> ainda não foi implementado.
            Por ora, use o upload CSV acima.
          </p>
        </div>
      </details>
    </div>
  )
}
