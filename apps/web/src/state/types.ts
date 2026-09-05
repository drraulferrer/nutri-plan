import type { Catalog, MealType, Menu, Preferences, RegenerateScope, ShoppingList } from '@nutri-plan/core';

export interface AppState {
  loaded: boolean;
  loadError: string | null;
  catalog: Catalog | null;
  prefs: Preferences | null;
  menu: Menu | null;
  list: ShoppingList | null;
  /** Personas de la lista cuando difieren del menú (RF-24). */
  listPeople: number | null;
  pantry: string[];
  favorites: string[];
}

export interface Persisted {
  prefs: Preferences | null;
  menu: Menu | null;
  list: ShoppingList | null;
  listPeople: number | null;
  pantry: string[];
  favorites: string[];
}

export type Action =
  | { type: 'loaded'; catalog: Catalog; persisted: Partial<Persisted> }
  | { type: 'load-failed'; message: string }
  | { type: 'prefs/save'; prefs: Preferences }
  | { type: 'menu/generate'; seed: string; weekStart: string }
  | { type: 'menu/regenerate'; seed: string; scope: RegenerateScope }
  | { type: 'menu/set-slot'; day: number; meal: MealType; recipe: string | null }
  | { type: 'menu/toggle-lock'; day: number; meal: MealType }
  | { type: 'menu/set-week-start'; weekStart: string }
  | { type: 'favorites/toggle'; slug: string }
  | { type: 'list/mark'; slug: string; checked?: boolean; have_it?: boolean }
  | { type: 'list/set-people'; people: number }
  | { type: 'pantry/set'; slugs: string[] }
  | { type: 'reset' };
