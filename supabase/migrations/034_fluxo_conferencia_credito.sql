-- Substitui a aprovação de Pedido em etapa única por duas etapas:
--   1. Conferência (Françoa) -- reprova direto ou encaminha pra análise de crédito
--   2. Análise de Crédito (admin/Djeisson) -- decisão final: aprova ou reprova
--
-- Novo cargo 'conferencia'. Status antigos mapeados pro fluxo novo:
--   aguardando_aprovacao -> aguardando_conferencia (mesma etapa, nome novo)
--   aprovado              -> aprovado_credito (era a decisão final, continua sendo)
--   rejeitado             -> reprovado_credito (era decisão final de admin, mesma pessoa/etapa)

alter type public.user_role add value if not exists 'conferencia';
