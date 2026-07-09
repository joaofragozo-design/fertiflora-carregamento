import type { SupabaseClient } from '@supabase/supabase-js'
import type { OrdemDiaria, Formula } from '@/types/formula'
import {
  MATERIAS_PRIMA,
  EMBALAGEM_LABEL,
  calcularMateriaPrima,
  labelMateriaPrima,
  calcularTons,
  tonsDaOrdem,
  getStatus,
  formatDuracao,
  tonPorHora,
} from '@/types/formula'

const STATUS_LABEL: Record<string, string> = {
  AGUARDANDO: 'Aguardando',
  EM_ANDAMENTO: 'Em andamento',
  FINALIZADO: 'Finalizado',
}

export const EMAIL_DESTINO = process.env.RELATORIO_EMAIL_PARA || 'comercial@fertiflora.com'

/** Data de hoje no fuso de Brasília (nunca UTC — servidor roda em UTC e viraria o dia às 21h). */
export function hojeBrasil(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}

/** Lê uma lista de e-mails separada por vírgula de uma env var, ignorando vazios. */
export function lerListaEmails(valor: string | undefined): string[] {
  if (!valor) return []
  return valor.split(',').map((e) => e.trim()).filter(Boolean)
}

function fmtKg(n: number): string {
  return n.toFixed(1).replace(/\.0$/, '')
}
function fmtNum(n: number, casas = 0): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })
}

