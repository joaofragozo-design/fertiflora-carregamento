'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ClientesService } from '@/services/clientes.service'
import type { Cliente } from '@/types/cliente'

function ordenar(lista: Cliente[]): Cliente[] {
  return [...lista].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

/** Lista de clientes com sincronização em tempo real (novos cadastros aparecem sozinhos). */
export function useClientes(initial: Cliente[]) {
  const [clientes, setClientes] = useState<Cliente[]>(() => ordenar(initial))
  const supabase = useRef(createClient()).current
  const svc = useRef(new ClientesService(createClient())).current

  useEffect(() => {
    const channel = supabase
      .channel('clientes_changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'clientes_carregamento' },
        (payload) => {
          const novo = payload.new as Cliente
          setClientes((prev) => (prev.some((c) => c.id === novo.id) ? prev : ordenar([...prev, novo])))
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'clientes_carregamento' },
        (payload) => {
          const upd = payload.new as Cliente
          setClientes((prev) => ordenar(prev.map((c) => (c.id === upd.id ? upd : c))))
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase])

  const adicionarCliente = useCallback(async (nome: string) => {
    const novo = await svc.criar(nome)
    setClientes((prev) => (prev.some((c) => c.id === novo.id) ? prev : ordenar([...prev, novo])))
    return novo
  }, [svc])

  const editarCliente = useCallback(async (id: string, dados: { nome: string; codigo: number | null }) => {
    const atualizado = await svc.atualizar(id, dados)
    setClientes((prev) => ordenar(prev.map((c) => (c.id === id ? atualizado : c))))
    return atualizado
  }, [svc])

  return { clientes, adicionarCliente, editarCliente }
}
