-- Permite gravar o código do ERP direto no cadastro manual de cliente
-- (`clientes_carregamento`), pra além do cadastro automático via nome digitado
-- com "(codigo)" (ver cliente-picker.tsx). Sem isso, um cliente criado à mão
-- nunca ganha código enquanto ninguém digitar esse truque, e o vínculo com o
-- vendedor (`cliente_codigo` em `programacao_carregamento`) fica quebrado.
alter table public.clientes_carregamento
  add column if not exists codigo integer;
