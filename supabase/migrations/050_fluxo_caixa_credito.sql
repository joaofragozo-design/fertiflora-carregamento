-- Limite geral da empresa (carteira a prazo, em toneladas) por safra/safrinha -- histórico
-- insert-only: cada nova definição (todo dia 30/04, ou correção) é uma linha nova, nunca um
-- update do valor. A única mutação permitida é marcar a reserva da safrinha como liberada
-- (decisão condicional do Pilar 5: caixa no Nível 3 + garantia de recebimento), nunca reescrever
-- o limite/percentual/período já decididos.
create table public.limite_carteira_prazo (
  id                    uuid primary key default gen_random_uuid(),
  chave_periodo         text not null,              -- ex: 'safra-2026' (ciclo definido todo 30/04)
  limite_toneladas      numeric not null,
  reserva_pct           numeric not null default 30,
  reserva_liberada      boolean not null default false,
  reserva_liberada_em   timestamptz,
  reserva_liberada_por  uuid references auth.users(id),
  criado_em             timestamptz not null default now(),
  criado_por            uuid references auth.users(id)
);
create index limite_carteira_prazo_periodo_idx on public.limite_carteira_prazo (chave_periodo, criado_em desc);

alter table public.limite_carteira_prazo enable row level security;

create policy "admin le limite" on public.limite_carteira_prazo for select using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);
create policy "admin insere limite" on public.limite_carteira_prazo for insert with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);
create policy "admin libera reserva" on public.limite_carteira_prazo for update using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- Blindagem: um update só pode tocar reserva_liberada/reserva_liberada_em/reserva_liberada_por --
-- nunca reescrever limite_toneladas/reserva_pct/chave_periodo de uma decisão já tomada.
create or replace function public.bloquear_edicao_limite_historico()
returns trigger language plpgsql as $$
begin
  if NEW.limite_toneladas <> OLD.limite_toneladas or NEW.reserva_pct <> OLD.reserva_pct or NEW.chave_periodo <> OLD.chave_periodo then
    raise exception 'limite_carteira_prazo é histórico -- crie uma nova linha em vez de editar esta.';
  end if;
  return NEW;
end;
$$;

create trigger trg_bloquear_edicao_limite_historico before update on public.limite_carteira_prazo
  for each row execute function public.bloquear_edicao_limite_historico();

-- Habilita realtime nas 4 tabelas ERP que o painel de Fluxo de Caixa & Crédito precisa
-- acompanhar -- nenhuma delas está na publicação hoje (só `notificacoes`, migration 047).
-- Mesmo padrão defensivo: só adiciona se ainda não estiver, pra migration ser re-executável.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'comissoes_erp_importadas'
  ) then
    alter publication supabase_realtime add table public.comissoes_erp_importadas;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'comissoes_liquidadas_importadas'
  ) then
    alter publication supabase_realtime add table public.comissoes_liquidadas_importadas;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notas_fiscais_importadas'
  ) then
    alter publication supabase_realtime add table public.notas_fiscais_importadas;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pedidos_erp_importados'
  ) then
    alter publication supabase_realtime add table public.pedidos_erp_importados;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'limite_carteira_prazo'
  ) then
    alter publication supabase_realtime add table public.limite_carteira_prazo;
  end if;
end $$;
