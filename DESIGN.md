---
name: FertiLog
description: Painel de logística de carregamento da Fertiflora Fertilizantes — "Ficha de Balança" (canhoto de papel + carimbo de status), em rollout sobre um tema legado dark verde-militar
colors:
  brand-primary: "#3B9038"
  brand-primary-hover: "#4FB142"
  ticket-paper: "#ece1c8"
  ticket-edge: "#d9cbab"
  ticket-ink: "#201c14"
  ticket-ink-soft: "#5a5340"
  ticket-rule: "#362f21"
  stamp-solicitado: "#545b52"
  stamp-enviado: "#9c5510"
  stamp-liberado: "#2f7a2c"
  stamp-confirmado: "#2a4d8f"
  neutral-bg: "#12160C"
  neutral-surface: "#191E11"
  neutral-border: "#3B4429"
  neutral-border-subtle: "#29301C"
  neutral-text: "#F4F7EC"
  neutral-text-muted: "#94A07E"
  success: "#10B981"
  warning: "#f97316"
  danger: "#ef4444"
  info: "#3b82f6"
typography:
  ticket-display:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontWeight: 800
  ticket-body:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontWeight: 400
    fontSize: "0.8125rem"
  legacy-display:
    fontFamily: "Outfit, sans-serif"
    fontWeight: 600
    letterSpacing: "-0.01em"
  legacy-title:
    fontFamily: "Outfit, sans-serif"
    fontSize: "clamp(1.125rem, 1.03rem + 0.43vw, 1.375rem)"
    fontWeight: 600
    letterSpacing: "-0.01em"
  legacy-body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontWeight: 400
    fontSize: "0.875rem"
    lineHeight: 1.5
  label-mono:
    fontFamily: "JetBrains Mono, monospace"
    fontFeature: "tabular-nums"
rounded:
  control: "0.375rem"
  ticket-control: "2px"
  lg: "0.875rem"
  xl: "1.25rem"
  2xl: "1.75rem"
  pill: "9999px"
spacing:
  card-padding: "1rem"
  card-padding-md: "1.5rem"
  button-sm: "0.5rem 0.75rem"
  button-md: "0.625rem 1rem"
components:
  ticket:
    backgroundColor: "{colors.ticket-paper}"
    textColor: "{colors.ticket-ink}"
    padding: "1.25rem"
  stamp-liberado:
    textColor: "{colors.stamp-liberado}"
    rounded: "3px"
  button-ticket:
    backgroundColor: "{colors.brand-primary}"
    textColor: "{colors.ticket-paper}"
    rounded: "{rounded.ticket-control}"
  button-primary:
    backgroundColor: "{colors.brand-primary}"
    textColor: "#FFFFFF"
    rounded: "{rounded.control}"
    padding: "{spacing.button-md}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.neutral-text-muted}"
    rounded: "{rounded.control}"
  card:
    backgroundColor: "{colors.neutral-surface}"
    rounded: "{rounded.xl}"
    padding: "{spacing.card-padding-md}"
  badge-success:
    backgroundColor: "{colors.brand-primary}"
    textColor: "#94D97D"
    rounded: "{rounded.pill}"
---

# Design System: FertiLog

## Overview

