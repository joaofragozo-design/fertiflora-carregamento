export type UserRole = 'operador_carregamento' | 'operador_pa' | 'admin' | 'logistica' | 'logistica_02' | 'faturamento'

export interface AppUser {
  id:         string
  username:   string
  role:       UserRole
  created_at: string
}
