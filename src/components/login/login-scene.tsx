'use client'

import Image from 'next/image'
import {
  createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode,
} from 'react'
import { ChevronDown } from 'lucide-react'
import {
  animate, motion, useInView, useMotionValue, useMotionValueEvent, useReducedMotion, useScroll, useSpring, useTransform,
} from 'motion/react'
import { cn } from '@/lib/utils'
import { WeightReadout } from './weight-readout'

/** Total real carregado na semana corrente (ordens diárias finalizadas, seg–sáb). */
export interface CarregadoSemana {
  tons: number
  cargas: number
  inicio: string // YYYY-MM-DD (segunda)
  fim: string    // YYYY-MM-DD (sábado)
}

const PrintedContext = createContext(false)
const ExitContext = createContext<() => Promise<void>>(async () => {})

/** true depois que a 1ª via terminou de ser impressa (imediato com prefers-reduced-motion). */
export function useTicketPrinted() {
  return useContext(PrintedContext)
}
/** Faz o caminhão sair da balança; resolve quando ele já saiu de cena (imediato com reduced-motion). */
export function useLoginSceneExit() {
  return useContext(ExitContext)
}

/** Linhas do avanço de papel: a impressora matricial imprime em passos, não desliza. */
const LINHAS_IMPRESSAO = 30
const avancoDePapel = (t: number) => Math.min(1, Math.ceil(t * LINHAS_IMPRESSAO) / LINHAS_IMPRESSAO)

// Geometria das placas (medida nos arquivos, em % do quadro da balança):
// o caminhão é uma camada separada pra poder andar sobre a ponte.
const PONTE = { w: 2688, h: 494 }
const CAMINHAO = { w: 1730, h: 395, left: '11.8%', bottom: '19.7%', width: '64.4%' }

