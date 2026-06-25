import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Providers } from '@/providers'
import { getAuthUser } from '@/lib/supabase/get-user'
import '@/styles/globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: {
    default: 'FERTI FLORA — Ordem de Carregamento',
    template: '%s | FERTI FLORA',
  },
  description: 'Sistema de comunicação em tempo real para controle de ordens de carregamento.',
  robots: {
    index: false,
    follow: false,
  },
}

export const viewport: Viewport = {
  themeColor: '#080808',
  colorScheme: 'dark',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Busca o perfil no servidor para hidratar o AuthProvider sem flash
  const initialUser = await getAuthUser()

  return (
    <html lang="pt-BR" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} bg-industrial-950 min-h-screen`}>
        <Providers initialUser={initialUser}>
          {children}
        </Providers>
      </body>
    </html>
  )
}
