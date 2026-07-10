import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

interface CreditoRow {
  clienteNomeRaw: string;
  clienteNomeNorm: string;
  vendedorNomeRaw: string;
  statusCredito: string;
  limiteLiberado: number;
}

const MARCAS_DIACRITICAS = new RegExp("[\\u0300-\\u036f]", "g");

/** Maiúsculo, sem acento, espaços colapsados/aparados -- chave de match contra o ERP. */
function normalizarNome(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(MARCAS_DIACRITICAS, "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

/** Tolera número já pronto, string com vírgula decimal e "R$ 50.000,00" (ponto de milhar). */
function toNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const limpo = value.replace(/[^\d,.-]/g, "").trim();
    if (!limpo) return 0;
    const semSeparadorMilhar = limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo;
    const parsed = parseFloat(semSeparadorMilhar);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function fmtBRL(v: number): string {
  return "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Mantém só linhas com nome de cliente preenchido. */
function sanitizeRow(raw: Record<string, unknown>): CreditoRow | null {
  const clienteNomeRaw = String(raw["cliente"] ?? "").trim();
  if (!clienteNomeRaw) return null;

  return {
    clienteNomeRaw,
    clienteNomeNorm: normalizarNome(clienteNomeRaw),
    vendedorNomeRaw: String(raw["vendedor"] ?? "").trim(),
    statusCredito: String(raw["status"] ?? "").trim(),
    limiteLiberado: toNumber(raw["limite_liberado"]),
  };
}

export async function POST(req: NextRequest) {
  if (req.headers.get("x-sync-key") !== process.env.CREDITOS_SYNC_KEY) {
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
      { error: "Payload deve ser um array de clientes." },
      { status: 400 }
    );
  }

  const linhas = body
    .filter(
      (linha): linha is Record<string, unknown> =>
        linha !== null && typeof linha === "object" && !Array.isArray(linha)
    )
    .map(sanitizeRow)
    .filter((linha): linha is CreditoRow => linha !== null);

  if (linhas.length === 0) {
    return NextResponse.json(
      {
        error:
          "Nenhum cliente com nome no payload. Verifique se a coluna 'cliente' está preenchida.",
      },
      { status: 400 }
    );
  }

  // DEDUPE: a tabela tem `cliente_nome_norm` único e o upsert quebra se o lote
  // tiver nomes repetidos (duas linhas da planilha podem normalizar pro mesmo
  // nome). Mantém a última ocorrência e reporta os nomes duplicados.
  const porNome = new Map<string, CreditoRow>();
  const nomesDuplicados = new Set<string>();
  for (const linha of linhas) {
    if (porNome.has(linha.clienteNomeNorm)) nomesDuplicados.add(linha.clienteNomeRaw);
    porNome.set(linha.clienteNomeNorm, linha);
  }
  const unicas = Array.from(porNome.values());

  // Resolve cliente_codigo por nome normalizado contra o ERP (a planilha de
  // crédito não tem código/CNPJ). Nome sem correspondência OU que bate com
  // mais de um código diferente vira null -- ambíguo é pior que nenhum.
  // Também aproveita a mesma leitura pra saber qual(is) vendedor_codigo já
  // vendeu pra cada cliente_codigo -- é quem recebe a notificação de
  // aumento de limite, mais abaixo.
  const [{ data: notas }, { data: pedidos }, { data: existentesAntes }] = await Promise.all([
    supabaseAdmin.from("notas_fiscais_importadas").select("cliente_codigo, cliente_nome, vendedor_codigo"),
    supabaseAdmin.from("pedidos_erp_importados").select("cliente_codigo, cliente_nome, vendedor_codigo"),
    supabaseAdmin.from("clientes_limite_credito").select("id, cliente_nome_norm, limite_liberado"),
  ]);

  const codigosPorNome = new Map<string, Set<number>>();
  const vendedoresPorClienteCodigo = new Map<number, Set<number>>();
  for (const row of [...(notas ?? []), ...(pedidos ?? [])] as {
    cliente_codigo: number;
    cliente_nome: string;
    vendedor_codigo: number;
  }[]) {
    const norm = normalizarNome(row.cliente_nome);
    if (!codigosPorNome.has(norm)) codigosPorNome.set(norm, new Set());
    codigosPorNome.get(norm)!.add(row.cliente_codigo);

    if (!vendedoresPorClienteCodigo.has(row.cliente_codigo)) vendedoresPorClienteCodigo.set(row.cliente_codigo, new Set());
    vendedoresPorClienteCodigo.get(row.cliente_codigo)!.add(row.vendedor_codigo);
  }

  const limiteAntigoPorNome = new Map<string, number>();
  for (const row of (existentesAntes ?? []) as { cliente_nome_norm: string; limite_liberado: number }[]) {
    limiteAntigoPorNome.set(row.cliente_nome_norm, Number(row.limite_liberado));
  }

  const semCorrespondencia: string[] = [];
  const paraGravar = unicas.map((linha) => {
    const codigos = codigosPorNome.get(linha.clienteNomeNorm);
    const clienteCodigo = codigos && codigos.size === 1 ? [...codigos][0] : null;
    if (clienteCodigo === null) semCorrespondencia.push(linha.clienteNomeRaw);

    return {
      cliente_nome_raw: linha.clienteNomeRaw,
      cliente_nome_norm: linha.clienteNomeNorm,
      cliente_codigo: clienteCodigo,
      vendedor_nome_raw: linha.vendedorNomeRaw || null,
      status_credito: linha.statusCredito,
      limite_liberado: linha.limiteLiberado,
      atualizado_em: new Date().toISOString(),
    };
  });

  const { error } = await supabaseAdmin
    .from("clientes_limite_credito")
    .upsert(paraGravar, { onConflict: "cliente_nome_norm" });

  if (error) {
    console.error("[creditos/sync]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // NOTIFICAÇÃO: cliente cujo limite liberado aumentou em relação ao valor
  // anterior avisa o(s) vendedor(es) que já venderam pra ele. Não bloqueia a
  // resposta do sync -- falha ao notificar não é falha de importação.
  for (const linha of paraGravar) {
    if (linha.cliente_codigo === null) continue;
    const antigo = limiteAntigoPorNome.get(linha.cliente_nome_norm) ?? 0;
    if (linha.limite_liberado <= antigo) continue;

    const vendedorCodigos = vendedoresPorClienteCodigo.get(linha.cliente_codigo);
    if (!vendedorCodigos) continue;

    const corpo = `O limite de crédito de ${linha.cliente_nome_raw} aumentou de ${fmtBRL(antigo)} para ${fmtBRL(linha.limite_liberado)}.`;
    for (const vendedorCodigo of vendedorCodigos) {
      const { error: notifErr } = await supabaseAdmin.rpc("notificar_vendedor_por_codigo", {
        p_vendedor_codigo: vendedorCodigo,
        p_tipo: "aumento_limite",
        p_titulo: "Limite de crédito aumentou",
        p_corpo: corpo,
      });
      if (notifErr) console.error("[creditos/sync] notificação", notifErr);
    }
  }

  // RECONCILIAÇÃO: a planilha é a fonte de verdade. Remove clientes cujo nome
  // não está mais nela. Guarda de segurança: só reconcilia se o novo payload
  // cobrir pelo menos metade do que já existe, pra nunca esvaziar a tabela
  // por causa de uma leitura parcial/quebrada da planilha. Reusa a leitura
  // feita antes do upsert -- o upsert só altera campos de linhas que já
  // estavam nela (as de `nomesNaPlanilha`), nunca cria/remove órfãos.
  let removidos = 0;
  const nomesNaPlanilha = new Set(unicas.map((l) => l.clienteNomeNorm));

  const totalAtual = existentesAntes?.length ?? 0;
  if (totalAtual === 0 || nomesNaPlanilha.size >= totalAtual * 0.5) {
    const orfaos = ((existentesAntes ?? []) as { id: string; cliente_nome_norm: string }[])
      .filter((c) => !nomesNaPlanilha.has(c.cliente_nome_norm))
      .map((c) => c.id);

    if (orfaos.length > 0) {
      const { error: delErr } = await supabaseAdmin
        .from("clientes_limite_credito")
        .delete()
        .in("id", orfaos);

      if (delErr) {
        console.error("[creditos/sync] reconciliação", delErr);
      } else {
        removidos = orfaos.length;
      }
    }
  }

  return NextResponse.json({
    ok: true,
    importados: paraGravar.length,
    sem_correspondencia: semCorrespondencia,
    removidos,
    duplicados: Array.from(nomesDuplicados),
  });
}
