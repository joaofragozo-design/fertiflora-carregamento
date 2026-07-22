-- Taxas de juros da cotação (TAXA %(A.M) e TAXA MP) -- na planilha original vêm de IMPORTRANGE da
-- aba "MP" (Matéria-Prima) da "TABELA VENDAS SHEETS", células D3 e G1 -- ou seja, podem mudar
-- conforme o custo/financiamento de matéria-prima muda. Antes disso, o app tratava as duas como
-- constante fixa em código (src/lib/pricing/calculadora.ts), o que ficava desatualizado
-- silenciosamente sempre que a planilha mudava esses valores. Linha única (sempre a mesma, nunca
-- insere outra) -- mesmo padrão de cotacao_config, não histórico.
create table public.taxas_juros_cotacao (
  id            uuid primary key default gen_random_uuid(),
  taxa_am       numeric not null, -- TAXA %(A.M) -- juros mensal sobre o preço à vista inteiro
  taxa_mp       numeric not null, -- TAXA MP -- juros mensal sobre (preço à vista - frete-base US$44,80)
  atualizado_em timestamptz not null default now()
);

-- Seed com os valores hardcoded anteriores (0,022 / 0,014) -- placeholder até o primeiro sync real.
insert into public.taxas_juros_cotacao (taxa_am, taxa_mp) values (0.022, 0.014);

alter table public.taxas_juros_cotacao enable row level security;

create policy "autenticado le taxas de juros" on public.taxas_juros_cotacao
  for select using (auth.role() = 'authenticated');

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'taxas_juros_cotacao'
  ) then
    alter publication supabase_realtime add table public.taxas_juros_cotacao;
  end if;
end $$;
