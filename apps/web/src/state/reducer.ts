import {
  buildShoppingList,
  planMenu,
  regenerateMenu,
  type Menu,
  type PlannerInput,
} from '@nutri-plan/core';
import type { Action, AppState } from './types';

export const initialState: AppState = {
  loaded: false,
  loadError: null,
  catalog: null,
  prefs: null,
  menu: null,
  list: null,
  listPeople: null,
  pantry: [],
  favorites: [],
};

/** Recalcula la lista a partir del menú conservando las marcas existentes. */
export function withList(state: AppState, fresh = false): AppState {
  if (!state.menu || !state.catalog) return { ...state, list: null };
  const list = buildShoppingList({
    slots: state.menu.slots,
    catalog: state.catalog,
    people: state.listPeople ?? state.menu.people,
    pantry: state.pantry,
    previous: fresh ? undefined : (state.list ?? undefined),
  });
  return { ...state, list };
}

function plannerInput(state: AppState, seed: string, weekStart: string): PlannerInput | null {
  if (!state.prefs || !state.catalog) return null;
  return {
    preferences: state.prefs,
    catalog: state.catalog,
    weekStart,
    seed,
    favorites: state.favorites,
    pantry: state.pantry,
  };
}

function updateSlot(
  menu: Menu,
  day: number,
  meal: string,
  patch: (slot: Menu['slots'][number]) => Menu['slots'][number],
): Menu {
  return {
    ...menu,
    slots: menu.slots.map((s) => (s.day_index === day && s.meal === meal ? patch(s) : s)),
  };
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'loaded': {
      const p = action.persisted;
      return withList({
        ...state,
        loaded: true,
        loadError: null,
        catalog: action.catalog,
        prefs: p.prefs ?? null,
        menu: p.menu ?? null,
        list: p.list ?? null,
        listPeople: p.listPeople ?? null,
        pantry: p.pantry ?? [],
        favorites: p.favorites ?? [],
      });
    }
    case 'load-failed':
      return { ...state, loaded: true, loadError: action.message };

    case 'prefs/save': {
      const next = { ...state, prefs: action.prefs };
      if (!next.menu) return next;
      const menu = { ...next.menu, people: action.prefs.people, slots: next.menu.slots.map((s) => ({ ...s, servings: action.prefs.people })) };
      return withList({ ...next, menu, listPeople: null });
    }

    case 'menu/generate': {
      const input = plannerInput(state, action.seed, action.weekStart);
      if (!input) return state;
      return withList({ ...state, menu: planMenu(input), listPeople: null }, true);
    }

    case 'menu/regenerate': {
      if (!state.menu) return state;
      const input = plannerInput(state, action.seed, state.menu.week_start);
      if (!input) return state;
      return withList({ ...state, menu: regenerateMenu(state.menu, input, action.scope) });
    }

    case 'menu/set-slot': {
      if (!state.menu) return state;
      const menu = updateSlot(state.menu, action.day, action.meal, (s) => ({
        ...s,
        recipe_slug: action.recipe,
        alternatives: s.alternatives.filter((a) => a !== action.recipe),
      }));
      return withList({ ...state, menu });
    }

    case 'menu/toggle-lock': {
      if (!state.menu) return state;
      return { ...state, menu: updateSlot(state.menu, action.day, action.meal, (s) => ({ ...s, is_locked: !s.is_locked })) };
    }

    case 'menu/set-week-start':
      return state.menu ? { ...state, menu: { ...state.menu, week_start: action.weekStart } } : state;

    case 'favorites/toggle': {
      const has = state.favorites.includes(action.slug);
      return { ...state, favorites: has ? state.favorites.filter((f) => f !== action.slug) : [...state.favorites, action.slug] };
    }

    case 'list/mark': {
      if (!state.list) return state;
      const { slug, checked, have_it } = action;
      const list = {
        ...state.list,
        items: state.list.items.map((i) =>
          i.ingredient === slug ? { ...i, ...(checked !== undefined ? { checked } : {}), ...(have_it !== undefined ? { have_it } : {}) } : i,
        ),
      };
      const pantry =
        have_it === true && !state.pantry.includes(slug)
          ? [...state.pantry, slug]
          : have_it === false
            ? state.pantry.filter((p) => p !== slug)
            : state.pantry;
      return { ...state, list, pantry };
    }

    case 'list/set-people': {
      const people = Math.min(8, Math.max(1, action.people));
      return withList({ ...state, listPeople: people });
    }

    case 'pantry/set':
      return { ...state, pantry: [...new Set(action.slugs)] };

    case 'reset':
      return { ...initialState, loaded: true, catalog: state.catalog };

    default:
      return state;
  }
}