**Status da migração (revisado em 2026-09-25):** o app está trocando de mundo visual, em rollout — não é um redesign completo ainda. **Só o Login (`/login`)** está no sistema novo, **"Ficha de Balança"**, descrito abaixo. **A Programação (`/programacao`) VOLTOU aos cards do sistema legado a pedido da equipe** ("quando confirmava ficava verde a carga") — ela manteve a estrutura de motion e de layout construída no sistema novo (sábado deslizando, dia minimizável, linhas centradas, carga concluída recolhida), mas a superfície é o card escuro `rounded-lg border` com verde `brand-500/15` na confirmada, não o papel com carimbo. O que mudou em relação ao card original: nome do cliente, fórmula e observação **quebram linha em vez de truncar**, quadros de dia com largura mínima de 240 px em linhas centradas (não mais `grid-cols-6` espremendo tudo em 1280), ícones de ação com área de clique e hover (`IconBtn`/`ActionBtn`), total da carga explícito, "Confirmar chegada" como botão primário, ordem em PDF com `FileDown`. Não voltar a Programação pro papel sem o pessoal pedir. **Todas as outras telas** (Recebimento, Transportadoras, Solicitações, Ordens, Fórmulas, Painel TV, modais) **continuam no sistema legado "verde-militar"**, documentado na seção [Sistema Legado](#sistema-legado-verde-militar) no fim deste arquivo — não o trate como morto, é o que está realmente renderizando na maior parte do produto hoje. Ao trabalhar numa tela, confira em qual dos dois sistemas ela já está antes de copiar convenção de uma pra outra.

**Creative North Star: "A Ficha de Balança"**

Todo caminhão que sai da fábrica já carrega uma ficha de pesagem impressa em matriz de pontos — densa, numerada em sequência, o objeto de papel que testemunha aquela carga. FertiLog copia esse objeto pra dentro da tela: cada carregamento é um canhoto de papel (claro, rasgado no topo, com furo de picote) flutuando sobre um fundo quase-preto; o estado do carregamento (solicitado/enviado/liberado/confirmado) é literalmente um carimbo de borracha carimbado sobre o papel, rotacionado, com textura de tinta gasta. A tipografia inteira dessas telas é monoespaçada — não só nos números, no título também — reforçando a sensação de formulário impresso, não de painel de vidro.

Rejeições confirmadas: nada de card genérico com sombra suave flutuante (a hierarquia vem da borda/forma do papel, não de `box-shadow` decorativo); nada de badge de pílula colorida pra status — é sempre o carimbo; nada de fundo de página claro (só o canhoto do ticket é claro, o resto continua escuro); nada de motion genérico de showcase (fade-in de seção, parallax, hover que escala card) — é ferramenta operacional.

**Motion (revisado em 2026-09-24):** animação é permitida em Login e Programação **somente quando ela é a própria metáfora física** — o carimbo batendo no papel ao mudar de status, a via saindo da impressora, a ficha nova caindo na prancheta, o caminhão entrando na balança. Não é enfeite: é o evento do sistema ficando visível. Implementado com Framer Motion (`motion/react`, springs e `animate()` sobre motion values), e toda animação obrigatoriamente respeita `prefers-reduced-motion` (corta pro estado final sem física de mola) — motorista/logística usa no pátio e no celular, enjoo vestibular não é opcional. Nada anima no carregamento de uma lista já existente (`AnimatePresence initial={false}`): só o que acabou de acontecer.

**1ª via (Login) = cena "Painel da balança"** (2026-09-24, direção C escolhida pelo usuário entre três geradas; substituiu a cena "Granulado organomineral", descartada no mesmo dia). Fundo quase-preto chapado, sem foto, em **duas telas de rolagem** — decisão deliberada: o formulário nunca é empurrado pra baixo nas telas baixas dos operadores (≈650 px úteis), e o total da semana é algo que a pessoa **desce pra ver de propósito**. **Tela 1 (100 svh):** a fenda da impressora (régua tracejada verde, relógio à direita) e a **1ª via** em si, o login, num `Ticket variant="continuo"` (rasgo reto irregular de picote + furos de tracionamento nos dois lados, `.ticket-continuo` em `globals.css`), que sai da fenda **linha por linha** assim que a página abre (tween com easing em degraus, `avancoDePapel`, 30 passos em 1 s); o carimbo EMITIDO bate quando o papel termina de sair (`useTicketPrinted()`). No rodapé, a chamada "Total carregado na semana ⌄" (botão, `scrollIntoView`). **Tela 2 (100 svh):** o painel **TOTAL CARREGADO NA SEMANA** com o status da balança à direita (`Aguardando` âmbar pulsando → `Pesando` → `Estável` verde) — contador mecânico de placas split-flap (`weight-readout.tsx`: fita 0-9 por algarismo, os da direita dão mais voltas e param por último, desfoque só durante a rolagem) que rola até o **total real** de ordens diárias finalizadas de segunda a sábado (lido no servidor com service role em `login/page.tsx`; sem leitura → `--` e "Sem leitura", nunca número inventado); embaixo, a ponte da balança com a guarita (`public/login/ponte-vazia.jpg`) e o **caminhão-tanque como camada separada** (`public/login/caminhao-tanque.jpg`, ambos traço técnico em JPEG escuro misturado com `mix-blend-mode: lighten` — o blend fica no wrapper que tem o transform, senão o fundo da placa vaza). **O scroll é o que traz o caminhão:** a posição dele está ligada ao progresso da rolagem até o fim da página (`useScroll` + `useSpring` 60/20 + `useTransform` −160 % → 0 %), então descer é ver o caminhão entrar na ponte; quando ele chega (progresso > 0,88) o contador começa a rolar. No login bem-sucedido, ele acelera e sai pela direita antes da troca de tela (`useLoginSceneExit()`, chamado pelo `LoginForm`). Geometria das camadas medida nos arquivos (constantes `PONTE`/`CAMINHAO` em `login-scene.tsx`); se trocar a placa, medir de novo e **renomear o arquivo** — o otimizador do Next cacheia por URL e serve a proporção antiga. Todos os blocos são `shrink-0`: numa coluna `min-h-svh` o flex comprimia a ponte e o ticket até sumirem em vez de deixar a página rolar. Com reduced-motion: tudo já no lugar, sem sequência.

**2ª via (Programação) — motion (2026-09-24):** ficha nova (criada aqui ou chegando pelo realtime) cai na coluna e assenta (`FICHA_NO_AR` → spring, rotação −3° → 0°); ficha removida esmaece; as vizinhas deslizam com `layout="position"` (só translação, nunca escala — texto não distorce). A coluna de sábado desliza pra dentro/fora da prancheta animando `flexGrow`/`flexBasis`/`minWidth` (desktop) ou `height` (celular) — as outras colunas reacomodam por reflow real, sem scale de layout animation. O colapso de um dia usa a mesma transição. O carimbo bate ao trocar de status (`Stamp`, `initial={false}` → nunca no load).

**Prancheta centrada e cargas concluídas recolhidas (2026-09-25):** uma coluna aberta tem teto de largura (`COLUNA_MAX_PX` = 360) e a prancheta é `justify-center` — ao minimizar dias, as colunas que sobram não esticam até ocupar a tela: ficam com largura de ficha e o conjunto (minimizadas + abertas, na ordem da semana) se centraliza. Dentro do dia, carga **concluída = chegada confirmada pelo faturamento** (`confirmado_em`) nasce recolhida a uma ficha de duas linhas (`FichaCompacta`: cliente, tonelagem, hora da chegada, seta) — só as cargas que ainda faltam aparecem com a ficha completa. Clicar na compacta abre a ficha inteira (estado `fichasAbertas`, por sessão); "Recolher" dentro dela devolve pra linha. É a mesma superfície de papel, só menos linhas impressas — não é um card diferente.

**Key Characteristics:**
- Cartão de carga = ticket de papel (claro) sobre fundo escuro — não card com sombra.
- Estado = carimbo de borracha (cor + rotação + textura), nunca badge/pílula.
- Tipografia mono como voz de TODA a tela, não só de dado numérico.
- Verde Fertiflora continua a única cor de ação (CTA, foco) — carimbos usam tons próprios, mais foscos, propositalmente distintos do verde de ação.
- Cada tela migrada abre com um marcador "Nª via" (1ª via = acesso, 2ª via = programação...) — o app inteiro é tratado como cópias-carbono do mesmo formulário contínuo.

## Colors

### Primary
- **Verde Fertiflora** (`#3B9038` / `brand-600`): única cor de ação em qualquer sistema (novo ou legado) — CTA, foco, links. Hover `#4FB142` (`brand-500`).

### Ticket ("Ficha de Balança" — Login, Programação)
- **Papel** (`#ece1c8` / `ticket-paper`): fundo do canhoto — a única superfície clara do app fora da impressão.
- **Borda do papel** (`#d9cbab` / `ticket-edge`).
- **Tinta** (`#201c14` / `ticket-ink`): texto primário sobre o papel.
- **Tinta suave** (`#5a5340` / `ticket-ink-soft`): label, placeholder, texto secundário sobre o papel.
- **Régua** (`#362f21` / `ticket-rule`): as réguas duplas (`.ticket-rule`) e divisórias tracejadas dentro do ticket.

### Carimbos de status (stamp)
- **Solicitado** (`#545b52`): cinza-ardósia — ainda não saiu daqui.
- **Enviado à transportadora** (`#9c5510`): ferrugem/âmbar.
- **Liberado** (`#2f7a2c`): verde — deliberadamente mais fosco que o `brand-600` de ação (tinta carimbada não é botão).
- **Confirmado** (`#2a4d8f`): azul — chegada do caminhão confirmada, supera visualmente o "Liberado" (ver Named Rule abaixo).

### Neutral (fundo escuro — ambos os sistemas)
- **Oliva Quase-Preto** (`#12160C` / `industrial-50`): fundo de página.
- **Superfície de Card** (`#191E11` / `industrial-100`): cards legados, inputs, modais.
- **Marfim Verde-Claro** (`#F4F7EC` / `industrial-900`): texto primário sobre fundo escuro.

### Semantic
- **Sucesso** (`#10B981`), **Alerta** (`#f97316`), **Perigo** (`#ef4444`), **Info** (`#3b82f6`) — usados no sistema legado (ver regra da tinta translúcida lá embaixo); no sistema Ticket, estado é carimbo, não cor semântica solta.

### Named Rules
**A Regra do Carimbo Duplo.** `confirmado_em` (chegada) sempre supera `solicitacao_status` na escolha do carimbo — uma carga confirmada já passou por liberação, então mostrar "Confirmado" é mais informativo que repetir "Liberado". O horário exato da chegada some do carimbo (que só tem espaço pra uma palavra) e vira uma legenda pequena abaixo do total.

## Typography

**Sistema Ticket:** JetBrains Mono é a fonte de TUDO — título de página, kicker, corpo, label, número. Não há uma fonte de display separada aqui; a uniformidade mono é o ponto.
**Sistema Legado:** Outfit (display/título), Inter (corpo), JetBrains Mono (só número).

### Hierarchy (Ticket)
- **Título de página** (`text-fluid-title`, mono, extrabold): `<h1>` de Login/Programação — clamp 18px→22px de viewport, sem salto de breakpoint.
- **Nome de cliente** (mono, extrabold, uppercase, ~17px): a linha mais proeminente de cada ticket.
- **Corpo** (mono, ~12.5-13px): itens, observação, metadados de transportadora/motorista.
- **Carimbo** (mono, extrabold, uppercase, letra rotacionada): a palavra de estado.

### Named Rules
**A Regra do Número Tabular.** Todo dado numérico usa `font-variant-numeric: tabular-nums` (classe `.font-mono`) — nos dois sistemas.

## Layout

**Marcador de via:** toda tela migrada abre com `.via-tag` — "1ª VIA · ACESSO" (login), "2ª VIA · PROGRAMAÇÃO DE CARREGAMENTO" — um rótulo mono pequeno + linha tracejada preenchendo o resto da largura. Ao migrar a próxima tela, dê a ela a próxima via em sequência e registre aqui (3ª via já reservada, mas não atribuída ainda).

**Grade da semana (Programação):** `grid-cols-1 md:grid-cols-3 xl:grid-cols-5|6` (5 quando "Ocultar sábado" está ativo). Colunas de dia adjacentes ganham `border-left dashed` a partir de `md:` — não é um card por dia, é só uma régua entre colunas.

Container padrão `max-w-7xl` / `.app-container` continua valendo pro restante do app (sistema legado).

## Elevation & Depth

**Sistema Ticket:** o ticket usa `filter: drop-shadow(...)` (duas camadas, sem blur colorido) pra parecer um papel fisicamente solto sobre o fundo — não é decoração, é a única pista de profundidade da tela inteira. Nada mais nessas duas telas tem sombra.

**Sistema Legado:** ver `shadow-industrial` / `shadow-glow-*` / `shadow-editorial` na seção Legado.

## Shapes

**Sistema Ticket:** topo do canhoto é um recorte em ziguezague (`clip-path`, classe `.ticket-shell`) simulando papel rasgado — nunca `border-radius` nessa borda. Controles (botão "Entrar", "Ocultar sábado") usam raio quase reto (`2px`, `rounded-[2px]`) — o oposto do sistema legado, que arredonda containers generosamente. Carimbo tem seu próprio recorte irregular (`clip-path`) simulando borda de borracha desgastada.

### Named Rules
**A Regra do Papel vs. Vidro.** Se o elemento é o "documento" (o ticket em si), ele tem textura/recorte físico. Se é um controle de interação (botão, input, toggle), ele é preciso e quase reto — nunca os dois registros no mesmo elemento.

## Components

### Ticket
Fonte de verdade: `src/components/ui/ticket.tsx`. Canhoto de papel (`ticket-shell`) com furo de picote (`ticket-punch`, círculo no canto superior esquerdo) e número de sequência real no canto superior direito (`seq` — vira link quando há PDF, ex. a ordem de carregamento; nunca um número inventado). `TicketRule` é a régua dupla interna; `.ticket-dash` divide itens dentro do ticket.

### Stamp
Fonte de verdade: `src/components/ui/stamp.tsx`. Uma das 4 cores de carimbo (ver Colors), rotação determinística por id (`rotFor()` em `_programacao.tsx` — nunca `Math.random`, quebraria a hidratação SSR), `mix-blend-mode: multiply` + textura repetida simulando tinta. Uma linha (`stamp-1l`) ou duas (`stamp-2l`, ex. "Enviado" / "Transportadora").

### Buttons (variante `ticket`)
`src/components/ui/button.tsx`, variante `ticket` (aditiva — as variantes antigas continuam intactas pro sistema legado): fundo `brand-600`, texto `ticket-paper`, mono, uppercase, tracking `.08em`, `rounded-[2px]`.

### Navigation
Sidebar continua no sistema legado (verde floresta `spruce`) em toda tela — não foi migrada; é chrome persistente do app, fora do escopo desta leva.

## Do's and Don'ts

### Do:
- **Do** manter o verde Fertiflora (`#3B9038`) como única cor de ação em qualquer sistema.
- **Do** usar `Stamp` (carimbo) pra estado no sistema Ticket — nunca um badge de pílula ali.
- **Do** dar a cada tela migrada seu próprio "Nª via" em sequência.
- **Do** manter o corpo inteiro em mono nas telas do sistema Ticket — não misturar Inter/Outfit nelas.
- **Do** manter campos de formulário em `16px` no mobile (evita zoom do iOS).
- **Do** verificar em qual sistema (Ticket ou Legado) uma tela já está antes de copiar um padrão de outra tela.

### Don't:
- **Don't** aplicar o motivo "canhoto de papel" em modais/diálogos — eles continuam no vocabulário legado (decisão explícita desta leva; não é omissão).
- **Don't** usar carimbo (`Stamp`) fora de uma superfície `Ticket` clara — o `mix-blend-mode: multiply` só funciona sobre o papel.
- **Don't** truncar observação/nº de pedido do cliente com `truncate` — deixe quebrar linha; é informação real (nº de pedido), não decoração.
- **Don't** usar motion genérico de showcase (fade de seção, parallax, hover escalando card) — é operacional, não marketing. Motion só quando é a metáfora física (carimbo batendo, papel rasgando; ver Overview), e toda transição respeita `prefers-reduced-motion`.

---

## Sistema Legado (verde-militar)

Ainda em produção em Recebimento, Transportadoras, Solicitações, Ordens, Fórmulas, Painel TV e todos os modais. Não editar esta seção como se fosse histórico morto.

**Creative North Star: "O Posto de Comando Noturno"** — superfície quase-preta com tinta verde-oliva, verde Fertiflora raro e pontual, cantos generosos em containers vs. contidos em controles.

### Colors
- **Verde-claro de acento** (`#94D97D` / `brand-300`): texto/ícone sobre chip translúcido.
- **Verde Floresta Profundo** (`#124C27` / `spruce-700`): sidebar, superfícies de marca.
- **Borda Sutil** (`#29301C` / `industrial-200`) / **Borda Padrão** (`#3B4429` / `industrial-300`).
- **Texto Suave** (`#94A07E` / `industrial-500`).

**A Regra da Tinta Translúcida.** Sobre fundo escuro, todo estado semântico usa fundo translúcido (`bg-*-500/10` a `/25`) com texto claro (`*-300`/`*-400`) — nunca preenchimento sólido `bg-*-50`/`*-100`.

### Typography
Outfit (display/título), Inter (corpo, `text-sm`), JetBrains Mono (só número, `tabular-nums`).

### Layout
`max-w-7xl` / `.app-container`, `px-4` mobile / `px-6` `md:`. Cards `p-4` → `md:p-6`.

### Elevation & Depth
- `shadow-industrial` (`0 1px 2px rgba(6,40,21,.35), 0 8px 24px -12px rgba(0,0,0,.5)`): sombra padrão de card.
- `shadow-glow-green` / `-orange` / `-red` (`0 0 12px rgba(...,.2-.25)`): halo em elemento ativo/alerta — nunca decoração pura.
- `shadow-editorial`: elevação forte (modal, PDF preview).

### Shapes
Containers generosos (`rounded-lg` 0.875rem → `rounded-2xl` 1.75rem); controles contidos (`rounded-md` 0.375rem, default Tailwind). Badges `rounded-full`.

### Components
- **Buttons** (`src/components/ui/button.tsx`): `primary` (`bg-brand-600`→`bg-brand-500`), `secondary` (`bg-industrial-300`), `danger`, `warning`, `ghost` (o mais comum — texto + hover `bg-industrial-200`), `outline`. Tamanhos `sm/md/lg/icon`.
- **Badges**: pílula, borda + fundo translúcido do tom semântico.
- **Cards**: `rounded-xl`, `industrial-100` sobre `industrial-50`, `shadow-industrial`, borda 1px `industrial-200`.
- **Inputs**: `industrial-100` bg, borda `industrial-300`→`industrial-400` hover, `rounded-md`, `h-10`, `16px` abaixo de `md:`.
- **Navigation**: sidebar `spruce`, ícone ativo `leaf`/`brand-300`; command palette item selecionado `bg-brand-600/10 text-brand-300`.

### Do's and Don'ts
- **Do** raio contido em controles, generoso em containers.
- **Do** curva `glide` (`cubic-bezier(0.16,1,0.3,1)`, padrão do Tailwind config — vale pros dois sistemas) em toda transição; `entrance` (`cubic-bezier(0.22,1,0.36,1)`) só em confirmações raras de alto valor.
- **Don't** segunda cor de marca "quente" concorrendo com o verde.
- **Don't** tema claro fora do contexto de impressão.
