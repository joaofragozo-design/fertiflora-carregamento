import type { ClienteErp } from '@/types/cliente-erp'

// `any` de propósito: essa função é chamada tanto do cliente (browser) quanto
// do servidor (page.tsx), e os dois `createClient()` desse projeto têm tipos
// ligeiramente diferentes (um é síncrono, o outro assíncrono) para o mesmo
// SupabaseClient em tempo de execução -- mesmo padrão de cast já usado em
// todas as outras queries deste repositório.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any

const TAMANHO_PAGINA = 1000

/** Busca todas as páginas de uma tabela (PostgREST limita a 1000 linhas por requisição). */
async function buscarTodasAsPaginas<T>(
  buscarPagina: (from: number, to: number) => Promise<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const todas: T[] = []
  let from = 0
  while (true) {
    const { data, error } = await buscarPagina(from, from + TAMANHO_PAGINA - 1)
    if (error) throw new Error(error.message)
    const pagina = data ?? []
    todas.push(...pagina)
    if (pagina.length < TAMANHO_PAGINA) break
    from += TAMANHO_PAGINA
  }
  return todas
}

/**
 * União de clientes vindos de notas_fiscais_importadas + pedidos_erp_importados
 * (mesmas tabelas do FertiFlora Vendas, mesmo banco Supabase) -- é o cadastro
 * "de verdade" com código de cliente, diferente de `clientes_carregamento`
 * (só nome, criado na hora por quem programa). Um cliente com pedido em
 * aberto mas ainda sem nota emitida também precisa aparecer aqui.
 */
export async function listarClientesErp(supabase: DB): Promise<ClienteErp[]> {
  const [notas, pedidos] = await Promise.all([
    buscarTodasAsPaginas<{ cliente_codigo: number; cliente_nome: string }>((from, to) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).from('notas_fiscais_importadas').select('cliente_codigo, cliente_nome').range(from, to),
    ),
    buscarTodasAsPaginas<{ cliente_codigo: number; cliente_nome: string }>((from, to) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).from('pedidos_erp_importados').select('cliente_codigo, cliente_nome').range(from, to),
    ),
  ])

  const porCodigo = new Map<number, string>()
  for (const row of [...notas, ...pedidos]) {
    if (row.cliente_codigo != null) porCodigo.set(row.cliente_codigo, row.cliente_nome)
  }

  return [...porCodigo.entries()]
    .map(([codigo, nome]) => ({ codigo, nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}
