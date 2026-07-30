import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { LogoMark } from '@/components/brand/logo'
import { MATERIAS_PRIMA } from '@/types/formula'
import { ChegadaClient } from './_chegada-client'

export const metadata: Metadata = {
  title: 'Confirmar chegada — Fertiflora',
}

function ddmm(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

export default async function ChegadaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const { data: recebimento } = await supabaseAdmin
    .from('recebimentos_previstos')
    .select('id, data_prevista, materia_prima, materia_prima_key, quantidade_ton, confirmado_em, fornecedor, fornecedor_id, fornecedor_rel:fornecedores ( nome )')
    .eq('id', id)
    .single()

  if (!recebimento) notFound()

  const materiaPrima = MATERIAS_PRIMA.find((m) => m.key === recebimento.materia_prima_key)?.label
    ?? recebimento.materia_prima ?? 'Matéria-prima'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fornecedor = (recebimento as any).fornecedor_rel?.nome ?? recebimento.fornecedor ?? null

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-paper-50 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <LogoMark size={36} />
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-paper-500">
            Fertiflora · Confirmação de chegada
          </p>
        </div>

        <div className="relative overflow-hidden rounded-tl-2xl rounded-br-2xl rounded-tr-lg rounded-bl-lg border border-paper-300 bg-paper-100 p-6 shadow-editorial">
          <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-leaf-400 to-spruce-600" />

          <h1 className="font-display text-xl font-semibold text-paper-900">{materiaPrima}</h1>
          <p className="mt-1 text-sm text-paper-600">
            {(recebimento.quantidade_ton ?? 0).toFixed(2)} ton
            {fornecedor && <> · {fornecedor}</>}
            {' · '}{ddmm(recebimento.data_prevista)}
          </p>

          <div className="mt-6">
            <ChegadaClient recebimentoId={recebimento.id} jaConfirmado={!!recebimento.confirmado_em} />
          </div>
        </div>

        <p className="mt-6 text-center text-[11px] text-paper-500">
          © {new Date().getFullYear()} Fertiflora Organomineral.
        </p>
      </div>
    </main>
  )
}
