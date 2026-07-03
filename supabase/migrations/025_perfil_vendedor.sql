-- Adiciona o papel 'vendedor' ao enum compartilhado user_role, para o novo
-- sistema FertiFlora Vendas (projeto separado, mesmo banco Supabase).
-- ALTER TYPE ... ADD VALUE não pode rodar dentro de uma transação; aplicar
-- este arquivo isoladamente (SQL Editor do Supabase ou `supabase db push`).
alter type user_role add value if not exists 'vendedor';
