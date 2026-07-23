export const ROUTES = {
  LOGIN:             '/login',
  HOME:              '/',
  CARREGAMENTO:      '/carregamento',
  PA:                '/pa',
  ORDENS:            '/ordens',
  ORDENS_RELATORIO:  '/ordens/relatorio',
  PROGRAMACAO:       '/programacao',
  RECEBIMENTO:       '/recebimento',
  ADMIN_FORMULAS:    '/admin/formulas',
  TRANSPORTADORA:    '/transportadora',
  TRANSPORTADORAS:   '/transportadoras',
} as const

export const ROLE_DEFAULT_ROUTES = {
  operador_carregamento: ROUTES.CARREGAMENTO,
  operador_pa:           ROUTES.PA,
  admin:                 ROUTES.CARREGAMENTO,
  logistica:             ROUTES.ORDENS,
  logistica_02:          ROUTES.ORDENS,
  faturamento:           ROUTES.ORDENS,
  transportadora:        ROUTES.TRANSPORTADORA,
} as const

// Rotas que cada role pode acessar (além de HOME)
export const ROLE_ALLOWED_ROUTES: Record<string, string[]> = {
  operador_carregamento: [ROUTES.CARREGAMENTO],
  operador_pa:           [ROUTES.PA],
  admin:                 [ROUTES.CARREGAMENTO, ROUTES.PA, ROUTES.ORDENS, ROUTES.PROGRAMACAO, ROUTES.RECEBIMENTO, ROUTES.ADMIN_FORMULAS, ROUTES.TRANSPORTADORA, ROUTES.TRANSPORTADORAS],
  logistica:             [ROUTES.ORDENS, ROUTES.PROGRAMACAO, ROUTES.RECEBIMENTO, ROUTES.ADMIN_FORMULAS, ROUTES.TRANSPORTADORAS],
  logistica_02:          [ROUTES.ORDENS, ROUTES.PROGRAMACAO],
  faturamento:           [ROUTES.ORDENS, ROUTES.PROGRAMACAO, ROUTES.RECEBIMENTO, ROUTES.ORDENS_RELATORIO],
  transportadora:        [ROUTES.TRANSPORTADORA],
}
