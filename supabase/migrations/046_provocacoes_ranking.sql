-- ============================================================
-- FERTI FLORA — Migration 046: provocações amistosas no Ranking
-- ============================================================
-- Reação rápida (emoji + frase) que qualquer participante do Ranking manda
-- pra outro, tipo os emotes do rei no Clash Royale -- "Parabéns!", "E a
-- meta, nada ainda?" etc. Livre: sem hierarquia, todo mundo manda pra todo
-- mundo. "Participante" inclui vendedores (vendedores_comerciais) E a
-- equipe de apoio exibida à parte (admin/conferencia -- ver
-- listar_equipe_apoio mais abaixo), por isso o alvo é sempre profile_id,
-- nunca código de vendedor (equipe de apoio não tem um).
--
-- Catálogo de `tipo` fixo (ver src/lib/provocacoes/types.ts no repo Vendas)
-- -- o check abaixo é só uma trava de integridade, a lista de verdade vive
-- no código (mudar lá exige migration nova aqui também).

create table public.provocacoes_ranking (
  id              uuid primary key default gen_random_uuid(),
  remetente_id    uuid not null references auth.users(id) on delete cascade,
  destinatario_id uuid not null references auth.users(id) on delete cascade,
  tipo            text not null check (tipo in ('parabens', 'risada', 'raiva', 'choro', 'vamo_vender', 'meta_nada', 'vamos_faturar')),
  created_at      timestamptz not null default now()
);

create index idx_provocacoes_destinatario on public.provocacoes_ranking(destinatario_id, created_at desc);

alter table public.provocacoes_ranking enable row level security;

create policy "vendedor ve provocacoes recebidas" on public.provocacoes_ranking
  for select using (destinatario_id = auth.uid());

-- ─── RPC: enviar provocação por profile_id do destinatário ──────────────
-- security definer porque quem envia não é o destinatário (mesmo padrão de
-- notificar_vendedor_por_codigo, migration 045). Sem restrição de quem pode
-- MANDAR (qualquer autenticado -- é uma reação de baixo risco, não uma
-- notificação oficial do sistema); mas quem pode RECEBER é limitado a quem
-- de fato aparece em algum lugar do Ranking (vendedor vinculado OU
-- admin/conferencia), pra não virar um jeito de mandar mensagem aleatória
-- pra qualquer perfil do sistema (logistica, faturamento etc).
--
-- Grava em DOIS lugares: provocacoes_ranking (dispara o toast em tempo real
-- pra quem está com a tela aberta na hora) e notificacoes (fica salvo e
-- aparece no sininho quando a pessoa abrir o app depois -- sem isso, quem
-- não estava online no exato momento do envio perderia a provocação pra
-- sempre). p_titulo/p_corpo vêm prontos do cliente (mesmo padrão de
-- notificar_vendedor_por_codigo) -- o catálogo de emoji/frase por `tipo`
-- vive só em src/lib/provocacoes/types.ts, não duplicado aqui em SQL.
create or replace function public.enviar_provocacao_ranking(
  p_destinatario_profile_id uuid,
  p_tipo text,
  p_titulo text,
  p_corpo text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() = p_destinatario_profile_id then
    raise exception 'Não dá pra mandar provocação pra você mesmo.';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = p_destinatario_profile_id
      and (
        p.role in ('admin', 'conferencia')
        or exists (select 1 from public.vendedores_comerciais vc where vc.profile_id = p.id)
      )
  ) then
    raise exception 'Destinatário não encontrado ou não participa do Ranking.';
  end if;

  insert into public.provocacoes_ranking (remetente_id, destinatario_id, tipo)
  values (auth.uid(), p_destinatario_profile_id, p_tipo);

  insert into public.notificacoes (destinatario_id, tipo, titulo, corpo)
  values (p_destinatario_profile_id, 'provocacao', p_titulo, p_corpo);
end;
$$;

grant execute on function public.enviar_provocacao_ranking(uuid, text, text, text) to authenticated;

-- ─── RPC: listar equipe de apoio (admin/conferencia) ─────────────────────
-- RLS de profiles só libera ler o próprio (profiles_select_own, migration
-- 007) -- security definer aqui pra expor, pra qualquer autenticado, só o
-- nome/avatar/role de quem tem role admin ou conferencia (nada mais de
-- `profiles` vaza por essa via). É o que alimenta a seção "Equipe de apoio"
-- no Ranking (Administradores + Suporte), separada do ranking de vendas.
create or replace function public.listar_equipe_apoio()
returns table (
  profile_id uuid,
  nome       text,
  avatar_url text,
  role       text
)
language sql
security definer
set search_path = public
stable
as $$
  select id, coalesce(apelido, username), avatar_url, role::text
  from public.profiles
  where role in ('admin', 'conferencia')
  order by role, coalesce(apelido, username);
$$;

grant execute on function public.listar_equipe_apoio() to authenticated;
