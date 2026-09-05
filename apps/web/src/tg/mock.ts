import type { BackButton, BottomButton, TelegramWebApp, ThemeParams } from './types';

/**
 * Simulación del SDK para desarrollar en un navegador normal (docs/03 §1 y §9).
 * Guarda CloudStorage en localStorage y registra las acciones en consola.
 */

const LIGHT: ThemeParams = {
  bg_color: '#ffffff',
  text_color: '#000000',
  hint_color: '#707579',
  link_color: '#3390ec',
  button_color: '#3390ec',
  button_text_color: '#ffffff',
  secondary_bg_color: '#f4f4f5',
  header_bg_color: '#ffffff',
  accent_text_color: '#3390ec',
  section_bg_color: '#ffffff',
  section_header_text_color: '#707579',
  subtitle_text_color: '#707579',
  destructive_text_color: '#df3f40',
  section_separator_color: '#e7e7e8',
  bottom_bar_bg_color: '#f4f4f5',
};

const DARK: ThemeParams = {
  bg_color: '#212121',
  text_color: '#ffffff',
  hint_color: '#aaaaaa',
  link_color: '#8774e1',
  button_color: '#8774e1',
  button_text_color: '#ffffff',
  secondary_bg_color: '#181818',
  header_bg_color: '#212121',
  accent_text_color: '#8774e1',
  section_bg_color: '#212121',
  section_header_text_color: '#aaaaaa',
  subtitle_text_color: '#aaaaaa',
  destructive_text_color: '#ff595a',
  section_separator_color: '#2c2c2c',
  bottom_bar_bg_color: '#181818',
};

function mockBottomButton(name: string): BottomButton {
  const handlers = new Set<() => void>();
  const button: BottomButton = {
    text: '',
    isVisible: false,
    isActive: true,
    setText(text) {
      button.text = text;
      return button;
    },
    show() {
      button.isVisible = true;
      return button;
    },
    hide() {
      button.isVisible = false;
      return button;
    },
    enable() {
      button.isActive = true;
      return button;
    },
    disable() {
      button.isActive = false;
      return button;
    },
    showProgress: () => button,
    hideProgress: () => button,
    onClick(cb) {
      handlers.add(cb);
      return button;
    },
    offClick(cb) {
      handlers.delete(cb);
      return button;
    },
  };
  Object.defineProperty(button, '__click', { value: () => handlers.forEach((h) => h()), enumerable: false });
  Object.defineProperty(button, '__name', { value: name, enumerable: false });
  return button;
}

function mockBackButton(): BackButton {
  const handlers = new Set<() => void>();
  const button: BackButton = {
    isVisible: false,
    show() {
      button.isVisible = true;
      return button;
    },
    hide() {
      button.isVisible = false;
      return button;
    },
    onClick(cb) {
      handlers.add(cb);
      return button;
    },
    offClick(cb) {
      handlers.delete(cb);
      return button;
    },
  };
  Object.defineProperty(button, '__click', { value: () => handlers.forEach((h) => h()), enumerable: false });
  return button;
}

export function createMockWebApp(dark = false): TelegramWebApp {
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>();
  const store = typeof localStorage !== 'undefined' ? localStorage : undefined;
  const log = (...args: unknown[]) => console.info('[tg-mock]', ...args);
  return {
    initData: '',
    initDataUnsafe: { user: { id: 0, first_name: 'Invitado', language_code: 'es' } },
    version: '9.0',
    platform: 'web-mock',
    colorScheme: dark ? 'dark' : 'light',
    themeParams: dark ? DARK : LIGHT,
    isExpanded: true,
    viewportStableHeight: typeof window !== 'undefined' ? window.innerHeight : 700,
    BackButton: mockBackButton(),
    MainButton: mockBottomButton('main'),
    SecondaryButton: mockBottomButton('secondary'),
    SettingsButton: { show: () => undefined, hide: () => undefined, onClick: () => undefined, offClick: () => undefined },
    HapticFeedback: { impactOccurred: () => undefined, notificationOccurred: () => undefined, selectionChanged: () => undefined },
    CloudStorage: {
      setItem: (k, v, cb) => {
        store?.setItem(`tg:${k}`, v);
        cb?.(null, true);
      },
      getItem: (k, cb) => cb(null, store?.getItem(`tg:${k}`) ?? ''),
      removeItem: (k, cb) => {
        store?.removeItem(`tg:${k}`);
        cb?.(null, true);
      },
    },
    ready: () => log('ready'),
    expand: () => log('expand'),
    close: () => log('close'),
    isVersionAtLeast: () => true,
    setHeaderColor: (c) => log('setHeaderColor', c),
    setBackgroundColor: (c) => log('setBackgroundColor', c),
    setBottomBarColor: (c) => log('setBottomBarColor', c),
    disableVerticalSwipes: () => undefined,
    enableClosingConfirmation: () => undefined,
    disableClosingConfirmation: () => undefined,
    openTelegramLink: (url) => log('openTelegramLink', url),
    openLink: (url) => log('openLink', url),
    showAlert: (m, cb) => {
      log('alert', m);
      cb?.();
    },
    showConfirm: (m, cb) => {
      log('confirm', m);
      cb?.(true);
    },
    onEvent: (e, h) => {
      if (!listeners.has(e)) listeners.set(e, new Set());
      listeners.get(e)!.add(h);
    },
    offEvent: (e, h) => listeners.get(e)?.delete(h),
  };
}
