-- ============================================================
-- FERTI FLORA — Migration 024: confirmação de chegada (Faturamento)
-- ============================================================
-- Faturamento só pode marcar confirmado_em/confirmado_por — nada mais.
-- Isso notifica a Logística (via realtime) que o caminhão chegou.

alter table public.programacao_carregamento
  add column if not exists confirmado_em  timestamptz,
  add column if not exists confirmado_por text;

-- ─── PERMISSÃO POR COLUNA (defesa no banco) ──────────────────
-- admin/logistica: sem restrição (já garantido pela policy "for all").
-- faturamento: só pode alterar confirmado_em/confirmado_por.
create or replace function public.enforce_programacao_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role user_role;
begin
  select role into v_role from public.profiles where id = auth.uid();

  if v_role in ('admin', 'logistica') then
    return new;
  end if;

  if v_role = 'faturamento' then
    if (new.cliente    is distinct from old.cliente)
       or (new.data       is distinct from old.data)
       or (new.observacao is distinct from old.observacao)
       or (new.enviado_em is distinct from old.enviado_em) then
      raise exception 'Faturamento só pode confirmar a chegada do caminhão.';
    end if;
    return new;
  end if;

  raise exception 'Sem permissão para esta operação.';
end;
$$;

drop trigger if exists trg_enforce_programacao_update on public.programacao_carregamento;
create trigger trg_enforce_programacao_update
  before update on public.programacao_carregamento
  for each row execute function public.enforce_programacao_update();

-- ─── RLS: permite faturamento fazer UPDATE (a coluna é filtrada pelo trigger) ─
drop policy if exists "programacao_faturamento_confirmar" on public.programacao_carregamento;
create policy "programacao_faturamento_confirmar" on public.programacao_carregamento
  for update using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'faturamento' and active = true
    )
  );
