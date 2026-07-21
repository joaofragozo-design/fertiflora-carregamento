import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** Converte valor da planilha em número, tolerando string, "%", vírgula decimal e espaços. */
function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const limpo = value.replace(/[^\d,.-]/g, "").replace(",", ".").trim();
    const parsed = parseFloat(limpo);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export async function POST(req: NextRequest) {
  if (req.headers.get("x-sync-key") !== process.env.FORMULAS_SYNC_KEY) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Payload deve ser um objeto { taxa_am, taxa_mp }." }, { status: 400 });
  }

  const taxaAm = toNumber((body as Record<string, unknown>)["taxa_am"]);
  const taxaMp = toNumber((body as Record<string, unknown>)["taxa_mp"]);

  if (taxaAm === null || taxaAm <= 0 || taxaMp === null || taxaMp <= 0) {
    return NextResponse.json(
      { error: "taxa_am e taxa_mp precisam ser números válidos (>0). Verifique as células de origem." },
      { status: 400 }
    );
  }

  const { data: existente } = await supabaseAdmin
    .from("taxas_juros_cotacao")
    .select("id")
    .limit(1)
    .maybeSingle();

  const { error } = existente
    ? await supabaseAdmin
        .from("taxas_juros_cotacao")
        .update({ taxa_am: taxaAm, taxa_mp: taxaMp, atualizado_em: new Date().toISOString() })
        .eq("id", existente.id)
    : await supabaseAdmin
        .from("taxas_juros_cotacao")
        .insert({ taxa_am: taxaAm, taxa_mp: taxaMp });

  if (error) {
    console.error("[taxas-juros/sync]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, taxa_am: taxaAm, taxa_mp: taxaMp });
}
