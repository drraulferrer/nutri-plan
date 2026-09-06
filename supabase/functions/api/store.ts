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
  /** Origen del menú guardado (columna `menus.source`). */
  menu_source?: 'reglas' | 'ia';
}

export interface Profile {
  id: string;
  created_at: string;
}

export interface CatalogRows {
  recipes: unknown[];
  ingredients: unknown[];
}

export interface AiUsageRecord {
  model: string;
  input_tokens: number;
  output_tokens: number;
  outcome: string;
}

/** Acceso a datos desacoplado de Supabase para poder probar las rutas en memoria. */
export interface Store {
  upsertProfile(telegramUserId: bigint, languageCode?: string): Promise<Profile>;
  /** Perfil existente sin crearlo (rutas del bot). */
  findProfile(telegramUserId: bigint): Promise<Profile | null>;
  recordAiUsage(profileId: string, usage: AiUsageRecord): Promise<void>;
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
