-- Habilita realtime em `formula_precos` -- a Cotação (FertiFloraVendas) precisa reagir em tempo
-- real quando o sync da planilha de preços (Google Sheets) atualiza nome/valor de uma fórmula,
-- sem precisar de F5. Mesmo padrão defensivo (`do $ if not exists ... $`) das migrations 047/050,
-- que já adicionam tabelas a essa publicação.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'formula_precos'
  ) then
    alter publication supabase_realtime add table public.formula_precos;
  end if;
end $$;
