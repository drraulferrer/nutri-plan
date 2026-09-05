import { describe, expect, it } from 'vitest';
import { buildCatalog, type Catalog, type Preferences } from '@nutri-plan/core';
import { initialState, reducer } from './reducer';
import type { AppState } from './types';
import recipes from '../../public/recipes.json';
import ingredients from '../../public/ingredients.json';

const { catalog } = buildCatalog(ingredients as unknown[], (recipes as unknown[]).map((data, i) => ({ file: String(i), data })));

const prefs: Preferences = {
  people: 2,
  days: 7,
  include_snacks: false,
  cook_time: '30',
  budget: 'medio',
  styles: ['mediterraneo'],
  allergens: [],
  allergens_confirmed: true,
  disliked_ingredients: [],
};

function loaded(c: Catalog = catalog): AppState {
  return reducer(initialState, { type: 'loaded', catalog: c, persisted: {} });
}

function withMenu(): AppState {
  const s = reducer(loaded(), { type: 'prefs/save', prefs });
  return reducer(s, { type: 'menu/generate', seed: 'a', weekStart: '2026-09-07' });
}

describe('reducer', () => {
  it('carga catálogo y datos persistidos', () => {
    const s = reducer(initialState, { type: 'loaded', catalog, persisted: { pantry: ['arroz'], favorites: ['x'] } });
    expect(s.loaded).toBe(true);
    expect(s.pantry).toEqual(['arroz']);
    expect(s.favorites).toEqual(['x']);
    expect(s.menu).toBeNull();
  });

  it('genera menú y lista; no muta el estado anterior', () => {
    const before = reducer(loaded(), { type: 'prefs/save', prefs });
    const snapshot = JSON.stringify(before);
    const s = reducer(before, { type: 'menu/generate', seed: 'a', weekStart: '2026-09-07' });
    expect(s.menu?.slots.length).toBe(21);
    expect(s.list?.items.length).toBeGreaterThan(0);
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it('no genera menú sin preferencias', () => {
    expect(reducer(loaded(), { type: 'menu/generate', seed: 'a', weekStart: '2026-09-07' }).menu).toBeNull();
  });

  it('cambiar personas en preferencias escala el menú y la lista', () => {
    const s = reducer(withMenu(), { type: 'prefs/save', prefs: { ...prefs, people: 4 } });
    expect(s.menu?.people).toBe(4);
    expect(s.menu?.slots.every((x) => x.servings === 4)).toBe(true);
    expect(s.list?.people).toBe(4);
  });

  it('marcar "ya lo tengo" añade a la despensa y conserva la marca al recalcular', () => {
    const s0 = withMenu();
    const slug = s0.list!.items[0]!.ingredient;
    const s1 = reducer(s0, { type: 'list/mark', slug, have_it: true });
    expect(s1.pantry).toContain(slug);
    const s2 = reducer(s1, { type: 'list/set-people', people: 3 });
    expect(s2.list!.items.find((i) => i.ingredient === slug)!.have_it).toBe(true);
    expect(s2.list!.people).toBe(3);
    const s3 = reducer(s2, { type: 'list/mark', slug, have_it: false });
    expect(s3.pantry).not.toContain(slug);
  });

  it('comer fuera vacía el hueco y la lista se actualiza', () => {
    const s0 = withMenu();
    const total = s0.list!.items.length;
    const s1 = reducer(s0, { type: 'menu/set-slot', day: 0, meal: 'comida', recipe: null });
    expect(s1.menu!.slots.find((x) => x.day_index === 0 && x.meal === 'comida')!.recipe_slug).toBeNull();
    expect(s1.list!.items.length).toBeLessThanOrEqual(total);
  });

  it('bloquear un hueco lo protege al regenerar la semana', () => {
    const s0 = reducer(withMenu(), { type: 'menu/toggle-lock', day: 1, meal: 'cena' });
    const before = s0.menu!.slots.find((x) => x.day_index === 1 && x.meal === 'cena')!;
    const s1 = reducer(s0, { type: 'menu/regenerate', seed: 'zzz', scope: { scope: 'week' } });
    const after = s1.menu!.slots.find((x) => x.day_index === 1 && x.meal === 'cena')!;
    expect(after.recipe_slug).toBe(before.recipe_slug);
    expect(after.is_locked).toBe(true);
  });

  it('favoritos alternan', () => {
    const s1 = reducer(loaded(), { type: 'favorites/toggle', slug: 'a' });
    expect(s1.favorites).toEqual(['a']);
    expect(reducer(s1, { type: 'favorites/toggle', slug: 'a' }).favorites).toEqual([]);
  });

  it('reset borra todo menos el catálogo', () => {
    const s = reducer(withMenu(), { type: 'reset' });
    expect(s.prefs).toBeNull();
    expect(s.menu).toBeNull();
    expect(s.catalog).toBe(catalog);
    expect(s.loaded).toBe(true);
  });
});
