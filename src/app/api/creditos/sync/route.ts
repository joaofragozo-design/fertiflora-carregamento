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

const TAMANHO_PAGINA = 1000;

/** PostgREST limita a 1000 linhas por requisição -- sem isso, tabelas grandes (ex: notas_fiscais_importadas) ficam truncadas silenciosamente. */
async function buscarTodasAsPaginas<T>(
  buscarPagina: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const todas: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await buscarPagina(from, from + TAMANHO_PAGINA - 1);
    if (error) throw new Error(error.message);
    const pagina = data ?? [];
    todas.push(...pagina);
    if (pagina.length < TAMANHO_PAGINA) break;
    from += TAMANHO_PAGINA;
  }
  return todas;
}

/**
 * `curto` é prefixo de `longo` até uma fronteira de palavra (fim da string ou espaço logo
 * depois) -- cobre "VERDES PASTOS" (planilha) vs "VERDES PASTOS PRODUTOS AGROPECUARIOS LTDA"
 * (ERP, razão social completa) sem confundir com um nome coincidentemente parecido tipo
 * "AGRORURAL" vs um hipotético "AGRORURALGADO" (sem espaço logo após o prefixo).
 */
function prefixoComFronteira(curto: string, longo: string): boolean {
  if (!longo.startsWith(curto)) return false;
  return longo.length === curto.length || longo[curto.length] === " ";
}

/**
 * `curto` (sem espaço) bate com a concatenação (sem espaço) de um prefixo de PALAVRAS INTEIRAS
 * de `longo` -- cobre "AGROFRONTEIRA" (planilha, junto) vs "AGRO FRONTEIRA MAQUINAS..." (ERP,
 * separado) sem confundir com coincidências de prefixo de caracteres tipo "AGROMEL" vs
 * "AGROMELLO..." (letras "LO" a mais não formam um limite de palavra válido).
 */
function prefixoDePalavrasSemEspaco(curto: string, longo: string): boolean {
  let acumulado = "";
  for (const palavra of longo.split(" ")) {
    acumulado += palavra;
    if (acumulado === curto) return true;
    if (acumulado.length > curto.length) return false;
  }
  return false;
}

/**
 * Correspondências confirmadas manualmente (financeiro) pra nomes que o algoritmo não consegue
 * resolver sozinho com segurança -- geralmente porque batem com mais de uma empresa
 * genuinamente diferente no ERP e só um humano sabe qual é a certa. Checado antes de qualquer
 * tentativa automática. Chave = nome exatamente como normalizarNome() deixa o texto da planilha.
 */
