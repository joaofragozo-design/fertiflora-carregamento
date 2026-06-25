export type UserRole = 'operador_carregamento' | 'operador_pa' | 'admin'

export interface AppUser {
  id:         string
  username:   string
  role:       UserRole
  created_at: string
}
