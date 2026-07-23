-- Documentos e placas do motorista/veículo, obrigatórios no cadastro feito
-- pela transportadora -- necessário pra fábrica conferir o veículo na
-- portaria (placa cavalo + reboques) e ter o documento do motorista em mãos.
-- Placa 1 é obrigatória (motorista sempre puxa pelo menos um reboque);
-- placas 2/3/4 cobrem bitrem/rodotrem e ficam opcionais.
alter table public.motoristas
  add column if not exists cpf          text,
  add column if not exists rg           text,
  add column if not exists cnh          text,
  add column if not exists placa_cavalo text,
  add column if not exists placa_1      text,
  add column if not exists placa_2      text,
  add column if not exists placa_3      text,
  add column if not exists placa_4      text;

-- Backfill de motoristas já cadastrados antes desta migration: sem os dados
-- novos, usa um placeholder óbvio em vez de deixar null (a coluna vira
-- not null logo abaixo). A transportadora corrige na próxima edição.
update public.motoristas
set cpf          = coalesce(cpf, 'PENDENTE'),
    rg            = coalesce(rg, 'PENDENTE'),
    cnh           = coalesce(cnh, 'PENDENTE'),
    placa_cavalo  = coalesce(placa_cavalo, 'PENDENTE'),
    placa_1       = coalesce(placa_1, 'PENDENTE')
where cpf is null or rg is null or cnh is null or placa_cavalo is null or placa_1 is null;

alter table public.motoristas
  alter column cpf          set not null,
  alter column rg           set not null,
  alter column cnh          set not null,
  alter column placa_cavalo set not null,
  alter column placa_1      set not null;
