-- Backfill de `cliente_codigo` em `programacao_carregamento` -- a migration 043 adicionou a
-- coluna, mas o ClientePicker sempre gravava null quando o agendamento era criado digitando texto
-- livre (fluxo "Cadastrar"), mesmo quando quem agendou já escrevia o código do ERP como lembrete
-- dentro do próprio nome (ex.: "AGROIZAK(274984)"). Resultado: 100% das linhas ficaram com
-- cliente_codigo null, e a RPC listar_agendamentos_do_vendedor (que filtra só por cliente_codigo)
-- nunca retornava nada pra nenhum vendedor. O código do ClientePicker foi corrigido pra parar de
-- zerar esse campo daqui pra frente (ver src/components/clientes/cliente-picker.tsx); esta
-- migration só recupera o histórico já digitado usando o mesmo padrão "NOME(codigo)".
update public.programacao_carregamento
set cliente_codigo = (regexp_match(cliente, '\((\d+)\)\s*$'))[1]::integer
where cliente_codigo is null
  and cliente ~ '\(\d+\)\s*$';
