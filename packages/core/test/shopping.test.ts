import { describe, expect, it } from 'vitest';
import type { MenuSlot } from '../src/types';
import {
  activeItems,
  buildShoppingList,
  diffShoppingLists,
  groupByCategory,
  haveItItems,
  setItemState,
  stapleItems,
} from '../src/shopping';
import { CATALOG } from './fixtures';

const slot = (day: number, meal: MenuSlot['meal'], recipe: string | null, servings = 2): MenuSlot => ({
  day_index: day,
  meal,
  recipe_slug: recipe,
  servings,
  alternatives: [],
  is_locked: false,
});

const item = (list: ReturnType<typeof buildShoppingList>, slug: string) => list.items.find((i) => i.ingredient === slug);

describe('buildShoppingList', () => {
  it('suma un ingrediente repetido entre recetas', () => {
    const list = buildShoppingList({ slots: [slot(0, 'comida', 'arroz-pollo'), slot(1, 'cena', 'pisto')], catalog: CATALOG, people: 2 });
    const tomate = item(list, 'tomate')!;
    expect(tomate.needed_qty).toBe(5);
    expect(tomate.buy_qty).toBe(5);
    expect(tomate.buy_label).toBe('5 ud');
    expect(tomate.source_slots).toEqual(['0-comida', '1-cena']);
  });

  it('convierte unidades mixtas y redondea a envase', () => {
    // tortilla-espinacas 200 g + arroz-salteado 150 g + revuelto-tofu 100 g = 450 g → 2 bolsas de 300 g
    const list = buildShoppingList({
      slots: [slot(0, 'cena', 'tortilla-espinacas'), slot(1, 'cena', 'arroz-salteado-huevo'), slot(2, 'cena', 'revuelto-tofu')],
      catalog: CATALOG,
      people: 2,
    });
    const esp = item(list, 'espinacas')!;
    expect(esp.needed_qty).toBe(450);
    expect(esp.buy_qty).toBe(600);
    expect(esp.buy_label).toBe('2 × bolsa de 300 g');
  });

  it('escala a 3 personas y redondea huevos a medias docenas', () => {
    // tortilla 4 + arroz-salteado 2 = 6 huevos para 2 → 9 para 3 → 2 × media docena
    const list = buildShoppingList({
      slots: [slot(0, 'cena', 'tortilla-espinacas', 3), slot(1, 'cena', 'arroz-salteado-huevo', 3)],
      catalog: CATALOG,
      people: 3,
    });
    const huevos = item(list, 'huevos')!;
    expect(huevos.needed_qty).toBe(9);
    expect(huevos.buy_qty).toBe(12);
    expect(huevos.buy_label).toBe('2 × media docena');
  });

  it('ignora ingredientes opcionales y huecos de comer fuera', () => {
    const list = buildShoppingList({ slots: [slot(0, 'cena', 'tortilla-espinacas'), slot(1, 'cena', null)], catalog: CATALOG, people: 2 });
    expect(item(list, 'cebolla')).toBeUndefined();
    expect(list.items.length).toBeGreaterThan(0);
  });

  it('separa básicos y marca lo que hay en la despensa', () => {
    const list = buildShoppingList({ slots: [slot(0, 'cena', 'arroz-salteado-huevo')], catalog: CATALOG, people: 2, pantry: ['arroz'] });
    expect(stapleItems(list).map((i) => i.ingredient)).toEqual(['aceite-oliva']);
    expect(haveItItems(list).map((i) => i.ingredient)).toEqual(['arroz']);
    expect(activeItems(list).map((i) => i.ingredient)).not.toContain('arroz');
  });

  it('escalar de 1 a 4 personas cuadruplica las cantidades exactas', () => {
    const one = buildShoppingList({ slots: [slot(0, 'comida', 'arroz-pollo', 1)], catalog: CATALOG, people: 1 });
    const four = buildShoppingList({ slots: [slot(0, 'comida', 'arroz-pollo', 4)], catalog: CATALOG, people: 4 });
    for (const i of one.items) {
      expect(item(four, i.ingredient)!.needed_qty).toBeCloseTo(i.needed_qty * 4, 5);
    }
  });

  it('ordena por categoría y alfabéticamente', () => {
    const list = buildShoppingList({ slots: [slot(0, 'comida', 'arroz-pollo'), slot(0, 'cena', 'tostada-queso')], catalog: CATALOG, people: 2 });
    const groups = groupByCategory(list.items);
    expect(groups.map((g) => g.category)).toEqual(['verduras_fruta', 'proteinas', 'lacteos', 'despensa', 'otros']);
    expect(groups[0]!.items.map((i) => i.name)).toEqual(['Cebolla', 'Tomate']);
  });

  it('conserva marcas al recalcular y devuelve el delta', () => {
    const before = buildShoppingList({ slots: [slot(0, 'cena', 'tortilla-espinacas'), slot(1, 'cena', 'pisto')], catalog: CATALOG, people: 2 });
    const marked = setItemState(before, 'tomate', { checked: true });
    expect(marked).not.toBe(before);
    const after = buildShoppingList({
      slots: [slot(0, 'cena', 'tortilla-espinacas'), slot(1, 'cena', 'sopa-pollo'), slot(2, 'cena', 'tostada-queso')],
      catalog: CATALOG,
      people: 2,
      previous: marked,
    });
    expect(item(after, 'tomate')!.checked).toBe(true);
    const delta = diffShoppingLists(marked, after);
    expect(delta.added.sort()).toEqual(['pan', 'pollo', 'puerro', 'queso', 'zanahoria']);
    expect(delta.removed.sort()).toEqual(['calabacin', 'cebolla']);
    expect(delta.changed).toEqual(['tomate']);
  });
});
