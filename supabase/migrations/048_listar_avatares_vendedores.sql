-- RLS de profiles só libera SELECT da própria linha (auth.uid() = id), então o Ranking
-- (que precisa mostrar foto/localização de TODOS os vendedores pra QUALQUER vendedor
-- logado) nunca conseguia ler o avatar_url de ninguém além do próprio usuário -- cada
-- vendedor só via a própria foto, nunca a dos colegas. avatar_url e praca_atuacao já são
-- dados públicos na tela (aparecem pra todo mundo no ranking), então é seguro expor só
-- esses dois campos via RPC security definer, sem tocar no resto do profile.
create or replace function public.listar_avatares_vendedores(p_ids uuid[])
returns table (id uuid, avatar_url text, praca_atuacao text)
language sql
security definer
set search_path = public
stable
as $$
  select p.id, p.avatar_url, p.praca_atuacao
  from public.profiles p
  where p.id = any(p_ids)
$$;

grant execute on function public.listar_avatares_vendedores(uuid[]) to authenticated;
