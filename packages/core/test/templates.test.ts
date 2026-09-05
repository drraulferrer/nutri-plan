import { describe, expect, it } from 'vitest';
import type { MenuSlot } from '../src/types';
import { buildShoppingList } from '../src/shopping';
import { planMenu } from '../src/planner';
import { recipeName } from '../src/catalog';
import {
  MAX_MESSAGE_CHARS,
  askNutriUrl,
  finalizeMessage,
  m1ChangeDish,
  m2MissingIngredient,
  m3AskAboutRecipe,
  m4ImproveMenu,
  m5NoMatch,
  m6SafetyRedirect,
  renderListText,
  shareUrl,
} from '../src/templates';
import { CATALOG, prefs } from './fixtures';

const slot = (day: number, meal: MenuSlot['meal'], recipe: string): MenuSlot => ({
  day_index: day,
  meal,
  recipe_slug: recipe,
  servings: 2,
  alternatives: [],
  is_locked: false,
});

describe('plantillas M1–M6', () => {
  const p = prefs({ styles: ['mediterraneo', 'vegetariano'], allergens: ['huevos'] });

  it('M1 incluye día, comida, plato, criterio, personas y restricciones', () => {
    const text = m1ChangeDish({ menuId: 'm1', slotId: 's9', dayIndex: 3, meal: 'cena', recipeName: 'Pisto' }, 'vegetariano y en menos de 20 minutos', p);
    expect(text).toBe(
      'Hola Nutri 👋 Quiero cambiar la cena del jueves (Pisto) por algo vegetariano y en menos de 20 minutos. Cocino para 2 personas, vegetariano, sin huevo. [NP menu:m1 slot:s9]',
    );
  });
  it('M2 y M3', () => {
    const r = CATALOG.recipes.get('crema-puerro')!;
    expect(m2MissingIngredient(r, 'puerro')).toContain('No tengo puerro para hacer «Crema de puerro y patata»');
    expect(m3AskAboutRecipe(r, 4)).toContain('(25 min, 4 raciones): ¿me la puedes adaptar? [NP receta:crema-puerro]');
    expect(m3AskAboutRecipe(r, 2, '¿puedo congelarla?')).toContain('¿puedo congelarla?');
  });
  it('M4 resume la semana en una línea por día y cabe en un mensaje', () => {
    const menu = planMenu({ preferences: prefs(), catalog: CATALOG, weekStart: '2026-09-07', seed: 't' });
    const text = m4ImproveMenu(menu, 'abc', prefs({ people: 1 }), recipeName(CATALOG), '7 de septiembre');
    expect(text.split('\n').filter((l) => /^(Lun|Mar|Mié|Jue|Vie|Sáb|Dom) · /.test(l))).toHaveLength(7);
    expect(text).toContain('Somos 1 persona.');
    expect(text.length).toBeLessThanOrEqual(MAX_MESSAGE_CHARS);
  });
  it('M5 y M6', () => {
    expect(m5NoMatch(['huevos', 'arroz'], 'cena', 20)).toBe('Tengo huevos, arroz y no sé qué hacer para cena. ¿Alguna idea en menos de 20 minutos?');
    expect(m6SafetyRedirect('renal')).toContain('una enfermedad renal');
  });
});

describe('finalizeMessage y enlaces', () => {
  it('nunca empieza por @ y recorta a 3500 caracteres', () => {
    expect(finalizeMessage('@Nutri_RF_Bot hola')).toMatch(/^Hola\. @/);
    const long = finalizeMessage('x'.repeat(5000));
    expect(long.length).toBe(MAX_MESSAGE_CHARS);
    expect(long.endsWith('…')).toBe(true);
  });
  it('askNutriUrl y shareUrl codifican el texto', () => {
    expect(askNutriUrl('Nutri_RF_Bot', 'Hola & adiós')).toBe('https://t.me/Nutri_RF_Bot?text=Hola%20%26%20adi%C3%B3s');
    expect(shareUrl('https://t.me/Nutri_RF_Bot?startapp=lista', 'lista')).toContain('share/url?url=https%3A%2F%2Ft.me%2FNutri_RF_Bot%3Fstartapp%3Dlista&text=lista');
  });
});

describe('renderListText (L1)', () => {
  const list = buildShoppingList({ slots: [slot(0, 'cena', 'tortilla-espinacas'), slot(1, 'comida', 'arroz-pollo')], catalog: CATALOG, people: 2 });
  it('agrupa por categorías en mayúsculas con casillas y pie', () => {
    const text = renderListText(list, { weekLabel: '7–13 sep', botUsername: 'Nutri_RF_Bot' });
    expect(text.startsWith('🛒 Lista de compra · 7–13 sep · 2 personas')).toBe(true);
    expect(text).toContain('VERDURAS Y FRUTA\n☐ Cebolla · 1 ud\n☐ Espinacas · bolsa de 300 g (200 g)\n☐ Tomate · 2 ud');
    expect(text).toContain('BÁSICOS\n☐ Aceite de oliva');
    expect(text.endsWith('Hecha con Nutri Plan (@Nutri_RF_Bot)')).toBe(true);
  });
  it('en modo compacto omite las cantidades exactas', () => {
    const text = renderListText(list, { weekLabel: 'x', botUsername: 'b', compact: true });
    expect(text).toContain('☐ Espinacas · bolsa de 300 g\n');
    expect(text).not.toContain('(200 g)');
  });
  it('nunca supera el máximo aunque la lista sea enorme', () => {
    const huge = { ...list, items: Array.from({ length: 400 }, (_, i) => ({ ...list.items[0]!, ingredient: `i${i}`, name: `Ingrediente número ${i}` })) };
    expect(renderListText(huge, { weekLabel: 'x', botUsername: 'b' }).length).toBeLessThanOrEqual(MAX_MESSAGE_CHARS);
  });
});
