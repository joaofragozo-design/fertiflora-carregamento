export type UserRole = 'operador_carregamento' | 'operador_pa' | 'admin' | 'logistica' | 'logistica_02' | 'faturamento' | 'transportadora'

export interface AppUser {
  id:         string
  username:   string
  /** Nome de exibição escolhido em Configurações — não altera o login (username). */
  apelido?:   string | null
  avatar_url?: string | null
  role:       UserRole
  created_at: string
}
