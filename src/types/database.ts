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
          id: string
          username: string
          role: 'operador_carregamento' | 'operador_pa' | 'admin' | 'logistica' | 'logistica_02'
          created_at: string
          insumo_prefs: Json
        }
        Insert: {
          id: string
          username: string
          role?: 'operador_carregamento' | 'operador_pa' | 'admin' | 'logistica' | 'logistica_02'
          created_at?: string
          insumo_prefs?: Json
        }
        Update: {
          username?: string
          role?: 'operador_carregamento' | 'operador_pa' | 'admin' | 'logistica' | 'logistica_02'
          insumo_prefs?: Json
        }
      }

      carregamentos: {
        Row: {
          id: string
          insumo: string
          quantidade: number
          conchas_executadas: number
          status:
            | 'SOLICITADO'
            | 'LIBERADO'
            | 'CONCLUIDO'
            | 'CANCELADO'
            | 'PENDENTE'
            | 'CARREGANDO'
          created_at: string
          started_at: string | null
          finished_at: string | null
        }

        Insert: {
          id?: string
          insumo: string
          quantidade: number
          conchas_executadas?: number
          status?:
            | 'SOLICITADO'
            | 'LIBERADO'
            | 'CONCLUIDO'
            | 'CANCELADO'
            | 'PENDENTE'
            | 'CARREGANDO'
          created_at?: string
          started_at?: string | null
          finished_at?: string | null
        }

        Update: {
          insumo?: string
          quantidade?: number
          conchas_executadas?: number
          status?:
            | 'SOLICITADO'
            | 'LIBERADO'
            | 'CONCLUIDO'
            | 'CANCELADO'
            | 'PENDENTE'
            | 'CARREGANDO'
          started_at?: string | null
          finished_at?: string | null
        }
      }
    }

    Views: Record<string, never>

    Functions: {
      upsert_profile: {
        Args: {
          p_id: string
          p_username: string
          p_role?: 'operador_carregamento' | 'operador_pa' | 'admin' | 'logistica' | 'logistica_02'
        }
        Returns: {
          id: string
          username: string
          role: string
          created_at: string
        }
      }
    }

    Enums: {
      user_role:
        | 'operador_carregamento'
        | 'operador_pa'
        | 'admin'
        | 'logistica'
        | 'logistica_02'
    }
  }
}