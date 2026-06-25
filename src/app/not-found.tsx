import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-industrial-texture p-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-danger-500/30 bg-danger-500/10">
        <AlertTriangle className="h-8 w-8 text-danger-400" />
      </div>
      <div>
        <h1 className="text-4xl font-bold text-industrial-50">404</h1>
        <p className="mt-2 text-industrial-400">Página não encontrada</p>
      </div>
      <Link
        href="/"
        className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-500 transition-colors"
      >
        Voltar ao início
      </Link>
    </main>
  )
}
