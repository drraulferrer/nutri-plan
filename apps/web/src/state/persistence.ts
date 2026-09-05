import { PreferencesSchema } from '@nutri-plan/core';
import type { TelegramWebApp } from '../tg/types';
import type { AppState, Persisted } from './types';

export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

/** Preferencias en CloudStorage de Telegram (docs/00 T-06). Límite: 4096 caracteres por clave. */
export function cloudStore(app: TelegramWebApp): KeyValueStore {
  // El SDK lanza una excepción síncrona si el cliente no soporta CloudStorage (< 6.9).
  return {
    get: (key) =>
      new Promise((resolve) => {
        try {
          app.CloudStorage.getItem(key, (err, value) => resolve(err ? null : value || null));
        } catch {
          resolve(null);
        }
      }),
    set: (key, value) =>
      new Promise((resolve, reject) => {
        try {
          app.CloudStorage.setItem(key, value, (err) => (err ? reject(err) : resolve()));
        } catch (e) {
          reject(e);
        }
      }),
    remove: (key) =>
      new Promise((resolve) => {
        try {
          app.CloudStorage.removeItem(key, () => resolve());
        } catch {
          resolve();
        }
      }),
  };
}

/** Menú, lista y despensa en localStorage: caché local, funciona sin red (RF-27). */
export function localStore(prefix = 'np:'): KeyValueStore {
  const safe = <T>(fn: () => T, fallback: T): T => {
    try {
      return fn();
    } catch {
      return fallback;
    }
  };
  return {
    get: async (key) => safe(() => localStorage.getItem(prefix + key), null),
    set: async (key, value) => safe(() => localStorage.setItem(prefix + key, value), undefined),
    remove: async (key) => safe(() => localStorage.removeItem(prefix + key), undefined),
  };
}

const KEYS = {
  prefs: 'prefs',
  menu: 'menu',
  list: 'list',
  listPeople: 'listPeople',
  pantry: 'pantry',
  favorites: 'favorites',
} as const;

function parseJson<T>(raw: string | null, guard: (v: unknown) => v is T): T | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return guard(value) ? value : null;
  } catch {
    return null;
  }
}

const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isMenu = (v: unknown): v is Persisted['menu'] => isObject(v) && Array.isArray(v['slots']) && typeof v['week_start'] === 'string';
const isList = (v: unknown): v is Persisted['list'] => isObject(v) && Array.isArray(v['items']) && typeof v['people'] === 'number';
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export async function loadPersisted(cloud: KeyValueStore, local: KeyValueStore): Promise<Partial<Persisted>> {
  const [prefsRaw, menuRaw, listRaw, peopleRaw, pantryRaw, favRaw] = await Promise.all([
    cloud.get(KEYS.prefs),
    local.get(KEYS.menu),
    local.get(KEYS.list),
    local.get(KEYS.listPeople),
    local.get(KEYS.pantry),
    local.get(KEYS.favorites),
  ]);
  const prefsParsed = prefsRaw ? PreferencesSchema.safeParse(safeJson(prefsRaw)) : null;
  return {
    prefs: prefsParsed?.success ? prefsParsed.data : null,
    menu: parseJson(menuRaw, isMenu),
    list: parseJson(listRaw, isList),
    listPeople: parseJson(peopleRaw, isNumber),
    pantry: parseJson(pantryRaw, isStringArray) ?? [],
    favorites: parseJson(favRaw, isStringArray) ?? [],
  };
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function savePersisted(cloud: KeyValueStore, local: KeyValueStore, state: AppState): Promise<void> {
  const put = (store: KeyValueStore, key: string, value: unknown) =>
    value === null || value === undefined ? store.remove(key) : store.set(key, JSON.stringify(value));
  await Promise.all([
    put(cloud, KEYS.prefs, state.prefs).catch(() => put(local, KEYS.prefs, state.prefs)),
    put(local, KEYS.menu, state.menu),
    put(local, KEYS.list, state.list),
    put(local, KEYS.listPeople, state.listPeople),
    put(local, KEYS.pantry, state.pantry),
    put(local, KEYS.favorites, state.favorites),
  ]);
}

export async function clearPersisted(cloud: KeyValueStore, local: KeyValueStore): Promise<void> {
  await Promise.all([cloud.remove(KEYS.prefs), ...Object.values(KEYS).map((k) => local.remove(k))]);
}
