-- Trava de cotação: liga/desliga a criação de novas cotações pelos vendedores. Linha única
-- (sempre a mesma, nunca insere outra) -- diferente de limite_carteira_prazo, não é histórico,
-- é um interruptor.
create table public.cotacao_config (
  id            uuid primary key default gen_random_uuid(),
  travada       boolean not null default false,
  travada_por   uuid references auth.users(id),
  travada_em    timestamptz,
  atualizado_em timestamptz not null default now()
);

insert into public.cotacao_config (travada) values (false);

alter table public.cotacao_config enable row level security;

-- Todo autenticado precisa ler (vendedor precisa saber se está travado antes de criar cotação).
create policy "autenticado le config cotacao" on public.cotacao_config
  for select using (auth.role() = 'authenticated');

create policy "admin atualiza config cotacao" on public.cotacao_config
  for update using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'cotacao_config'
  ) then
    alter publication supabase_realtime add table public.cotacao_config;
  end if;
end $$;
