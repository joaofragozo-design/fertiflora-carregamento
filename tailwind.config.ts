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
        // Tema dark industrial
        brand: {
          50:  '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          950: '#052e16',
        },
        industrial: {
          50:  '#09090b',  // texto escuro máximo
          100: '#18181b',  // texto primário
          200: '#27272a',
          300: '#3f3f46',  // texto secundário
          400: '#52525b',  // texto médio
          500: '#71717a',  // texto suave
          600: '#a1a1aa',  // texto muito suave
          700: '#d4d4d8',  // borda padrão
          800: '#e4e4e7',  // borda sutil
          900: '#ffffff',  // superfície (cards)
          950: '#f4f4f5',  // fundo de página
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
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'monospace'],
      },
      backgroundImage: {
        'grid-industrial': "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Cpath d='M0 40L40 0H20L0 20M40 40V20L20 40'/%3E%3C/g%3E%3C/svg%3E\")",
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
      },
    },
  },
  plugins: [],
}

export default config
