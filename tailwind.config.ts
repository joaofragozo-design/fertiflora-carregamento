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
        // Verde-folha da marca (degradê da logo) — CTAs, estados ativos, acentos
        brand: {
          50:  '#F1F8ED',
          100: '#E4F5DC',
          200: '#C3E8B2',
          300: '#9FD988',
          400: '#7FC46E',
          500: '#5FAE5B',
          600: '#427F49',
          700: '#315F39',
          800: '#24452A',
          900: '#173420',
          950: '#0E2415',
        },
        // Neutro quente orgânico (era zinc/gray genérico) — fundo, texto, bordas
        industrial: {
          50:  '#FCFBF6',  // fundo de página
          100: '#F7F5E9',  // superfície (cards)
          200: '#EFEDDF',  // borda sutil
          300: '#DEDBC4',  // borda padrão
          400: '#C7C3A6',  // texto muito suave
          500: '#9B9679',  // texto suave
          600: '#6E6B54',  // texto médio
          700: '#4A4838',  // texto secundário
          800: '#2E2C22',
          900: '#1E1C15',  // texto primário
          950: '#141209',  // texto escuro máximo
        },
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
        // Papel quente orgânico — superfícies de telas de marca (login, onboarding)
        paper: {
          50:  '#FCFBF6',
          100: '#F7F5E9',
          200: '#EFEDDF',
          300: '#DEDBC4',
          400: '#C7C3A6',
          500: '#9B9679',
          600: '#6E6B54',
          700: '#4A4838',
          800: '#2E2C22',
          900: '#1E1C15',
        },
        // Verde-folha da marca (degradê da logo) — acentos orgânicos, CTAs
        leaf: {
          100: '#E4F5DC',
          200: '#C3E8B2',
          300: '#9FD988',
          400: '#7FC46E',
          500: '#5FAE5B',
          600: '#427F49',
          700: '#315F39',
          900: '#173420',
        },
        // Teal do wordmark da marca — títulos, CTAs sólidos, autoridade
        spruce: {
          50:  '#E7F0EE',
          200: '#9AC2BB',
          400: '#2E7A70',
          500: '#1D6259',
          600: '#155048',
          700: '#0F3E39',
          800: '#0A2E2A',
          900: '#071F1D',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
        display: ['var(--font-display)', 'serif'],
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
        'industrial':  '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.06)',
        'glow-green':  '0 0 12px rgba(22,163,74,0.2)',
        'glow-orange': '0 0 12px rgba(249,115,22,0.2)',
        'glow-red':    '0 0 12px rgba(239,68,68,0.2)',
        'editorial':   '0 1px 2px rgba(30,28,21,0.05), 0 18px 40px -18px rgba(30,28,21,0.18), 0 34px 60px -32px rgba(66,127,73,0.22)',
      },
    },
  },
  plugins: [],
}

export default config
