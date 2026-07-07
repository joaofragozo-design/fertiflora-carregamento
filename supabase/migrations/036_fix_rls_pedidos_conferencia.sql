-- Corrige 3 problemas encontrados em revisão da migration 035:
--
-- 1) O trigger somar_faturamento_pedido_aprovado() (031/032) ainda checava
--    new.status = 'aprovado', valor que 035 renomeou para 'aprovado_credito'.
--    Sem esse fix, toda aprovação de crédito daqui pra frente deixa de somar
--    a tonelada em faturamento_comercial.pedido (regressão silenciosa do
--    Ranking Comercial).
--
-- 2) "conferencia ve pedidos" (select) não filtrava por status -- a Françoa
--    enxergava rascunhos ainda não submetidos e pedidos já decididos em
--    outras etapas, não só a fila que a tela dela mostra.
--
-- 3) "conferencia decide pedidos" (update) não tinha with check nem
--    restringia o status de origem via using -- o único gate real (RLS)
--    permitia, via chamada direta à API, pular a etapa de crédito
--    (setar status = 'aprovado_credito' direto) ou alterar um pedido fora
--    da fila de conferência dela.
--
-- 4) "vendedor gerencia seus pedidos" (pré-existente, 030) só valida
--    ownership (vendedor_id = auth.uid()) no with check, não o status --
--    um vendedor conseguia, via chamada direta à API sobre um pedido
--    próprio, pular as duas etapas de aprovação inteiras (setar
--    status = 'aprovado_credito' direto). O código do app nunca escreve
--    status além de 'rascunho'/'aguardando_conferencia' pelo vendedor
--    (ver criarPedido/solicitarAprovacao em src/lib/pedidos/queries.ts),
--    então essa restrição não tira nenhuma funcionalidade legítima.

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
  if new.status = 'aprovado_credito' and (old.status is distinct from 'aprovado_credito') then
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

drop policy if exists "conferencia ve pedidos" on public.pedidos;
create policy "conferencia ve pedidos" on public.pedidos
  for select
  using (
    status in ('aguardando_conferencia', 'reprovado_conferencia')
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'conferencia')
  );

drop policy if exists "conferencia decide pedidos" on public.pedidos;
create policy "conferencia decide pedidos" on public.pedidos
  for update
  using (
    status = 'aguardando_conferencia'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'conferencia')
  )
  with check (
    status in ('aguardando_analise_credito', 'reprovado_conferencia')
    and conferido_por = auth.uid()
  );

drop policy if exists "vendedor gerencia seus pedidos" on public.pedidos;
create policy "vendedor gerencia seus pedidos" on public.pedidos
  for all
  using (vendedor_id = auth.uid())
  with check (vendedor_id = auth.uid() and status in ('rascunho', 'aguardando_conferencia'));
