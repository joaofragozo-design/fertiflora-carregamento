import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Providers } from '@/providers'
import { getAuthUser } from '@/lib/supabase/get-user'
import { SwRegister } from '@/components/pwa/sw-register'
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
  themeColor: '#0F172A',
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
    <html lang="pt-BR" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} bg-industrial-950 min-h-screen`}>
        <Providers initialUser={initialUser}>
          {children}
        </Providers>
        <SwRegister />
      </body>
    </html>
  )
}
