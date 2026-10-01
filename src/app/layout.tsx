import type { Metadata, Viewport } from 'next'
import { Inter, Outfit } from 'next/font/google'
import localFont from 'next/font/local'
import { Providers } from '@/providers'
import { getAuthUser } from '@/lib/supabase/get-user'
import { SwRegister } from '@/components/pwa/sw-register'
import '@/styles/globals.css'

// Fontes da identidade compartilhada com o FertiFlora STO:
// Inter no texto, JetBrains Mono nos números, Outfit nos títulos de marca.
const inter = Inter({
  variable: '--font-sans',
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
})

// JetBrains Mono 2.304 (variável) com o ponto de dentro do 0 removido: o 0
// pontilhado era confundido com 8 no pátio. Mesma largura, layout intacto.
const jetbrainsMono = localFont({
  src: '../fonts/JetBrainsMono-SemZero.woff2',
  variable: '--font-mono',
  weight: '100 800',
  display: 'swap',
})

/** Geométrica de display para títulos de telas de marca (login, onboarding) */
const outfit = Outfit({
  variable: '--font-display',
  weight: ['500', '600', '700'],
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: {
    default: 'FertiLog',
    // Sem %s de propósito: a aba mostra sempre só a marca, em todas as
    // telas, mesmo nas páginas que definem `title` próprio.
    template: 'FertiLog',
  },
  description: 'FertiLog — sistema de carregamento e logística da Fertiflora.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'FertiLog',
  },
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  themeColor: '#12160C',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const initialUser = await getAuthUser()

  return (
    // Variáveis de fonte no <html> (não no body): o preflight do Tailwind
    // define a font-family base no html, e var() não re-resolve de um nível
    // abaixo — no body, o app inteiro cairia na fonte do sistema.
    <html lang="pt-BR" className={`${inter.variable} ${jetbrainsMono.variable} ${outfit.variable}`}>
      <body className="bg-industrial-50 min-h-screen">
        <Providers initialUser={initialUser}>
          {children}
        </Providers>
        <SwRegister />
      </body>
    </html>
  )
}
