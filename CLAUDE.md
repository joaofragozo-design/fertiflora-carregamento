# FertiFlora Carregamento

App Next.js + Supabase de logística/carregamento. Deploy na Vercel.

## Ferramentas de UI

Ferramentas instaladas no Claude Code (escopo de usuário). Usar sempre que a tarefa envolver interface:

- **Componentes:** antes de escrever um componente do zero, buscar código, demos e blocks via MCP `shadcn` (`get_component`, `get_component_demo`, `get_block`).
- **Inspiração e seções prontas:** MCP `21st` (`search`, `get_component`, `get_inspiration`) para landing, pricing, tabelas, dashboards.
- **Direção visual em telas novas:** invocar a skill `frontend-design` antes de codar; evitar layout genérico de template.
- **Antes de finalizar uma tela:** rodar `/web-design-guidelines <arquivo>` no arquivo alterado e corrigir os apontamentos de acessibilidade e UX.
- **Testar no browser:** MCP `chrome-devtools` com o app rodando localmente (`npm run dev`): navegar, tirar screenshot, ler console e requisições de rede antes de declarar a tela pronta.
- **Auditoria de design mais profunda:** skills `impeccable` e `ui-ux-pro-max` quando o pedido for melhorar ou revisar uma tela existente.
