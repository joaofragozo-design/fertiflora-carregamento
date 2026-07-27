import type { Metadata, Viewport } from 'next'
import { IBM_Plex_Sans, IBM_Plex_Mono, Petrona } from 'next/font/google'
import { Providers } from '@/providers'
import { getAuthUser } from '@/lib/supabase/get-user'
import { SwRegister } from '@/components/pwa/sw-register'
import '@/styles/globals.css'

const plexSans = IBM_Plex_Sans({
  variable: '--font-sans',
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
})

const plexMono = IBM_Plex_Mono({
  variable: '--font-mono',
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
})

/** Serifa editorial para títulos de telas de marca (login, onboarding) */
const petrona = Petrona({
  variable: '--font-display',
  weight: ['500', '600', '700'],
  style: ['normal', 'italic'],
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: {
    default: 'FertiFlora Operações',
    template: '%s | FertiFlora',
  },
  description: 'Sistema de controle de ordens de carregamento.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'FertiFlora',
  },
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  themeColor: '#f4f4f5',
  colorScheme: 'light',
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
      <body className={`${plexSans.variable} ${plexMono.variable} ${petrona.variable} bg-industrial-50 min-h-screen`}>
        <Providers initialUser={initialUser}>
          {children}
        </Providers>
        <SwRegister />
      </body>
    </html>
  )
}
