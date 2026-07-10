-- ============================================================
-- FERTI FLORA — Migration 043: código de cliente na programação
-- ============================================================
-- `cliente` continua existindo como texto livre (exibição/compatibilidade),
-- mas passa a também gravar o código do cliente do ERP (mesmo usado em
-- notas_fiscais_importadas/pedidos_erp_importados no FertiFlora Vendas).
-- Sem isso não dá pra saber de quem é o vendedor do cliente agendado --
-- hoje o vínculo só existiria por comparação de texto, frágil.
--
-- Nullable: agendamentos antigos (ou clientes que não existem no ERP,
-- ex. cliente novo ainda não faturado) ficam sem código, sem quebrar nada.

alter table public.programacao_carregamento
  add column if not exists cliente_codigo integer;

create index if not exists idx_programacao_cliente_codigo
  on public.programacao_carregamento(cliente_codigo);

-- ─── RPC: agendamentos dos clientes do vendedor autenticado ──────────────
-- security definer + zero parâmetros: resolve auth.uid() internamente, sem
-- aceitar nenhum filtro vindo do cliente (mesmo princípio das RPCs de
-- ranking -- um parâmetro client-controlado aqui poderia ser usado pra
-- espiar agendamentos de outros vendedores). Só devolve o cabeçalho do
-- agendamento + total de toneladas somado dos itens, não o detalhe de
-- fórmula/quantidade (isso é assunto de quem programa, não do vendedor).
create or replace function public.listar_agendamentos_do_vendedor()
returns table (
  id              uuid,
  data            date,
  cliente         text,
  cliente_codigo  integer,
  observacao      text,
  enviado_em      timestamptz,
  confirmado_em   timestamptz,
  confirmado_por  text,
  total_toneladas numeric
)
language sql
security definer
set search_path = public
stable
as $$
  select
    pc.id, pc.data, pc.cliente, pc.cliente_codigo, pc.observacao,
    pc.enviado_em, pc.confirmado_em, pc.confirmado_por,
    coalesce(sum(pi.tons), 0) as total_toneladas
  from public.programacao_carregamento pc
  left join public.programacao_itens pi on pi.programacao_id = pc.id
  where pc.cliente_codigo in (
    select nfi.cliente_codigo from public.notas_fiscais_importadas nfi
    join public.vendedores_comerciais vc on vc.codigo = nfi.vendedor_codigo
    where vc.profile_id = auth.uid()
    union
    select pei.cliente_codigo from public.pedidos_erp_importados pei
    join public.vendedores_comerciais vc on vc.codigo = pei.vendedor_codigo
    where vc.profile_id = auth.uid()
  )
  group by pc.id, pc.data, pc.cliente, pc.cliente_codigo, pc.observacao, pc.enviado_em, pc.confirmado_em, pc.confirmado_por
  order by pc.data asc;
$$;

grant execute on function public.listar_agendamentos_do_vendedor() to authenticated;
