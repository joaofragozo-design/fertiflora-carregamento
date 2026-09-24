# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Equipe interna (escritório/desktop)** — Logística, Admin, Faturamento e operadores (`operador_carregamento`, `operador_pa`) programam a semana de carregamento, liberam solicitações, conferem chegada de caminhões e geram ordens/relatórios. Uso concentrado, sessões longas, tela grande.
- **Transportadoras e motoristas (operação/celular)** — reps de transportadora usam um painel próprio pra indicar motorista e liberar solicitações; motoristas não logam no app — recebem tudo por WhatsApp automático (regras da fábrica, PDF da ordem, localização). Uso rápido, muitas vezes ao ar livre no pátio/portaria da fábrica, possivelmente sol forte e conexão instável.

Ambos os contextos pesam igualmente neste redesign — não é só uma tela de escritório.

## Product Purpose

Coordenar a logística de carregamento e recebimento de matéria-prima da fábrica Fertiflora: programação semanal de cargas, controle de estoque de matéria-prima, fila de solicitação/liberação de transportadora, emissão de ordem de carregamento em PDF, e aviso automático ao motorista via WhatsApp com as regras da fábrica. Substitui coordenação manual (telefone/papel) entre fábrica, transportadoras e motoristas.

## Positioning

Fonte única de verdade em tempo real entre logística interna, transportadoras e motoristas — aplica as regras da indústria (validade de 48h, janelas de horário, ordem de carga por fórmula, taxa de limpeza) de forma consistente, e estende a interface até o WhatsApp do motorista (que nunca abre o app).

## Operating Context

- Fábrica Fertiflora Fertilizantes — pátio de carregamento, portaria, escritório de logística/faturamento.
- Papéis (`role`): `admin`, `logistica`, `logistica_02`, `faturamento`, `operador_carregamento`, `operador_pa`, `transportadora`.
- Fluxo: Programação (semana) → Solicitação enviada à transportadora → transportadora indica motorista → Logística libera → ordem numerada + PDF → WhatsApp automático (WuzAPI self-hosted) → confirmação de chegada (Faturamento) → Ordens do Dia / estoque.
- Rotas hoje: `/programacao`, `/solicitacoes`, `/transportadora`, `/transportadoras`, `/carregamento`, `/recebimento`, `/pa`, `/ordens`, `/admin`.
- Regras de negócio fixas que a UI precisa deixar claras (hoje em `src/lib/whatsapp.ts` → `regrasFabrica`): liberação válida por 48h, carregamentos começam 5h, marcação das 5h às 16h, seg-sex das 5h às 22h, sacaria marca até 10h, ordem de carga por fórmula é soberana, taxa de limpeza R$ 50.

## Capabilities and Constraints

- Next.js 16 + React 19 + Supabase (Postgres/RLS) + Vercel. PDF de ordem via `@react-pdf/renderer`.
- WhatsApp automático via WuzAPI self-hosted (`src/lib/whatsapp-wuzapi.ts`); fallback é link `wa.me` manual quando o self-host falha — a fila não pode travar esperando o WhatsApp.
- Sem app nativo; motorista nunca acessa o painel — toda a experiência dele é a mensagem de WhatsApp + o PDF anexo.
- Deploy Vercel com histórico de "deploy travado" (rollback preso) — cuidado ao validar que mudança está realmente no ar (ver runbook do projeto).

## Brand Commitments

**Atualizado em 2026-09-16** — o usuário relaxou o escopo: só o **nome "FertiLog"** e o **verde Fertiflora** (`#3B9038`, cor de ação primária) são fixos. Tudo o resto (paleta secundária, tipografia, motivo visual, layout, dark/light) está aberto a redesign — não é mais "evolução do tema verde-militar existente", é substituição de mundo visual (ver DESIGN.md).

**Direção escolhida em 2026-09-16: "Ficha de Balança"** — o sistema se comporta como a ficha de pesagem impressa em matriz de pontos que sai a cada passagem de caminhão na balança: cartão de carga = canhoto de papel rasgável, estado = carimbo de borracha, número de sequência real, tipografia mono como protagonista (não só pra dado numérico). Escolhida por comparação lado a lado com outras 2 direções (Ficha de Risco/placa hazmat+andon, Painel de Posto de Pesagem/LED de rodovia). Rollout começou por Login (`/login`) e Programação (`/programacao`) como prova de conceito; o resto do app (Recebimento, Transportadoras, Solicitações, Ordens, Fórmulas) ainda está no tema antigo "verde militar" até aprovação de continuar.

## Evidence on Hand

- Implementação visual incumbente completa no código (`src/app/(dashboard)/**`, `src/components/**`, tokens em `tailwind`/CSS) — usar como autoridade visual atual.
- Nenhum DESIGN.md ainda existe; este redesign deve produzir um.
- Este design vai virar a base visual compartilhada de outros apps Fertiflora (STO, Vendas, Ponto, Nosso Cofre) — construir pensando em tokens/portabilidade, não só nesta tela.

## Product Principles

1. A regra da fábrica está sempre visível e inequívoca — quem programa, libera ou dirige nunca deve adivinhar horário/validade/ordem de carga.
2. Interno e externo são experiências diferentes por design — telas internas otimizam densidade e velocidade de operação; a mensagem de WhatsApp (a "tela" do motorista) precisa ser lida em segundos, no sol, numa cabine de caminhão.
3. Nada trava a fila — quando uma integração falha (WhatsApp, PDF), a UI sempre dá um caminho manual sem perder o estado.
4. Verde Fertiflora e a marca são a constante; tudo o mais (tokens de espaçamento/tipografia/motion/componentes) pode e deve evoluir.
5. Esse redesign é o ponto de partida do design system de todos os apps Fertiflora, não só deste.

## Accessibility & Inclusion

Legibilidade ao ar livre (sol forte, telas de celular/tablet na portaria/pátio) é um requisito real, não só desktop com luz de escritório controlada — contraste e tamanho de alvo de toque importam tanto quanto densidade de informação no desktop.
