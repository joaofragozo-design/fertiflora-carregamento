-- Perfil gamificado do vendedor (FertiFloraVendas): apelido, avatar, badges por
-- comissão acumulada e conquistas desbloqueadas (notificação estilo jogo).

alter table public.profiles
  add column if not exists apelido text,
  add column if not exists avatar_url text;

-- Volume da cotação: sem isso não dá pra calcular comissão total em R$, só
-- comissão por tonelada. Default 1 preserva cotações já salvas sem quebrar.
alter table public.cotacoes
  add column if not exists quantidade_toneladas numeric not null default 1,
  add column if not exists comissao_total numeric not null default 0;

create table if not exists public.conquistas (
  id uuid primary key default gen_random_uuid(),
  vendedor_id uuid not null references auth.users(id) on delete cascade,
  chave text not null,
  created_at timestamptz not null default now(),
  unique (vendedor_id, chave)
);

alter table public.conquistas enable row level security;

create policy "vendedor ve e cria suas conquistas"
  on public.conquistas
  for all
  using (vendedor_id = auth.uid())
  with check (vendedor_id = auth.uid());

-- Bucket público de avatares (leitura pública, escrita restrita ao dono).
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatar tem leitura publica"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "vendedor sobe seu proprio avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "vendedor atualiza seu proprio avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
