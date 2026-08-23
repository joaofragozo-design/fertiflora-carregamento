import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono, Outfit } from 'next/font/google'
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

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-mono',
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
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
    <html lang="pt-BR">
      <body className={`${inter.variable} ${jetbrainsMono.variable} ${outfit.variable} bg-industrial-50 min-h-screen`}>
        <Providers initialUser={initialUser}>
          {children}
        </Providers>
        <SwRegister />
      </body>
    </html>
  )
}