function formatarAgora(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}
function ddmm(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}
function formatarTons(t: number): string {
  return t.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

interface LoginSceneProps {
  children: ReactNode
  carregado: CarregadoSemana | null
}

/**
 * Cena da 1ª via em duas telas. **Tela 1 (login):** a impressora solta a 1ª
 * via pela fenda do topo assim que a página abre; quando o papel termina de
 * sair, o carimbo EMITIDO bate. No rodapé, uma chamada discreta convida a
 * descer. **Tela 2 (painel da balança):** a rolagem é o que traz o caminhão —
 * a posição dele sobre a ponte está ligada ao progresso do scroll (com mola);
 * quando ele chega, o contador rola até o total real carregado na semana e o
 * painel marca ESTÁVEL. Ao entrar no sistema, o caminhão acelera e sai pela
 * direita antes da troca de tela. Com prefers-reduced-motion: tudo já no
 * lugar, sem física.
 */
export function LoginScene({ children, carregado }: LoginSceneProps) {
  const reduceMotion = useReducedMotion()
  const [imprimindo, setImprimindo] = useState(false)
  const [impresso, setImpresso] = useState(false)
  const [chegou, setChegou] = useState(false)
  const [estavel, setEstavel] = useState(false)
  const [agora, setAgora] = useState<string | null>(null)

  const painelRef = useRef<HTMLElement>(null)
  const painelVisivel = useInView(painelRef, { amount: 0.45 })

  // Caminhão guiado pelo scroll: 0 = painel ainda fora da tela, 1 = página no fim.
  const { scrollYProgress } = useScroll({ target: painelRef, offset: ['start end', 'end end'] })
  const progresso = useSpring(scrollYProgress, { stiffness: 60, damping: 20, mass: 1 })
  const xScroll = useTransform(progresso, [0, 1], ['-160%', '0%'])
  const xSaida = useMotionValue(0)
  const saindo = useRef(false)

  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    if (v > 0.88) setChegou(true)
  })

  // Reduced-motion: cena pronta, sem sequência.
  useEffect(() => {
    if (reduceMotion) {
      setImprimindo(true)
      setImpresso(true)
      setChegou(true)
      setEstavel(true)
    }
  }, [reduceMotion])

  // A 1ª via começa a sair logo que a página abre (não depende do caminhão).
  useEffect(() => {
    if (reduceMotion !== false) return
    const id = setTimeout(() => setImprimindo(true), 250)
    return () => clearTimeout(id)
  }, [reduceMotion])

  // Sem leitura da semana não há o que rolar — o indicador já nasce "estável".
  useEffect(() => {
    if (!carregado) setEstavel(true)
  }, [carregado])

  // Com reduced-motion o caminhão já está na ponte; basta o painel aparecer.
  useEffect(() => {
    if (reduceMotion && painelVisivel) setChegou(true)
  }, [reduceMotion, painelVisivel])

  // Relógio do painel — só no cliente (fuso do operador, sem mismatch de hidratação).
  useEffect(() => {
    const tick = () => setAgora(formatarAgora(new Date()))
    tick()
    const id = setInterval(tick, 30_000)
    return () => clearInterval(id)
  }, [])

  // Saída de cena (login OK): o caminhão acelera e sai pela direita.
  const partir = useCallback(async () => {
    if (reduceMotion !== false || saindo.current) return
    saindo.current = true
    const largura = painelRef.current?.offsetWidth ?? 1000
    await animate(xSaida, largura * 1.3, { duration: 0.8, ease: [0.5, 0, 0.9, 0.4] })
  }, [reduceMotion, xSaida])

  const descerAoPainel = () => painelRef.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })

  const status = !chegou ? 'Aguardando' : !estavel ? 'Pesando' : 'Estável'

  return (
    <PrintedContext.Provider value={impresso}>
      <ExitContext.Provider value={partir}>
        {/* overflow-x-clip esconde o caminhão fora da ponte sem virar scroll container. */}
        <main className="relative overflow-x-clip bg-industrial-50 font-mono">
          {/* ── Tela 1: fenda da impressora + 1ª via ─────────────────── */}
          <section className="mx-auto flex min-h-svh w-full max-w-[1180px] flex-col px-5 pt-5 md:px-10 md:pt-6">
            {/* Fenda + papel andam juntos e ficam centrados na tela alta; em tela baixa encostam no topo. */}
            <div className="my-auto flex shrink-0 flex-col">
            <div className="flex shrink-0 items-center justify-between pb-2.5 text-[11px] uppercase tracking-[.14em] text-industrial-500">
              <span>Fertiflora · Balança rodoviária</span>
              <span className="tabular-nums text-industrial-400">{agora ?? '—'}</span>
            </div>
            <div className="panel-rule shrink-0" />

            <div className={cn('relative mx-auto w-full max-w-[432px] shrink-0 px-4 pt-5 [@media(max-height:760px)]:pt-2', !impresso && 'overflow-hidden')}>
              <motion.div
                initial={reduceMotion ? false : { y: '-108%' }}
                animate={{ y: imprimindo ? '0%' : '-108%' }}
                transition={reduceMotion ? { duration: 0 } : { duration: 1, ease: avancoDePapel }}
                onAnimationComplete={() => {
                  if (imprimindo) setImpresso(true)
                }}
              >
                {children}
              </motion.div>
            </div>
            </div>

            {/* Chamada pra descer: o total da semana fica na segunda tela, de propósito. */}
            <button
              type="button"
              onClick={descerAoPainel}
              className="mx-auto mb-5 flex shrink-0 items-center gap-2 pt-6 text-[11px] uppercase tracking-[.16em] text-industrial-500 transition-colors hover:text-brand-400"
            >
              Total carregado na semana
              <motion.span
                aria-hidden="true"
                animate={reduceMotion ? undefined : { y: [0, 3, 0] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                className="inline-flex"
              >
                <ChevronDown className="size-3.5" />
              </motion.span>
            </button>
          </section>

          {/* ── Tela 2: painel da balança + ponte ────────────────────── */}
          <section
            ref={painelRef}
            className="mx-auto flex min-h-svh w-full max-w-[1180px] flex-col px-5 pt-8 md:px-10 md:pt-10"
          >
            <div className="flex shrink-0 items-end justify-between gap-4 pb-2.5 text-[11px] uppercase tracking-[.14em] text-industrial-500">
              <span className="text-industrial-600">Total carregado na semana</span>
              <span className="flex items-center gap-2 text-industrial-600" aria-live="polite">
                <span
                  aria-hidden="true"
                  className={cn(
                    'size-2 rounded-full',
                    estavel ? 'bg-brand-400 shadow-[0_0_10px_rgb(111_200_91/0.85)]' : 'bg-warning-500 animate-pulse',
                  )}
                />
                {status}
              </span>
            </div>
            <div className="panel-rule shrink-0" />
            {carregado ? (
              <WeightReadout
                label="Total carregado na semana"
                value={formatarTons(carregado.tons)}
                unit="t"
                iniciar={chegou}
                onSettled={() => setEstavel(true)}
                className="shrink-0 py-5 text-[clamp(48px,9vw,112px)] md:py-7"
              />
            ) : (
              <p className="shrink-0 py-5 text-center text-[clamp(48px,9vw,112px)] font-extrabold leading-none text-industrial-300 md:py-7" aria-label="Total carregado na semana indisponível">
                --<span className="ml-[0.14em] text-[0.42em] font-bold lowercase">t</span>
              </p>
            )}
            <div className="panel-rule shrink-0" />
            <div className="flex shrink-0 justify-between gap-4 pt-2 text-[10px] uppercase tracking-[.1em] text-industrial-400">
              <span>Ordens finalizadas · seg a sáb</span>
              <span className="text-right">
                {carregado
                  ? `Semana ${ddmm(carregado.inicio)} – ${ddmm(carregado.fim)} · ${carregado.cargas} ${carregado.cargas === 1 ? 'carga' : 'cargas'}`
                  : 'Sem leitura'}
              </span>
            </div>

            {/* Ponte + caminhão: o scroll traz o caminhão até a ponte. */}
            <div
              aria-hidden="true"
              className="relative mx-auto mb-3 mt-auto w-full max-w-[1000px] shrink-0 pt-8"
              style={{ aspectRatio: `${PONTE.w} / ${PONTE.h}` }}
            >
              <Image
                src="/login/ponte-vazia.jpg"
                alt=""
                fill
                sizes="(min-width: 1080px) 1000px, 100vw"
                className="pointer-events-none select-none object-contain mix-blend-lighten"
              />
              {/* O blend fica no wrapper que tem o transform: um filho com
                  mix-blend-mode dentro de um stacking context só se mistura
                  com o próprio wrapper (vazio) e o fundo escuro da placa vaza. */}
              <motion.div
                className="absolute mix-blend-lighten will-change-transform"
                style={{ x: xSaida, left: CAMINHAO.left, bottom: CAMINHAO.bottom, width: CAMINHAO.width, aspectRatio: `${CAMINHAO.w} / ${CAMINHAO.h}` }}
              >
                <motion.div className="absolute inset-0" style={{ x: reduceMotion ? 0 : xScroll }}>
                  <Image
                    src="/login/caminhao-tanque.jpg"
                    alt=""
                    fill
                    sizes="(min-width: 1080px) 645px, 64vw"
                    className="pointer-events-none select-none object-contain"
                  />
                </motion.div>
              </motion.div>
            </div>
          </section>
        </main>
      </ExitContext.Provider>
    </PrintedContext.Provider>
  )
}
