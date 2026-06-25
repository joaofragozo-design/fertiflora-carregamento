export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id:           string
          username:     string
          role:         'operador_carregamento' | 'operador_pa' | 'admin'
          created_at:   string
          insumo_prefs: Json
        }
        Insert: {
          id:            string
          username:      string
          role?:         'operador_carregamento' | 'operador_pa' | 'admin'
          created_at?:   string
          insumo_prefs?: Json
        }
        Update: {
          username?:     string
          role?:         'operador_carregamento' | 'operador_pa' | 'admin'
          insumo_prefs?: Json
        }
      }

      carregamentos: {
        Row: {
          id:          string
          insumo:      string
          quantidade:  number
          status:      'PENDENTE' | 'CARREGANDO' | 'CONCLUIDO'
          created_at:  string
          started_at:  string | null
          finished_at: string | null
        }
        Insert: {
          id?:          string
          insumo:       string
          quantidade:   number
          status?:      'PENDENTE' | 'CARREGANDO' | 'CONCLUIDO'
          created_at?:  string
          started_at?:  string | null
          finished_at?: string | null
        }
        Update: {
          status?:      'PENDENTE' | 'CARREGANDO' | 'CONCLUIDO'
          started_at?:  string | null
          finished_at?: string | null
        }
      }
    }
    Views: Record<string, never>
    Functions: {
      upsert_profile: {
        Args: {
          p_id:       string
          p_username: string
          p_role?:    'operador_carregamento' | 'operador_pa' | 'admin'
        }
        Returns: {
          id:         string
          username:   string
          role:       'operador_carregamento' | 'operador_pa' | 'admin'
          created_at: string
        }
      }
    }
    Enums: {
      carregamento_status: 'PENDENTE' | 'CARREGANDO' | 'CONCLUIDO'
      user_role:           'operador_carregamento' | 'operador_pa' | 'admin'
    }
  }
}
