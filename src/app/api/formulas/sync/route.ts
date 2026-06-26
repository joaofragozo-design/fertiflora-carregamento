import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Colunas numéricas válidas da tabela `formulas`. Esta lista é a única fonte de
// verdade do que a API aceita — qualquer chave fora dela (ex.: cabeçalho vazio
// na planilha) é descartada antes de chegar ao banco.
const COLUNAS_NUMERICAS = [
  "mo",
  "map",
  "calcario_concha",
  "sulfato_amonia",
  "carbonato_ca_mg",
  "ureia",
  "cloreto_potassio",
  "enxofre_pastilhado",
  "oxmag_s",
  "tsp",
  "caltimag",
  "hiphos_25",
] as const;

interface FormulaRow {
  nome: string;
  [coluna: string]: string | number;
}

/** Converte valor da planilha em número, tolerando string e vírgula decimal. */
function toNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = parseFloat(value.replace(",", ".").trim());
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

/** Mantém só `nome` + colunas conhecidas. Linha sem nome é ignorada (retorna null). */
function sanitizeRow(raw: Record<string, unknown>): FormulaRow | null {
  const nome = String(raw["nome"] ?? "").trim();
  if (!nome) return null;

  const row: FormulaRow = { nome };
  for (const coluna of COLUNAS_NUMERICAS) {
    row[coluna] = toNumber(raw[coluna]);
  }
  return row;
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
      { error: "Payload deve ser um array de fórmulas." },
      { status: 400 }
    );
  }

  // Limpa cada linha: descarta não-objetos, cabeçalhos vazios/desconhecidos e
  // linhas sem nome. O banco recebe apenas colunas que existem de fato.
  const formulas = body
    .filter(
      (linha): linha is Record<string, unknown> =>
        linha !== null && typeof linha === "object" && !Array.isArray(linha)
    )
    .map(sanitizeRow)
    .filter((linha): linha is FormulaRow => linha !== null);

  if (formulas.length === 0) {
    return NextResponse.json(
      {
        error:
          "Nenhuma fórmula válida no payload. Verifique se a planilha tem a coluna 'nome' preenchida.",
      },
      { status: 400 }
    );
  }

  const { error } = await supabaseAdmin
    .from("formulas")
    .upsert(formulas, { onConflict: "nome" });

  if (error) {
    console.error("[formulas/sync]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, registros: formulas.length });
}
