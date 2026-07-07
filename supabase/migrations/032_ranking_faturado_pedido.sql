-- Ranking Comercial: separa `faturamento_comercial.toneladas` em duas
-- colunas -- `faturado` (já entregue/faturado, só o admin ajusta) e
-- `pedido` (contratado mas ainda não faturado, somado automaticamente
-- quando um Pedido é aprovado no app). TOTAL = faturado + pedido, calculado
-- em memória, nunca armazenado.
--
-- Também corrige a base de cálculo de %/falta/projeção (agora sobre TOTAL,
-- igual à planilha original) e a colocação (agora ordenada por FATURADO,
-- também igual à planilha -- antes estava ordenando por um valor único que
-- misturava os dois conceitos).

alter table public.faturamento_comercial rename column toneladas to faturado;
alter table public.faturamento_comercial add column if not exists pedido numeric not null default 0;

-- ─── Seed automático: passa a inicializar `faturado` (pedido já tem default 0).
create or replace function public.seed_ranking_vendedor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.metas_comerciais (vendedor_id, ano, meta_toneladas)
  values (new.id, extract(year from now())::int, 0)
  on conflict (vendedor_id, ano) do nothing;

  insert into public.faturamento_comercial (vendedor_id, ano, faturado)
  values (new.id, extract(year from now())::int, 0)
  on conflict (vendedor_id, ano) do nothing;

  return new;
end;
$$;

-- ─── Snapshot diário passa a espelhar `faturado` isoladamente -- é o número
--     que decide a colocação, então é o que importa para badges de
--     crescimento/evolução/venda do dia.
create or replace function public.snapshot_faturamento_historico()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.faturamento_historico (vendedor_id, data, toneladas)
  values (new.vendedor_id, current_date, new.faturado)
  on conflict (vendedor_id, data) do update set toneladas = excluded.toneladas;

  return new;
end;
$$;

drop trigger if exists trg_snapshot_faturamento on public.faturamento_comercial;
create trigger trg_snapshot_faturamento
  after insert or update of faturado on public.faturamento_comercial
  for each row
  execute function public.snapshot_faturamento_historico();

-- ─── Auto-soma de Pedido aprovado agora incrementa `pedido`, não `faturado`
--     -- o contrato aprovado é tonelagem comprometida, ainda não entregue.
create or replace function public.somar_faturamento_pedido_aprovado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vendedor_comercial_id uuid;
  v_ano int := extract(year from now())::int;
begin
  if new.status = 'aprovado' and (old.status is distinct from 'aprovado') then
    select id into v_vendedor_comercial_id
    from public.vendedores_comerciais
    where profile_id = new.vendedor_id and ativo = true
    limit 1;

    if v_vendedor_comercial_id is not null then
      insert into public.faturamento_comercial (vendedor_id, ano, pedido)
      values (v_vendedor_comercial_id, v_ano, new.quantidade_toneladas)
      on conflict (vendedor_id, ano) do update
        set pedido = public.faturamento_comercial.pedido + excluded.pedido,
            atualizado_em = now();
    end if;
  end if;

  return new;
end;
$$;
