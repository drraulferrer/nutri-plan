import { beforeEach, describe, expect, it } from 'vitest';
import { cloudStore, clearPersisted, loadPersisted, localStore, savePersisted } from './persistence';
import { initialState } from './reducer';
import { createMockWebApp } from '../tg/mock';

describe('persistencia', () => {
  beforeEach(() => localStorage.clear());
  const app = createMockWebApp();
  const cloud = cloudStore(app);
  const local = localStore();

  it('guarda y recupera preferencias válidas desde CloudStorage', async () => {
    const state = {
      ...initialState,
      prefs: { people: 3, days: 5 as const, include_snacks: true, cook_time: '15' as const, budget: 'ajustado' as const, styles: ['vegano' as const], allergens: [], allergens_confirmed: true, disliked_ingredients: [] },
      pantry: ['arroz'],
    };
    await savePersisted(cloud, local, state);
    const loaded = await loadPersisted(cloud, local);
    expect(loaded.prefs?.people).toBe(3);
    expect(loaded.prefs?.styles).toEqual(['vegano']);
    expect(loaded.pantry).toEqual(['arroz']);
    expect(loaded.menu).toBeNull();
  });

  it('ignora datos corruptos o con esquema inválido', async () => {
    localStorage.setItem('tg:prefs', '{"people": 99}');
    localStorage.setItem('np:menu', 'no-json');
    localStorage.setItem('np:pantry', '[1,2]');
    const loaded = await loadPersisted(cloud, local);
    expect(loaded.prefs).toBeNull();
    expect(loaded.menu).toBeNull();
    expect(loaded.pantry).toEqual([]);
  });

  it('clearPersisted deja todo vacío', async () => {
    await savePersisted(cloud, local, { ...initialState, favorites: ['x'] });
    await clearPersisted(cloud, local);
    const loaded = await loadPersisted(cloud, local);
    expect(loaded.favorites).toEqual([]);
    expect(localStorage.length).toBe(0);
  });
});
