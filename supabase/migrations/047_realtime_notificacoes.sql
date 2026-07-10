-- Garante que a tabela notificacoes propaga eventos via Supabase Realtime.
-- Sem isso, o sino e o listener global só atualizam a lista com F5 (a consulta
-- normal via RLS funciona, mas o evento postgres_changes nunca chega ao cliente).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notificacoes'
  ) then
    alter publication supabase_realtime add table public.notificacoes;
  end if;
end $$;
