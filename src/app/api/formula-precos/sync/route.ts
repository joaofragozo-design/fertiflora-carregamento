import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

interface PrecoRow {
  nome: string;
  preco_usd_avista: number;
}

/** Converte valor da planilha em número, tolerando string, "$", vírgula decimal e espaços. */
function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const limpo = value.replace(/[^\d,.-]/g, "").replace(",", ".").trim();
    const parsed = parseFloat(limpo);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** Mantém só `nome` + `preco_usd_avista`. Linha sem nome ou sem preço válido (>0) é ignorada. */
function sanitizeRow(raw: Record<string, unknown>): PrecoRow | null {
  const nome = String(raw["nome"] ?? "").trim();
  if (!nome) return null;

  const preco = toNumber(raw["preco_usd_avista"]);
  if (preco === null || preco <= 0) return null;

  return { nome, preco_usd_avista: preco };
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

  if (!Array.isArray(body)) {
    return NextResponse.json(
      { error: "Payload deve ser um array de { nome, preco_usd_avista }." },
      { status: 400 }
    );
  }

  const linhas = body
    .filter(
      (linha): linha is Record<string, unknown> =>
        linha !== null && typeof linha === "object" && !Array.isArray(linha)
    )
    .map(sanitizeRow)
    .filter((linha): linha is PrecoRow => linha !== null);

  if (linhas.length === 0) {
    return NextResponse.json(
      {
        error:
          "Nenhuma fórmula com nome e preço válidos no payload. Verifique as colunas 'nome' e 'preco_usd_avista'.",
      },
      { status: 400 }
    );
  }

  // DEDUPE: `nome` é único na tabela; mantém a última ocorrência (mais recente na planilha).
  const porNome = new Map<string, PrecoRow>();
  const nomesDuplicados = new Set<string>();
  for (const linha of linhas) {
    if (porNome.has(linha.nome)) nomesDuplicados.add(linha.nome);
    porNome.set(linha.nome, linha);
  }
  const unicas = Array.from(porNome.values());

  const { error } = await supabaseAdmin
    .from("formula_precos")
    .upsert(unicas, { onConflict: "nome" });

  if (error) {
    console.error("[formula-precos/sync]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // RECONCILIAÇÃO: a planilha é a fonte de verdade. Remove do banco as fórmulas cujo nome não
  // existe mais na planilha (renomeada, removida). Guarda de segurança: só reconcilia com um
  // volume plausível de linhas, pra nunca esvaziar a tabela caso a leitura venha vazia/parcial.
  let removidas = 0;
  const nomesNaPlanilha = new Set(unicas.map((l) => l.nome));

  if (nomesNaPlanilha.size >= 50) {
    const { data: existentes } = await supabaseAdmin
      .from("formula_precos")
      .select("id, nome");

    const orfas = ((existentes ?? []) as { id: number; nome: string }[])
      .filter((f) => !nomesNaPlanilha.has(f.nome))
      .map((f) => f.id);

    if (orfas.length > 0) {
      const { error: delErr } = await supabaseAdmin
        .from("formula_precos")
        .delete()
        .in("id", orfas);

      if (delErr) {
        console.error("[formula-precos/sync] reconciliação", delErr);
      } else {
        removidas = orfas.length;
      }
    }
  }

  return NextResponse.json({
    ok: true,
    importadas: unicas.length,
    removidas,
    duplicadas: Array.from(nomesDuplicados),
  });
}
