-- ============================================================
-- FERTI FLORA — Migration 045: central de notificações
-- ============================================================
-- Primeira tabela de notificação persistente do sistema (hoje só existe
-- toast efêmero). Dois emissores nesta fase: (1) /api/creditos/sync, quando
-- o limite liberado de um cliente aumenta; (2) substituirComissoesLiquidadasErp
-- no FertiFlora Vendas, quando uma nota que não estava paga passa a aparecer
-- como liquidada. Cada notificação é sempre de um vendedor específico --
-- não existe notificação "geral"/broadcast nesta fase.
--
-- Inserção só por service role/security definer (nunca direto pelo cliente);
-- vendedor só lê/marca como lida as próprias.

create table public.notificacoes (
  id              uuid primary key default gen_random_uuid(),
  destinatario_id uuid not null references auth.users(id) on delete cascade,
  tipo            text not null,
  titulo          text not null,
  corpo           text not null,
  lida            boolean not null default false,
  created_at      timestamptz not null default now()
);

create index idx_notificacoes_destinatario on public.notificacoes(destinatario_id, created_at desc);

alter table public.notificacoes enable row level security;

create policy "vendedor ve suas notificacoes" on public.notificacoes
  for select using (destinatario_id = auth.uid());

create policy "vendedor marca suas notificacoes como lidas" on public.notificacoes
  for update using (destinatario_id = auth.uid())
  with check (destinatario_id = auth.uid());

-- ─── RPC: emitir notificação pra um vendedor a partir do código dele ─────
-- security definer porque quem chama (sync de crédito, import de comissões)
-- não é o destinatário -- um usuário autenticado comum não tem policy de
-- insert nenhuma nesta tabela, só o service role ou esta função conseguem
-- criar notificação pra outra pessoa.
--
-- Restrição de quem pode chamar: service role (auth.uid() null -- caso do
-- sync de crédito, que roda com supabaseAdmin) ou admin autenticado (caso
-- do import de comissões liquidadas, já uma ação admin-only pelas policies
-- de comissoes_liquidadas_importadas). Sem essa checagem, qualquer vendedor
-- logado poderia chamar a RPC direto e mandar notificação falsa pra
-- qualquer outro vendedor -- risco baixo (usuários internos), mas
-- desnecessário: nenhum vendedor comum tem motivo legítimo de acionar isso.
create or replace function public.notificar_vendedor_por_codigo(
  p_vendedor_codigo integer,
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
  if auth.uid() is not null and not exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ) then
    raise exception 'Não autorizado';
  end if;

  insert into public.notificacoes (destinatario_id, tipo, titulo, corpo)
  select vc.profile_id, p_tipo, p_titulo, p_corpo
  from public.vendedores_comerciais vc
  where vc.codigo = p_vendedor_codigo and vc.profile_id is not null;
end;
$$;

grant execute on function public.notificar_vendedor_por_codigo(integer, text, text, text) to authenticated;
