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
  "boro",
  "enxofre_pastilhado",
  "fte_br_12",
  "oxmag_s",
  "tsp",
  "caltimag",
  "hiphos_25",
] as const;

// Invariante do domínio: a soma das proporções de uma fórmula deve fechar em
// 1,0000 (= 1000 kg/ton). Tolerância cobre arredondamento de 4 casas decimais.
const SOMA_ALVO = 1;
const TOLERANCIA = 0.005;

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

/** Soma das proporções (deve ser ~1,0000 numa fórmula correta). */
function somaProporcoes(row: FormulaRow): number {
  return COLUNAS_NUMERICAS.reduce((acc, col) => acc + Number(row[col]), 0);
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
  const linhas = body
    .filter(
      (linha): linha is Record<string, unknown> =>
        linha !== null && typeof linha === "object" && !Array.isArray(linha)
    )
    .map(sanitizeRow)
    .filter((linha): linha is FormulaRow => linha !== null);

  if (linhas.length === 0) {
    return NextResponse.json(
      {
        error:
          "Nenhuma fórmula com nome no payload. Verifique se a coluna 'nome' está preenchida.",
      },
      { status: 400 }
    );
  }

  // DEDUPE: a tabela tem `nome` único e o upsert quebra se o lote tiver nomes
  // repetidos. Mantém a última ocorrência (mais recente na planilha) e registra
  // os nomes duplicados para o usuário limpar a planilha depois.
  const porNome = new Map<string, FormulaRow>();
  const nomesDuplicados = new Set<string>();
  for (const formula of linhas) {
    if (porNome.has(formula.nome)) nomesDuplicados.add(formula.nome);
    porNome.set(formula.nome, formula);
  }
  const unicas = Array.from(porNome.values());

  // BLOQUEIO: separa válidas (soma ~1000 kg/ton) das inválidas. Só as válidas
  // são gravadas; as inválidas são devolvidas na resposta para correção.
  const validas: FormulaRow[] = [];
  const rejeitadas: { nome: string; soma_kg_ton: number }[] = [];

  for (const formula of unicas) {
    const soma = somaProporcoes(formula);
    if (Math.abs(soma - SOMA_ALVO) <= TOLERANCIA) {
      validas.push(formula);
    } else {
      rejeitadas.push({
        nome: formula.nome,
        soma_kg_ton: Math.round(soma * 1000 * 100) / 100,
      });
    }
  }

  if (validas.length > 0) {
    const { error } = await supabaseAdmin
      .from("formulas")
      .upsert(validas, { onConflict: "nome" });

    if (error) {
      console.error("[formulas/sync]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // RECONCILIAÇÃO: a planilha é a fonte de verdade. Remove do banco as fórmulas
  // cujo nome não existe mais na planilha (lixo de seed antigo, fórmula apagada).
  // Guarda de segurança: só reconcilia com um volume plausível de linhas, pra
  // nunca esvaziar a tabela caso a leitura da planilha venha vazia/parcial.
  let removidas = 0;
  const nomesNaPlanilha = new Set(linhas.map((l) => l.nome));

  if (nomesNaPlanilha.size >= 50) {
    const { data: existentes } = await supabaseAdmin
      .from("formulas")
      .select("id, nome");

    const orfas = ((existentes ?? []) as { id: number; nome: string }[])
      .filter((f) => !nomesNaPlanilha.has(f.nome))
      .map((f) => f.id);

    if (orfas.length > 0) {
      const { error: delErr } = await supabaseAdmin
        .from("formulas")
        .delete()
        .in("id", orfas);

      if (delErr) {
        console.error("[formulas/sync] reconciliação", delErr);
      } else {
        removidas = orfas.length;
      }
    }
  }

  return NextResponse.json({
    ok: true,
    importadas: validas.length,
    rejeitadas: rejeitadas.length,
    removidas,
    detalhes_rejeitadas: rejeitadas,
    duplicadas: Array.from(nomesDuplicados),
  });
}
