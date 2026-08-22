// Teste manual do envio do relatório via Gmail SMTP.
// Uso: node scripts/teste-relatorio-smtp.mjs [YYYY-MM-DD] [destino]
// Envia SÓ para o destino informado (padrão: GMAIL_USER), sem tocar nos destinatários reais.
import nodemailer from 'nodemailer'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^"|"$/g, '')]),
)

const data = process.argv[2] ?? new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
const destino = process.argv[3] ?? env.GMAIL_USER

const H = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` }
const select = encodeURIComponent('*,itens:ordem_itens(*,formula:formulas(*))')
const r = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/ordens_diarias?select=${select}&data=eq.${data}&order=sequencia.asc`, { headers: H })
const ordens = await r.json()
console.log(`Data ${data}: ${ordens.length} ordens`)

const linhas = ordens
  .map((o) => `<tr><td style="padding:4px 8px;border-bottom:1px solid #eee;">${o.cliente}</td><td style="padding:4px 8px;border-bottom:1px solid #eee;font-family:monospace;">${o.placa ?? '—'}</td><td style="padding:4px 8px;border-bottom:1px solid #eee;">${(o.itens ?? []).length} itens</td></tr>`)
  .join('')

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: { user: env.GMAIL_USER, pass: env.GMAIL_APP_PASSWORD },
})

const info = await transporter.sendMail({
  from: `Fertiflora Carregamento <${env.GMAIL_USER}>`,
  to: destino,
  subject: `[TESTE] Relatório Diário — ${data}`,
  html: `<div style="font-family:Arial,sans-serif;"><h2>Teste do novo envio via Gmail SMTP</h2><p>${ordens.length} ordens em ${data}:</p><table style="border-collapse:collapse;font-size:13px;">${linhas}</table><p style="color:#999;font-size:11px;">Se você recebeu este e-mail, o SMTP está funcionando.</p></div>`,
})
console.log('Enviado:', info.messageId, '→', destino)