const ALIASES_MANUAIS: Record<string, number> = {
  // "Alvorada - RO" na planilha é a unidade de Nova Andradina/MS (não existe unidade em
  // Rondônia no ERP) -- confirmado com o financeiro em 10/07/2026.
  "ALVORADA - RO": 265896,
  // "Agromel" na planilha é a AGROPECUARIA AGROMEL LTDA -- confirmado que NÃO é a AGROMELLO
  // COMMODITIES LTDA (empresa diferente, só o prefixo de letras coincide) -- 10/07/2026.
  AGROMEL: 302171,
};

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
  type LinhaErp = { cliente_codigo: number; cliente_nome: string; vendedor_codigo: number };
  const [notas, pedidos, existentesAntes] = await Promise.all([
    buscarTodasAsPaginas<LinhaErp>((from, to) =>
      supabaseAdmin.from("notas_fiscais_importadas").select("cliente_codigo, cliente_nome, vendedor_codigo").range(from, to)
    ),
    buscarTodasAsPaginas<LinhaErp>((from, to) =>
      supabaseAdmin.from("pedidos_erp_importados").select("cliente_codigo, cliente_nome, vendedor_codigo").range(from, to)
    ),
    buscarTodasAsPaginas<{ id: string; cliente_nome_norm: string; limite_liberado: number }>((from, to) =>
      supabaseAdmin.from("clientes_limite_credito").select("id, cliente_nome_norm, limite_liberado").range(from, to)
    ),
  ]);

  const codigosPorNome = new Map<string, Set<number>>();
  const vendedoresPorClienteCodigo = new Map<number, Set<number>>();
  const linhasPorCodigo = new Map<number, number>();
  for (const row of [...notas, ...pedidos]) {
    const norm = normalizarNome(row.cliente_nome);
    if (!codigosPorNome.has(norm)) codigosPorNome.set(norm, new Set());
    codigosPorNome.get(norm)!.add(row.cliente_codigo);

    if (!vendedoresPorClienteCodigo.has(row.cliente_codigo)) vendedoresPorClienteCodigo.set(row.cliente_codigo, new Set());
    vendedoresPorClienteCodigo.get(row.cliente_codigo)!.add(row.vendedor_codigo);

    linhasPorCodigo.set(row.cliente_codigo, (linhasPorCodigo.get(row.cliente_codigo) ?? 0) + 1);
  }
  const nomesNormalizadosErp = [...codigosPorNome.keys()];

  /** Quando um nome bate com mais de um código (mesma empresa cadastrada 2x no ERP, ex:
   * "VERDES PASTOS" -- confirmado pelo financeiro que não tem problema incluir), fica com o
   * código de maior atividade (mais notas/pedidos) -- é o cadastro efetivamente em uso. */
  function codigoMaisAtivo(codigos: Set<number>): number {
    return [...codigos].sort((a, b) => (linhasPorCodigo.get(b) ?? 0) - (linhasPorCodigo.get(a) ?? 0))[0];
  }

  /**
   * Resolve o cliente_codigo pra um nome da planilha: 0) alias manual; 1) nomes (podem ser
   * vários, ex: match por prefixo) que bateram via exato, prefixo com fronteira ou prefixo sem
   * espaço, nessa ordem -- só avança pro próximo critério se o anterior não achar nada. Se os
   * nomes que bateram forem todos UM SÓ (ainda que esse nome tenha 2+ códigos por duplicidade de
   * cadastro), resolve pelo mais ativo. Se baterem nomes DIFERENTES (empresas realmente
   * distintas), fica ambíguo -- null.
   */
  function resolverCodigo(nomeNorm: string): number | null {
    if (nomeNorm in ALIASES_MANUAIS) return ALIASES_MANUAIS[nomeNorm];

    if (codigosPorNome.has(nomeNorm)) {
      return codigoMaisAtivo(codigosPorNome.get(nomeNorm)!);
    }

    const viaPrefixo = nomesNormalizadosErp.filter(
      (nomeErp) => prefixoComFronteira(nomeNorm, nomeErp) || prefixoComFronteira(nomeErp, nomeNorm)
    );
    if (viaPrefixo.length === 1) return codigoMaisAtivo(codigosPorNome.get(viaPrefixo[0])!);
    if (viaPrefixo.length > 1) return null;

    const viaSemEspaco = nomesNormalizadosErp.filter(
      (nomeErp) => prefixoDePalavrasSemEspaco(nomeNorm, nomeErp) || prefixoDePalavrasSemEspaco(nomeErp, nomeNorm)
    );
    if (viaSemEspaco.length === 1) return codigoMaisAtivo(codigosPorNome.get(viaSemEspaco[0])!);

    return null;
  }

  const limiteAntigoPorNome = new Map<string, number>();
  for (const row of existentesAntes) {
    limiteAntigoPorNome.set(row.cliente_nome_norm, Number(row.limite_liberado));
  }

  const semCorrespondencia: string[] = [];
  const paraGravar = unicas.map((linha) => {
    const clienteCodigo = resolverCodigo(linha.clienteNomeNorm);
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

  const totalAtual = existentesAntes.length;
  if (totalAtual === 0 || nomesNaPlanilha.size >= totalAtual * 0.5) {
    const orfaos = existentesAntes
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
