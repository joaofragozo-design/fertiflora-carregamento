import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Verde Fertiflora (degradê da folha) — a cor protagonista da identidade
        // portada do STO: CTAs, links, estados ativos, acentos
        brand: {
          50:  '#EFFAEB',
          100: '#DDF4D4',
          200: '#BBE8A9',
          300: '#94D97D',
          400: '#6FC85B',
          500: '#4FB142',
          600: '#3B9038',
          700: '#2F7330',
          800: '#265927',
          900: '#1C431F',
          950: '#112B14',
        },
        // Verde de sucesso — semântico: confirmações, dia finalizado (paridade
        // com o STO; distinto do verde da marca pelo tom esmeralda)
        success: {
          50:  '#ECFDF5',
          100: '#D1FAE5',
          200: '#A7F3D0',
          400: '#34D399',
          500: '#10B981',
          600: '#059669',
          700: '#047857',
        },
        // Neutros do tema escuro (escala invertida: 50 = fundo quase-preto,
        // 900 = texto quase-branco), com tinta verde-militar — o "preto" da casa
        industrial: {
          50:  '#12160C',  // fundo de página (oliva quase preto)
          100: '#191E11',  // superfície (cards)
          200: '#29301C',  // borda sutil
          300: '#3B4429',  // borda padrão
          400: '#6F7A5C',  // texto muito suave
          500: '#94A07E',  // texto suave
          600: '#B2BC9E',  // texto médio
          700: '#CED6BC',  // texto secundário
          800: '#E5EAD7',
          900: '#F4F7EC',  // texto primário
          950: '#FFFFFF',
        },
        // Superfície de card sobre o fundo oliva
        surface: '#1C2213',
        warning: {
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
        },
        danger: {
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
        },
        info: {
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
        },
        paper: {
          50:  '#12160C',
          100: '#191E11',
          200: '#29301C',
          300: '#3B4429',
          400: '#6F7A5C',
          500: '#94A07E',
          600: '#B2BC9E',
          700: '#CED6BC',
          800: '#E5EAD7',
          900: '#F4F7EC',
        },
        // Acentos vivos sobre fundo escuro (ícones ativos da sidebar etc.)
        leaf: {
          100: '#DDF4D4',
          200: '#BBE8A9',
          300: '#94D97D',
          400: '#6FC85B',
          500: '#4FB142',
          600: '#3B9038',
          700: '#2F7330',
          900: '#1C431F',
        },
        // Verde profundo de floresta — superfícies de marca (sidebar, login)
        spruce: {
          50:  '#EBF6EE',
          200: '#A8D9B4',
          400: '#3E9155',
          500: '#277940',
          600: '#1B6232',
          700: '#124C27',
          800: '#0B371D',
          900: '#062815',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
        display: ['var(--font-display)', 'sans-serif'],
      },
      // Raios generosos da identidade STO — rounded-lg/xl/2xl mais amigáveis
      borderRadius: {
        lg: '0.875rem',
        xl: '1.25rem',
        '2xl': '1.75rem',
        '3xl': '2.25rem',
      },
      backgroundImage: {
        'grid-industrial': "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Cpath d='M0 40L40 0H20L0 20M40 40V20L20 40'/%3E%3C/g%3E%3C/svg%3E\")",
        'grain-paper': "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E\")",
      },
      animation: {
        'pulse-slow':    'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'blink':         'blink 1s step-end infinite',
        'slide-in-right':'slideInRight 0.3s ease-out',
        'slide-in-left': 'slideInLeft 0.3s ease-out',
        'fade-in':       'fadeIn 0.2s ease-out',
        'new-item':      'newItem 0.5s ease-out',
        'alert-pulse':   'alertPulse 1.5s ease-in-out 3',
        'screen-flash':  'screenFlash 0.5s ease-in-out 6',
      },
      keyframes: {
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        slideInRight: {
          from: { transform: 'translateX(100%)', opacity: '0' },
          to:   { transform: 'translateX(0)',    opacity: '1' },
        },
        slideInLeft: {
          from: { transform: 'translateX(-100%)', opacity: '0' },
          to:   { transform: 'translateX(0)',     opacity: '1' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        newItem: {
          '0%':   { opacity: '0', transform: 'translateY(-8px) scale(0.97)' },
          '60%':  { opacity: '1', transform: 'translateY(2px)  scale(1.01)' },
          '100%': { opacity: '1', transform: 'translateY(0)    scale(1)'    },
        },
        alertPulse: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(251,146,60,0)' },
          '50%':       { boxShadow: '0 0 0 8px rgba(251,146,60,0.25)' },
        },
        screenFlash: {
          '0%, 100%': { opacity: '0' },
          '50%':      { opacity: '1' },
        },
      },
      boxShadow: {
        'industrial':  '0 1px 2px rgba(6,40,21,0.35), 0 8px 24px -12px rgba(0,0,0,0.5)',
        'glow-green':  '0 0 12px rgba(79,177,66,0.25)',
        'glow-orange': '0 0 12px rgba(249,115,22,0.2)',
        'glow-red':    '0 0 12px rgba(239,68,68,0.2)',
        'editorial':   '0 1px 2px rgba(0,0,0,0.4), 0 12px 32px -12px rgba(0,0,0,0.5), 0 24px 56px -24px rgba(79,177,66,0.12)',
      },
    },
  },
  plugins: [],
}

export default config
