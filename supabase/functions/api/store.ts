import type { Menu, Preferences, ShoppingList } from '../_shared/core/types.ts';

/** Estado completo de un usuario tal y como lo guarda y devuelve la API (docs/06). */
export interface UserState {
  preferences: Preferences | null;
  menu: Menu | null;
  shopping_list: ShoppingList | null;
  pantry: string[];
  favorites: string[];
  updated_at: string | null;
}

export interface StatePatch {
  preferences?: Preferences;
  menu?: Menu | null;
  shopping_list?: ShoppingList | null;
  pantry?: string[];
  favorites?: string[];
}

export interface Profile {
  id: string;
  created_at: string;
}

export interface CatalogRows {
  recipes: unknown[];
  ingredients: unknown[];
}

/** Acceso a datos desacoplado de Supabase para poder probar las rutas en memoria. */
export interface Store {
  upsertProfile(telegramUserId: bigint, languageCode?: string): Promise<Profile>;
  getState(profileId: string): Promise<UserState>;
  putState(profileId: string, patch: StatePatch): Promise<UserState>;
  deleteProfile(profileId: string): Promise<void>;
  addEvent(profileId: string, screen: string, action: string): Promise<void>;
  loadCatalog(): Promise<CatalogRows>;
  /** Devuelve el contador de la ventana tras incrementarlo. */
  bumpRateLimit(telegramUserId: bigint, bucket: string, windowStart: Date): Promise<number>;
}

export const EMPTY_STATE: UserState = {
  preferences: null,
  menu: null,
  shopping_list: null,
  pantry: [],
  favorites: [],
  updated_at: null,
};
