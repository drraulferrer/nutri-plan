import type { RemoteState, StatePatch } from '../api/client';
import type { AppState, Persisted } from './types';

export type SyncStatus =
  | 'local' // sin API o sin sesión válida: solo este dispositivo
  | 'syncing'
  | 'synced'
  | 'pending' // hay cambios locales sin subir
  | 'offline';

export function hasData(s: { preferences?: Persisted['prefs'] | null; prefs?: Persisted['prefs'] | null; menu?: Persisted['menu'] | null }): boolean {
  return Boolean(s.preferences ?? s.prefs ?? s.menu);
}

export function remoteToPersisted(remote: RemoteState): Persisted {
  return {
    prefs: remote.preferences,
    menu: remote.menu,
    list: remote.shopping_list,
    listPeople: remote.shopping_list && remote.menu && remote.shopping_list.people !== remote.menu.people ? remote.shopping_list.people : null,
    pantry: remote.pantry,
    favorites: remote.favorites,
  };
}

export function stateToPatch(state: AppState): StatePatch {
  return {
    ...(state.prefs ? { preferences: state.prefs } : {}),
    menu: state.menu,
    shopping_list: state.list,
    pantry: state.pantry,
    favorites: state.favorites,
  };
}

/** Huella estable para saber si hay cambios pendientes de subir. */
export function patchFingerprint(patch: StatePatch): string {
  return JSON.stringify(patch);
}

/**
 * Regla de arranque (docs/00 T-06, docs/10 Fase 2): el servidor manda si tiene datos; si está
 * vacío y este dispositivo tiene datos (Fase 1), se suben. Sin fusiones campo a campo en v1.
 */
export function mergeOnStart(
  local: Partial<Persisted>,
  remote: RemoteState,
): { persisted: Partial<Persisted> | null; pushLocal: boolean } {
  if (hasData(remote)) return { persisted: remoteToPersisted(remote), pushLocal: false };
  if (hasData({ prefs: local.prefs ?? null, menu: local.menu ?? null })) return { persisted: null, pushLocal: true };
  return { persisted: null, pushLocal: false };
}