/** Monta o HTML do e-mail (tabelas com estilo inline — necessário para clientes de e-mail). */
function montarHtml(ordens: OrdemDiaria[], data: string): string {
  const totalTons = ordens.reduce((s, o) => s + tonsDaOrdem(o), 0)

  // Agrupa por RÓTULO (não pela chave da coluna) porque a mesma coluna
  // `caltimag` pode representar CALTIMAG numa fórmula e FERTIMAG noutra.
  const consumoAcc: Record<string, number> = {}
  for (const o of ordens) {
    for (const item of o.itens ?? []) {
      const f = item.formula as Formula | undefined
      if (!f) continue
      const tons = item.tons ?? calcularTons(item.quantidade, item.embalagem)
      for (const mp of MATERIAS_PRIMA) {
        const kgPorTon = calcularMateriaPrima(f, mp.key)
        if (kgPorTon > 0) {
          const label = labelMateriaPrima(f, mp.key)
          consumoAcc[label] = (consumoAcc[label] ?? 0) + tons * kgPorTon
        }
      }
    }
  }
  const consumo = Object.entries(consumoAcc)
    .map(([label, kg]) => ({ label, kg }))
    .sort((a, b) => b.kg - a.kg)

  const dataLonga = new Date(data + 'T12:00:00').toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  })

  const linhasOrdens = ordens.flatMap((o) => {
    const status = getStatus(o)
    const itens = o.itens ?? []
    const tonsCarga = tonsDaOrdem(o)
    const durMs = o.iniciado_em && o.finalizado_em
      ? new Date(o.finalizado_em).getTime() - new Date(o.iniciado_em).getTime()
      : 0
    const tempoRitmo = durMs > 0
      ? `${formatDuracao(durMs)} · ${tonPorHora(tonsCarga, durMs).toFixed(2)} t/h`
      : '—'

    if (itens.length === 0) {
      return [`
        <tr>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${o.cliente || '—'}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${o.placa || '—'}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${STATUS_LABEL[status]}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;color:#9ca3af;" colspan="3">Sem itens</td>
        </tr>
      `]
    }

    return itens.map((item, idx) => {
      const f = item.formula as Formula | undefined
      const tons = item.tons ?? calcularTons(item.quantidade, item.embalagem)
      const usados = f
        ? MATERIAS_PRIMA.map((mp) => ({ label: labelMateriaPrima(f, mp.key), kg: calcularMateriaPrima(f, mp.key) })).filter((x) => x.kg > 0)
        : []
      const materiaTexto = usados.map((x) => `${x.label} ${fmtKg(x.kg)}`).join(', ')

      return `
        <tr>
          ${idx === 0 ? `
            <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-weight:600;">${o.cliente || '—'}</td>
            <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-family:monospace;">${o.placa || '—'}</td>
            <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${STATUS_LABEL[status]}<br><span style="color:#6b7280;font-size:11px;">${tempoRitmo}</span></td>
          ` : `<td colspan="3" style="border-bottom:1px solid #e5e7eb;"></td>`}
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${item.quantidade} ${EMBALAGEM_LABEL[item.embalagem]}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-weight:600;color:#15803d;">${tons.toFixed(2)} ton</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">
            <div style="font-weight:600;">${f?.nome ?? '—'}</div>
            <div style="color:#6b7280;font-size:11px;">${materiaTexto}</div>
          </td>
        </tr>
      `
    }).join('')
  }).join('')

  const linhasConsumo = consumo.map(({ label, kg }) => `
    <tr>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${label}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;">${fmtNum(kg)} kg</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;">${fmtNum(kg / 1000, 2)} ton</td>
    </tr>
  `).join('')

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;color:#111827;max-width:720px;margin:0 auto;">
    <h1 style="font-size:18px;margin-bottom:4px;">FERTIFLORA — Relatório Diário de Carregamento</h1>
    <p style="color:#6b7280;text-transform:capitalize;margin-top:0;">${dataLonga}</p>
    <p style="margin:12px 0;">
      <strong>Cargas:</strong> ${ordens.length} &nbsp;·&nbsp;
      <strong>Total do dia:</strong> <span style="color:#15803d;font-weight:700;">${totalTons.toFixed(2)} ton</span>
    </p>

    <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:24px;">
      <thead>
        <tr style="background:#f3f4f6;text-align:left;">
          <th style="padding:6px 8px;">Cliente</th>
          <th style="padding:6px 8px;">Placa</th>
          <th style="padding:6px 8px;">Status</th>
          <th style="padding:6px 8px;">Quant.</th>
          <th style="padding:6px 8px;">Tons</th>
          <th style="padding:6px 8px;">Fórmula / Matéria-prima</th>
        </tr>
      </thead>
      <tbody>${linhasOrdens || '<tr><td colspan="6" style="padding:12px;text-align:center;color:#9ca3af;">Nenhuma ordem neste dia.</td></tr>'}</tbody>
    </table>

    ${consumo.length > 0 ? `
      <h2 style="font-size:14px;margin-bottom:8px;">Consumo de matéria-prima do dia</h2>
      <table style="border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:#f3f4f6;text-align:left;">
            <th style="padding:6px 8px;">Matéria-prima</th>
            <th style="padding:6px 8px;text-align:right;">Total (kg)</th>
            <th style="padding:6px 8px;text-align:right;">Total (ton)</th>
          </tr>
        </thead>
        <tbody>${linhasConsumo}</tbody>
      </table>
    ` : ''}

    <p style="color:#9ca3af;font-size:11px;margin-top:24px;">Relatório gerado automaticamente pelo sistema de carregamento Fertiflora.</p>
  </div>
  `
}

export type ResultadoEnvioRelatorio =
  | { ok: true; para: string; cc: string[] }
  | { error: string; status: number }

/**
 * Monta e envia o relatório diário por e-mail. Usado tanto pelo botão manual
 * (sessão do usuário, RLS ativo) quanto pelo cron automático (service role,
 * sem sessão — por isso recebe o client já pronto em vez de criar um).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function enviarRelatorioDiario(supabase: SupabaseClient<any>, data: string): Promise<ResultadoEnvioRelatorio> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return { error: 'Envio de e-mail não configurado. Peça ao administrador para configurar a RESEND_API_KEY.', status: 503 }
  }

  const { data: ordens, error: dbError } = await supabase
    .from('ordens_diarias')
    .select(`
      *,
      itens:ordem_itens (
        *,
        formula:formulas (
          id, nome, mo, map, calcario_concha, sulfato_amonia, carbonato_ca_mg,
          ureia, cloreto_potassio, boro, enxofre_pastilhado, fte_br_12, oxmag_s, tsp, caltimag, hiphos_25,
          ativo, created_at, updated_at
        )
      )
    `)
    .eq('data', data)
    .order('sequencia', { ascending: true })
    .order('created_at', { foreignTable: 'ordem_itens', ascending: true })

  if (dbError) {
    console.error('[relatorio-email] db', dbError)
    return { error: 'Erro ao carregar os dados do relatório.', status: 500 }
  }

  const html = montarHtml((ordens ?? []) as OrdemDiaria[], data)
  const dataFormatada = new Date(data + 'T12:00:00').toLocaleDateString('pt-BR')
  const cc = lerListaEmails(process.env.RELATORIO_EMAIL_CC)

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM || 'Fertiflora <onboarding@resend.dev>',
      to: [EMAIL_DESTINO],
      ...(cc.length > 0 ? { cc } : {}),
      subject: `Relatório Diário de Carregamento — ${dataFormatada}`,
      html,
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    console.error('[relatorio-email] resend', errText)
    return { error: 'Erro ao enviar o e-mail. Tente novamente.', status: 502 }
  }

  return { ok: true, para: EMAIL_DESTINO, cc }
}
