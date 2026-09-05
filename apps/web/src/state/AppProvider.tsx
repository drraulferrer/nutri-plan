import { createContext, useContext, useEffect, useMemo, useReducer, useRef, type Dispatch, type ReactNode } from 'react';
import { loadCatalog } from '../data/catalog';
import type { TelegramWebApp } from '../tg/types';
import { cloudStore, clearPersisted, loadPersisted, localStore, savePersisted } from './persistence';
import { initialState, reducer } from './reducer';
import type { Action, AppState } from './types';

export interface AppContextValue {
  state: AppState;
  dispatch: Dispatch<Action>;
  app: TelegramWebApp;
  isReal: boolean;
  botUsername: string;
  clearAll: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

interface Props {
  app: TelegramWebApp;
  isReal: boolean;
  botUsername: string;
  children: ReactNode;
}

export function AppProvider({ app, isReal, botUsername, children }: Props) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const stores = useMemo(() => ({ cloud: cloudStore(app), local: localStore() }), [app]);
  const saveTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadCatalog(), loadPersisted(stores.cloud, stores.local)])
      .then(([catalog, persisted]) => {
        if (!cancelled) dispatch({ type: 'loaded', catalog, persisted });
      })
      .catch((e: unknown) => {
        if (!cancelled) dispatch({ type: 'load-failed', message: e instanceof Error ? e.message : String(e) });
      });
    return () => {
      cancelled = true;
    };
  }, [stores]);

  const { loaded, prefs, menu, list, listPeople, pantry, favorites } = state;
  useEffect(() => {
    if (!loaded) return;
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void savePersisted(stores.cloud, stores.local, state).catch((e: unknown) => console.warn('[persist]', e));
    }, 250);
    // Solo se guarda cuando cambia algo persistible; `state` se lee dentro del temporizador.
  }, [loaded, prefs, menu, list, listPeople, pantry, favorites, stores, state]);

  const value = useMemo<AppContextValue>(
    () => ({
      state,
      dispatch,
      app,
      isReal,
      botUsername,
      clearAll: async () => {
        await clearPersisted(stores.cloud, stores.local);
        dispatch({ type: 'reset' });
      },
    }),
    [state, app, isReal, botUsername, stores],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp debe usarse dentro de AppProvider');
  return ctx;
}
