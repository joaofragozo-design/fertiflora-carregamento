export const ROUTES = {
  LOGIN:         '/login',
  HOME:          '/',
  CARREGAMENTO:  '/carregamento',
  PA:            '/pa',
} as const

export const ROLE_DEFAULT_ROUTES = {
  operador_carregamento: ROUTES.CARREGAMENTO,
  operador_pa:           ROUTES.PA,
  admin:                 ROUTES.CARREGAMENTO,
} as const

// Rotas que cada role pode acessar (além de HOME)
export const ROLE_ALLOWED_ROUTES: Record<string, string[]> = {
  operador_carregamento: [ROUTES.CARREGAMENTO],
  operador_pa:           [ROUTES.PA],
  admin:                 [ROUTES.CARREGAMENTO, ROUTES.PA],
}
