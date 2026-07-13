-- Baú de recompensa no Ranking: ao cruzar um patamar de toneladas (faturado+pedido), o
-- vendedor ganha um baú com uma moldura colorida de avatar sorteada. Detecção via trigger
-- (não client-side), já que faturamento_comercial muda por import do ERP ou edição do
-- admin -- nunca pela própria sessão do vendedor.
--
-- Script seguro pra rodar de novo do zero (idempotente) -- útil já que essa migration foi
-- corrigida mais de uma vez após tentativas parciais.

alter table public.profiles add column if not exists moldura_cor text;

-- profiles_update_own (migration 007) é "using/check auth.uid()=id" sem restrição de coluna --
-- sem isso, qualquer vendedor poderia se auto-atribuir a moldura direto pelo client, sem
-- nunca ganhar baú nenhum. Só o trigger abaixo (roda como owner) escreve nessa coluna.
--
-- IMPORTANTE: "revoke update (col)" sozinho NÃO basta -- Postgres trata privilégio de coluna
-- e de tabela como entradas de ACL separadas, então um GRANT UPDATE amplo pré-existente na
-- tabela (comum no setup padrão do Supabase) continua liberando a coluna nova mesmo depois
-- do revoke específico (confirmado testando: o client conseguia setar moldura_cor direto).
-- Precisa revogar a tabela inteira e reconceder só as colunas que o app realmente escreve
-- (ver atualizarPerfil/enviarAvatar em src/lib/perfil/queries.ts).
revoke update on public.profiles from authenticated;
grant update (apelido, praca_atuacao, nome_completo, telefone, avatar_url) on public.profiles to authenticated;

create table if not exists public.baus_recompensa (
  id                 uuid primary key default gen_random_uuid(),
  profile_id         uuid not null references auth.users(id) on delete cascade,
  tier_chave         text not null,
  aberto             boolean not null default false,
  tipo_recompensa    text,
  detalhe_recompensa jsonb,
  created_at         timestamptz not null default now(),
  unique (profile_id, tier_chave)
);

alter table public.baus_recompensa enable row level security;

drop policy if exists "vendedor ve seus baus" on public.baus_recompensa;
create policy "vendedor ve seus baus" on public.baus_recompensa
  for select using (profile_id = auth.uid());

drop policy if exists "vendedor abre seus baus" on public.baus_recompensa;
create policy "vendedor abre seus baus" on public.baus_recompensa
  for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- GRANT é idempotente (não erra se já concedido).
grant select on public.baus_recompensa to authenticated;
-- Mesmo motivo do profiles acima: revoga a tabela inteira antes, senão o default privilege
-- do Supabase (GRANT amplo pra authenticated em tabelas novas) deixa passar as outras colunas.
-- Só "aberto" é escrita pelo client -- tipo_recompensa/detalhe_recompensa são só do trigger.
revoke update on public.baus_recompensa from authenticated;
grant update (aberto) on public.baus_recompensa to authenticated;

-- Patamares duplicados de src/lib/gamificacao/tiers.ts (TIERS) -- mudar lá exige mudar aqui também.
create or replace function public.avaliar_baus_recompensa()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_total numeric;
  v_cor text;
  v_paleta text[] := array['#f59e0b','#7c3aed','#16a34a','#db2777','#0891b2','#ef4444'];
  v_tier record;
begin
  if NEW.ano <> extract(year from now())::int then
    return NEW;
  end if;

  select profile_id into v_profile_id from public.vendedores_comerciais where id = NEW.vendedor_id;
  if v_profile_id is null then
    return NEW;
  end if;

  v_total := NEW.faturado + NEW.pedido;

  for v_tier in select * from (values
    ('toneladas_1k', 1000), ('toneladas_2k', 2000), ('toneladas_3k', 3000), ('toneladas_4k', 4000),
    ('toneladas_5k', 5000), ('toneladas_7_5k', 7500), ('toneladas_10k', 10000), ('toneladas_20k', 20000)
  ) as t(chave, minimo)
  loop
    if v_total >= v_tier.minimo then
      v_cor := v_paleta[floor(random() * array_length(v_paleta, 1) + 1)];

      insert into public.baus_recompensa (profile_id, tier_chave, tipo_recompensa, detalhe_recompensa)
      values (v_profile_id, v_tier.chave, 'moldura', jsonb_build_object('cor', v_cor))
      on conflict (profile_id, tier_chave) do nothing;

      if found then
        update public.profiles set moldura_cor = v_cor where id = v_profile_id;
        insert into public.notificacoes (destinatario_id, tipo, titulo, corpo)
        values (v_profile_id, 'bau_recompensa', 'Você ganhou um baú! 🎁', 'Toque para abrir e ver sua recompensa.');
      end if;
    end if;
  end loop;

  return NEW;
end;
$$;

drop trigger if exists trg_avaliar_baus_recompensa on public.faturamento_comercial;
create trigger trg_avaliar_baus_recompensa
  after insert or update of faturado, pedido on public.faturamento_comercial
  for each row execute function public.avaliar_baus_recompensa();

-- Estende a RPC já existente (migration 048) pra também trazer a moldura no Ranking.
-- Postgres não deixa CREATE OR REPLACE mudar o tipo de retorno (nova coluna moldura_cor) --
-- precisa dropar antes. Recriar apaga os grants antigos, então reconcede o EXECUTE depois.
drop function if exists public.listar_avatares_vendedores(uuid[]);

create function public.listar_avatares_vendedores(p_ids uuid[])
returns table (id uuid, avatar_url text, praca_atuacao text, moldura_cor text)
language sql
security definer
set search_path = public
stable
as $$
  select p.id, p.avatar_url, p.praca_atuacao, p.moldura_cor
  from public.profiles p
  where p.id = any(p_ids)
$$;

grant execute on function public.listar_avatares_vendedores(uuid[]) to authenticated;
