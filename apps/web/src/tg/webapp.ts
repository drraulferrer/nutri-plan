import { createMockWebApp } from './mock';
import type { TelegramWebApp, ThemeParams } from './types';

export type StartScreen = 'menu' | 'lista' | 'cocinar' | 'inicio';

/** Devuelve el SDK real si la app corre dentro de Telegram; si no, la simulación. */
export function getWebApp(): { app: TelegramWebApp; isReal: boolean } {
  const real = typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined;
  if (real && real.initData) return { app: real, isReal: true };
  const prefersDark = typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  return { app: real ?? createMockWebApp(Boolean(prefersDark)), isReal: false };
}

/** Aplica themeParams como variables CSS de reserva y la clase de esquema (docs/03 §3). */
export function applyTheme(app: TelegramWebApp, root: HTMLElement = document.documentElement): void {
  const params: ThemeParams = app.themeParams ?? {};
  for (const [key, value] of Object.entries(params)) {
    if (value) root.style.setProperty(`--tg-theme-${key.replace(/_/g, '-')}`, value);
  }
  root.dataset['tgScheme'] = app.colorScheme;
}

/** Arranque estándar: listo, expandido, sin cierre por gesto, colores de barras. */
export function bootstrap(app: TelegramWebApp): void {
  app.ready();
  app.expand();
  app.disableVerticalSwipes?.();
  app.setHeaderColor('secondary_bg_color');
  app.setBackgroundColor('bg_color');
  if (app.isVersionAtLeast('7.10')) app.setBottomBarColor?.('bottom_bar_bg_color');
}

/** Traduce `start_param` (docs/03 §2) a la pantalla inicial. */
export function startScreenFrom(startParam: string | undefined): StartScreen {
  switch (startParam) {
    case 'menu':
    case 'lista':
    case 'cocinar':
      return startParam;
    default:
      return 'inicio';
  }
}
