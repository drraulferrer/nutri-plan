import type { MealType } from '@nutri-plan/core';
import type { StartScreen } from '../tg/webapp';

export type Screen =
  | { name: 'inicio' }
  | { name: 'prefs'; firstRun?: boolean }
  | { name: 'menu' }
  | { name: 'lista' }
  | { name: 'cocinar' }
  | {
      name: 'receta';
      slug: string;
      from: 'menu' | 'cocinar' | 'lista';
      day?: number;
      meal?: MealType;
      available?: string[];
    };

export type NavAction = { type: 'push'; screen: Screen } | { type: 'pop' } | { type: 'replace'; screen: Screen } | { type: 'reset'; screen: Screen };

export function navReducer(stack: Screen[], action: NavAction): Screen[] {
  switch (action.type) {
    case 'push':
      return [...stack, action.screen];
    case 'pop':
      return stack.length > 1 ? stack.slice(0, -1) : stack;
    case 'replace':
      return [...stack.slice(0, -1), action.screen];
    case 'reset':
      return [action.screen];
  }
}

/** Pila inicial según `start_param` (docs/03 §2): siempre con Inicio debajo para que Atrás funcione. */
export function initialStack(start: StartScreen): Screen[] {
  const home: Screen = { name: 'inicio' };
  switch (start) {
    case 'menu':
      return [home, { name: 'menu' }];
    case 'lista':
      return [home, { name: 'lista' }];
    case 'cocinar':
      return [home, { name: 'cocinar' }];
    default:
      return [home];
  }
}
