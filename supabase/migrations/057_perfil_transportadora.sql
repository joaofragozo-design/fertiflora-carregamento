-- Adiciona o papel 'transportadora' ao enum compartilhado user_role.
-- Transportadoras ganham login próprio para ver seus agendamentos, cadastrar
-- motoristas e enviar solicitação de carregamento (fluxo da migration 058).
-- ALTER TYPE ... ADD VALUE não pode rodar dentro de uma transação; aplicar
-- este arquivo isoladamente (SQL Editor do Supabase), ANTES da 058.
alter type user_role add value if not exists 'transportadora';
