import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type Dispatch, type ReactNode } from 'react';
import { defaultWeekStart } from '@nutri-plan/core';
import { ApiError, createApiClient, type ApiClient } from '../api/client';
import { loadCatalog } from '../data/catalog';
import type { TelegramWebApp } from '../tg/types';
import { cloudStore, clearPersisted, loadPersisted, localStore, savePersisted } from './persistence';
import { initialState, reducer } from './reducer';
import { newSeed } from './selectors';
import { mergeOnStart, patchFingerprint, remoteToPersisted, stateToPatch } from './sync';
import type { Action, AppState } from './types';

export interface AppContextValue {
  state: AppState;
  dispatch: Dispatch<Action>;
  app: TelegramWebApp;
  isReal: boolean;
  botUsername: string;
  /** Genera el menú en el servidor si hay sesión; si no, en este dispositivo. */
  generateMenu: () => Promise<void>;
  clearAll: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

interface Props {
  app: TelegramWebApp;
  isReal: boolean;
  botUsername: string;
  apiBaseUrl?: string | undefined;
  children: ReactNode;
}

const PUSH_DEBOUNCE_MS = 800;
const RETRY_MS = 30_000;

export function AppProvider({ app, isReal, botUsername, apiBaseUrl, children }: Props) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const stores = useMemo(() => ({ cloud: cloudStore(app), local: localStore() }), [app]);
  const api = useMemo<ApiClient | null>(
    () => createApiClient({ baseUrl: apiBaseUrl, initData: isReal ? app.initData : '', clientVersion: __APP_VERSION__ }),
    [apiBaseUrl, isReal, app],
  );
  const saveTimer = useRef<number | undefined>(undefined);
  const pushTimer = useRef<number | undefined>(undefined);
  /** Huella del último estado conocido por el servidor; evita subir lo que acabamos de bajar. */
  const remoteFingerprint = useRef<string | null>(null);
  const sessionReady = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  // ── Arranque: catálogo + datos locales, después sesión con el servidor ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [catalog, persisted] = await Promise.all([loadCatalog(), loadPersisted(stores.cloud, stores.local)]);
        if (cancelled) return;
        dispatch({ type: 'loaded', catalog, persisted });
        if (!api) return;
        dispatch({ type: 'sync/status', status: 'syncing' });
        const session = await api.session();
        if (cancelled) return;
        const merge = mergeOnStart(persisted, session.state);
        if (merge.persisted) {
          remoteFingerprint.current = patchFingerprint(stateToPatch(reducer(stateRef.current, { type: 'state/replace', persisted: merge.persisted })));
          dispatch({ type: 'state/replace', persisted: merge.persisted });
        } else if (!merge.pushLocal) {
          remoteFingerprint.current = patchFingerprint(stateToPatch(stateRef.current));
        }
        sessionReady.current = true;
        dispatch({ type: 'sync/status', status: merge.pushLocal ? 'pending' : 'synced' });
      } catch (e: unknown) {
        if (cancelled) return;
        if (!stateRef.current.loaded) {
          dispatch({ type: 'load-failed', message: e instanceof Error ? e.message : String(e) });
        } else if (e instanceof ApiError && e.isAuth) {
          dispatch({ type: 'sync/status', status: 'local' });
        } else {
          sessionReady.current = true;
          dispatch({ type: 'sync/status', status: 'offline' });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [stores, api]);

  // ── Persistencia local (caché offline) ──
  const { loaded, prefs, menu, list, listPeople, pantry, favorites } = state;
  useEffect(() => {
    if (!loaded) return;
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void savePersisted(stores.cloud, stores.local, stateRef.current).catch((e: unknown) => console.warn('[persist]', e));
    }, 250);
  }, [loaded, prefs, menu, list, listPeople, pantry, favorites, stores]);

  // ── Subida al servidor con reintento ──
  const push = useCallback(async () => {
    if (!api || !sessionReady.current) return;
    const patch = stateToPatch(stateRef.current);
    const fingerprint = patchFingerprint(patch);
    if (fingerprint === remoteFingerprint.current) {
      dispatch({ type: 'sync/status', status: 'synced' });
      return;
    }
    try {
      dispatch({ type: 'sync/status', status: 'syncing' });
      await api.putState(patch);
      remoteFingerprint.current = fingerprint;
      dispatch({ type: 'sync/status', status: patchFingerprint(stateToPatch(stateRef.current)) === fingerprint ? 'synced' : 'pending' });
    } catch (e: unknown) {
      if (e instanceof ApiError && e.isAuth) {
        sessionReady.current = false;
        dispatch({ type: 'sync/status', status: 'local' });
        return;
      }
      dispatch({ type: 'sync/status', status: 'offline' });
    }
  }, [api]);

  useEffect(() => {
    if (!loaded || !api) return;
    window.clearTimeout(pushTimer.current);
    pushTimer.current = window.setTimeout(() => void push(), PUSH_DEBOUNCE_MS);
  }, [loaded, prefs, menu, list, listPeople, pantry, favorites, api, push]);

  useEffect(() => {
    if (!api) return;
    const retry = () => void push();
    window.addEventListener('online', retry);
    const interval = window.setInterval(() => {
      if (stateRef.current.sync === 'offline' || stateRef.current.sync === 'pending') retry();
    }, RETRY_MS);
    return () => {
      window.removeEventListener('online', retry);
      window.clearInterval(interval);
    };
  }, [api, push]);

  const generateMenu = useCallback(async () => {
    const weekStart = defaultWeekStart(new Date());
    if (api && sessionReady.current && stateRef.current.sync !== 'local') {
      try {
        // El servidor debe conocer las preferencias actuales antes de planificar.
        await api.putState(stateToPatch(stateRef.current));
        const remote = await api.generateMenu({ week_start: weekStart, seed: newSeed() });
        const persisted = remoteToPersisted(remote);
        remoteFingerprint.current = patchFingerprint(stateToPatch(reducer(stateRef.current, { type: 'state/replace', persisted })));
        dispatch({ type: 'state/replace', persisted });
        dispatch({ type: 'sync/status', status: 'synced' });
        return;
      } catch (e: unknown) {
        console.warn('[generate] servidor no disponible, se genera en local', e);
      }
    }
    dispatch({ type: 'menu/generate', seed: newSeed(), weekStart });
  }, [api]);

  const clearAll = useCallback(async () => {
    await clearPersisted(stores.cloud, stores.local);
    if (api) await api.deleteMe().catch(() => undefined);
    remoteFingerprint.current = null;
    dispatch({ type: 'reset' });
  }, [api, stores]);

  const value = useMemo<AppContextValue>(
    () => ({ state, dispatch, app, isReal, botUsername, generateMenu, clearAll }),
    [state, app, isReal, botUsername, generateMenu, clearAll],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp debe usarse dentro de AppProvider');
  return ctx;
}
