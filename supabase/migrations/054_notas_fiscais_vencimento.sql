-- RFT6 (Faturamento por Cliente/Produto) passou a trazer também o vencimento da nota (coluna
-- "Vencto" do relatório) -- confirmado nos dados reais: um único vencimento por nota inteira,
-- nunca varia entre as linhas de produto de uma mesma nota. Vira a base de emissão/vencimento do
-- painel de Fluxo de Caixa & Crédito (histórico completo desde 2022, mais confiável que o
-- vencimento por parcela do Relatório de Comissionados, que depende de reimportação frequente pra
-- ficar completo nos anos mais antigos).
alter table public.notas_fiscais_importadas add column if not exists vencimento date;
