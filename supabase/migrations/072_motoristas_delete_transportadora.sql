-- ============================================================
-- FERTI FLORA — Migration 072: Transportadora pode excluir motorista
-- ============================================================
-- A migration 058 deu à transportadora select/insert/update na própria
-- frota de motoristas, mas não delete — não dava pra remover um cadastro
-- errado ou um motorista que saiu da empresa sem pedir pro admin/logística.
-- FK já é "on delete set null" em programacao_carregamento.motorista_id,
-- então excluir não quebra o histórico de solicitações antigas.

create policy "motoristas_delete_transportadora" on public.motoristas
  for delete using (
    transportadora_id in (select id from public.transportadoras where profile_id = auth.uid())
  );
