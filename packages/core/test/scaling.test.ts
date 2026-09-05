import { describe, expect, it } from 'vitest';
import { scaleFactor, scaleRecipe } from '../src/scaling';
import { CATALOG } from './fixtures';

describe('scaleRecipe', () => {
  it('escala la tortilla de espinacas de 2 a 3 personas', () => {
    const scaled = scaleRecipe(CATALOG.recipes.get('tortilla-espinacas')!, 3, CATALOG);
    const by = Object.fromEntries(scaled.map((s) => [s.ingredient, s.scaled_quantity]));
    expect(by['huevos']).toBe(6);
    expect(by['espinacas']).toBe(300);
    expect(by['cebolla']).toBe(1); // 0,75 → 1 (no indivisible: redondeo al medio)
    expect(scaled[0]?.name).toBe('Huevos');
  });
  it('no muta la receta original', () => {
    const recipe = CATALOG.recipes.get('tortilla-espinacas')!;
    const before = JSON.stringify(recipe);
    scaleRecipe(recipe, 8, CATALOG);
    expect(JSON.stringify(recipe)).toBe(before);
  });
  it('rechaza raciones no positivas', () => {
    expect(() => scaleFactor(0, 2)).toThrow(RangeError);
  });
});
