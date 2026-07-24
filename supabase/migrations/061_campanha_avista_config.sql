-- Desconto da "campanha à vista" (preço mostrado ao cliente quando entrega >= pagamento) até agora
-- era hardcoded em 2% (calculadora.ts). Admin passa a poder ligar/desligar a campanha inteira e
-- editar o percentual, sem precisar de deploy -- mesma linha única de cotacao_config, mesma
-- policy de admin-atualiza já existente (migration 055).
alter table public.cotacao_config
  add column if not exists campanha_avista_ativa boolean not null default true,
  add column if not exists campanha_avista_desconto_pct numeric not null default 0.02;
