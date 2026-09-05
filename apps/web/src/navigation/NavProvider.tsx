import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';
import type { TelegramWebApp } from '../tg/types';
import { initialStack, navReducer, type Screen } from './navigation';
import type { StartScreen } from '../tg/webapp';

export interface Navigation {
  current: Screen;
  depth: number;
  push: (screen: Screen) => void;
  pop: () => void;
  replace: (screen: Screen) => void;
  reset: (screen: Screen) => void;
}

const NavContext = createContext<Navigation | null>(null);

interface Props {
  app: TelegramWebApp;
  start: StartScreen;
  children: ReactNode;
}

export function NavProvider({ app, start, children }: Props) {
  const [stack, dispatch] = useReducer(navReducer, start, initialStack);
  const current = stack[stack.length - 1] ?? { name: 'inicio' };

  // BackButton nativo de Telegram: visible fuera de Inicio, hace pop (docs/02).
  useEffect(() => {
    const onBack = () => dispatch({ type: 'pop' });
    if (stack.length > 1) app.BackButton.show();
    else app.BackButton.hide();
    app.BackButton.onClick(onBack);
    return () => {
      app.BackButton.offClick(onBack);
    };
  }, [app, stack.length]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [current]);

  const value = useMemo<Navigation>(
    () => ({
      current,
      depth: stack.length,
      push: (screen) => dispatch({ type: 'push', screen }),
      pop: () => dispatch({ type: 'pop' }),
      replace: (screen) => dispatch({ type: 'replace', screen }),
      reset: (screen) => dispatch({ type: 'reset', screen }),
    }),
    [current, stack.length],
  );

  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export function useNav(): Navigation {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error('useNav debe usarse dentro de NavProvider');
  return ctx;
}
