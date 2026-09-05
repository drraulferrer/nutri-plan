import { askNutriUrl, shareUrl } from '@nutri-plan/core';
import type { TelegramWebApp } from './types';

/** Puente app → chat de Nutri y compartir (docs/03 §5 y §6). */
export function createNutriBridge(app: TelegramWebApp, botUsername: string) {
  const appLink = `https://t.me/${botUsername}?startapp=lista`;
  return {
    /** Abre el chat con el mensaje prerrellenado; el usuario decide enviarlo. */
    ask(message: string): void {
      app.HapticFeedback.impactOccurred('light');
      app.openTelegramLink(askNutriUrl(botUsername, message));
    },
    share(text: string): void {
      app.openTelegramLink(shareUrl(appLink, text));
    },
    async copy(text: string): Promise<boolean> {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        return false;
      }
    },
    openChat(): void {
      app.openTelegramLink(`https://t.me/${botUsername}`);
    },
  };
}

export type NutriBridge = ReturnType<typeof createNutriBridge>;
