/** Subconjunto tipado del SDK de Telegram Mini Apps que usa Nutri Plan (docs/03). */

export interface ThemeParams {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  secondary_bg_color?: string;
  header_bg_color?: string;
  accent_text_color?: string;
  section_bg_color?: string;
  section_header_text_color?: string;
  subtitle_text_color?: string;
  destructive_text_color?: string;
  section_separator_color?: string;
  bottom_bar_bg_color?: string;
}

export interface WebAppUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface BottomButton {
  text: string;
  isVisible: boolean;
  isActive: boolean;
  setText(text: string): BottomButton;
  show(): BottomButton;
  hide(): BottomButton;
  enable(): BottomButton;
  disable(): BottomButton;
  showProgress(leaveActive?: boolean): BottomButton;
  hideProgress(): BottomButton;
  onClick(cb: () => void): BottomButton;
  offClick(cb: () => void): BottomButton;
}

export interface BackButton {
  isVisible: boolean;
  show(): BackButton;
  hide(): BackButton;
  onClick(cb: () => void): BackButton;
  offClick(cb: () => void): BackButton;
}

export interface HapticFeedback {
  impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void;
  notificationOccurred(type: 'error' | 'success' | 'warning'): void;
  selectionChanged(): void;
}

export interface CloudStorage {
  setItem(key: string, value: string, cb?: (err: Error | null, ok?: boolean) => void): void;
  getItem(key: string, cb: (err: Error | null, value?: string) => void): void;
  removeItem(key: string, cb?: (err: Error | null, ok?: boolean) => void): void;
}

export interface TelegramWebApp {
  initData: string;
  initDataUnsafe: { user?: WebAppUser; start_param?: string; query_id?: string; auth_date?: number };
  version: string;
  platform: string;
  colorScheme: 'light' | 'dark';
  themeParams: ThemeParams;
  isExpanded: boolean;
  viewportStableHeight: number;
  BackButton: BackButton;
  MainButton: BottomButton;
  SecondaryButton?: BottomButton;
  SettingsButton: { show(): void; hide(): void; onClick(cb: () => void): void; offClick(cb: () => void): void };
  HapticFeedback: HapticFeedback;
  CloudStorage: CloudStorage;
  ready(): void;
  expand(): void;
  close(): void;
  isVersionAtLeast(version: string): boolean;
  setHeaderColor(color: string): void;
  setBackgroundColor(color: string): void;
  setBottomBarColor?(color: string): void;
  disableVerticalSwipes?(): void;
  enableClosingConfirmation(): void;
  disableClosingConfirmation(): void;
  openTelegramLink(url: string): void;
  openLink(url: string, options?: { try_instant_view?: boolean }): void;
  showAlert(message: string, cb?: () => void): void;
  showConfirm(message: string, cb?: (ok: boolean) => void): void;
  onEvent(event: string, handler: (...args: unknown[]) => void): void;
  offEvent(event: string, handler: (...args: unknown[]) => void): void;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}
