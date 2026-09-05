/** Todas las cadenas visibles de la app (docs/00 D-07). */
export const es = {
  app: { name: 'Nutri Plan', tagline: 'Nutri Plan organiza. Para dudas, pregunta a Nutri en el chat.' },
  home: {
    greeting: (name: string) => `Hola, ${name} 👋`,
    plan: 'Planificar mi semana',
    viewMenu: 'Ver mi menú',
    cook: 'Cocinar con lo que tengo',
    list: 'Mi lista de compra',
    prefs: 'Mis preferencias',
    start: 'Empezar',
    noPrefs: 'Cuéntanos para cuántas personas cocinas y qué te gusta.',
    phase: 'Fase 0 · esqueleto. Las pantallas llegan en la Fase 1 (docs/10).',
  },
  common: { back: 'Atrás', offline: 'Sin conexión · mostrando la última versión guardada' },
} as const;
