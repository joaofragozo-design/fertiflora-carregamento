-- Vincula a carga criada em `ordens_diarias` ao agendamento de origem em
-- `programacao_carregamento`, pra dar pra saber na TV se um agendamento de
-- hoje já foi carregado (finalizado) ou ainda não -- sem isso não tinha como
-- diferenciar, já que um mesmo cliente pode ter vários agendamentos no dia.
alter table public.ordens_diarias
  add column if not exists programacao_id uuid references public.programacao_carregamento(id) on delete set null;
