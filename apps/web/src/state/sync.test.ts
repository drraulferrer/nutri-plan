import { describe, expect, it } from 'vitest';
import type { Menu, Preferences } from '@nutri-plan/core';
import type { RemoteState } from '../api/client';
import { initialState } from './reducer';
import { mergeOnStart, patchFingerprint, remoteToPersisted, stateToPatch } from './sync';

const prefs: Preferences = { people: 2, days: 7, include_snacks: false, cook_time: '30', budget: 'medio', styles: ['mediterraneo'], allergens: [], allergens_confirmed: true, disliked_ingredients: [] };
const menu: Menu = { week_start: '2026-09-07', days: 7, people: 2, seed: 's', slots: [], warnings: [] };
const empty: RemoteState = { preferences: null, menu: null, shopping_list: null, pantry: [], favorites: [], updated_at: null };

describe('mergeOnStart', () => {
  it('el servidor manda si tiene datos', () => {
    const remote: RemoteState = { ...empty, preferences: { ...prefs, people: 4 }, menu, shopping_list: { people: 3, items: [] }, pantry: ['arroz'], favorites: ['x'], updated_at: 't' };
    const r = mergeOnStart({ prefs }, remote);
    expect(r.pushLocal).toBe(false);
    expect(r.persisted?.prefs?.people).toBe(4);
    expect(r.persisted?.listPeople).toBe(3); // la lista tiene otras personas que el menú
    expect(r.persisted?.pantry).toEqual(['arroz']);
  });
  it('servidor vacío + datos locales ⇒ subir lo local', () => {
    expect(mergeOnStart({ prefs, menu }, empty)).toEqual({ persisted: null, pushLocal: true });
  });
  it('ambos vacíos ⇒ nada', () => {
    expect(mergeOnStart({}, empty)).toEqual({ persisted: null, pushLocal: false });
  });
});

describe('stateToPatch y huella', () => {
  it('omite preferencias nulas y cambia la huella al cambiar la despensa', () => {
    const a = stateToPatch({ ...initialState, pantry: ['arroz'] });
    expect('preferences' in a).toBe(false);
    expect(a.pantry).toEqual(['arroz']);
    const b = stateToPatch({ ...initialState, pantry: ['arroz', 'tomate'] });
    expect(patchFingerprint(a)).not.toBe(patchFingerprint(b));
  });
  it('remoteToPersisted deja listPeople en null si coincide con el menú', () => {
    expect(remoteToPersisted({ ...empty, menu, shopping_list: { people: 2, items: [] } }).listPeople).toBeNull();
  });
});
