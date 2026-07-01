export const ROUTES = {
  LOGIN:             '/login',
  HOME:              '/',
  CARREGAMENTO:      '/carregamento',
  PA:                '/pa',
  ORDENS:            '/ordens',
  ORDENS_RELATORIO:  '/ordens/relatorio',
  PROGRAMACAO:       '/programacao',
  ADMIN_FORMULAS:    '/admin/formulas',
} as const

export const ROLE_DEFAULT_ROUTES = {
  operador_carregamento: ROUTES.CARREGAMENTO,
  operador_pa:           ROUTES.PA,
  admin:                 ROUTES.CARREGAMENTO,
  logistica:             ROUTES.ORDENS,
  logistica_02:          ROUTES.ORDENS,
  faturamento:           ROUTES.ORDENS,
} as const

// Rotas que cada role pode acessar (além de HOME)
export const ROLE_ALLOWED_ROUTES: Record<string, string[]> = {
  operador_carregamento: [ROUTES.CARREGAMENTO],
  operador_pa:           [ROUTES.PA],
  admin:                 [ROUTES.CARREGAMENTO, ROUTES.PA, ROUTES.ORDENS, ROUTES.PROGRAMACAO, ROUTES.ADMIN_FORMULAS],
  logistica:             [ROUTES.ORDENS, ROUTES.PROGRAMACAO, ROUTES.ADMIN_FORMULAS],
  logistica_02:          [ROUTES.ORDENS, ROUTES.PROGRAMACAO],
  faturamento:           [ROUTES.ORDENS, ROUTES.PROGRAMACAO, ROUTES.ORDENS_RELATORIO],
}
