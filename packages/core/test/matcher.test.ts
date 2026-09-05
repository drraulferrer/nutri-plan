import { describe, expect, it } from 'vitest';
import { matchRecipes } from '../src/matcher';
import { filterCatalog } from '../src/restrictions';
import { ingredientName } from '../src/catalog';
import { CATALOG, RECIPES, prefs } from './fixtures';

const STAPLES = ['aceite-oliva', 'sal', 'ajo'];
const names = ingredientName(CATALOG);

describe('matchRecipes', () => {
  it('huevos, espinacas, arroz, tomate → tres recetas con etiquetas correctas', () => {
    const results = matchRecipes({ available: ['huevos', 'espinacas', 'arroz', 'tomate'], recipes: RECIPES, staples: STAPLES, limit: 4 }, names);
    expect(results).toHaveLength(4);
    // La que usa los 4 ingredientes gana; después la que usa 2 y no falta nada; luego la que falta 1; luego la que faltan 2.
    expect(results.map((r) => r.recipe.slug)).toEqual(['arroz-salteado-huevo', 'tortilla-espinacas', 'revuelto-tofu', 'ensalada-arroz-tomate']);
    expect(results[0]!.label).toBe('rapida');
    expect(results[0]!.label_text).toBe('Lista en 20 minutos');
    expect(results[1]!.label).toBe('rapida'); // cebolla es opcional ⇒ tienes todo, 15 min
    expect(results[2]!.label_text).toBe('Falta 1 ingrediente: Tofu');
    expect(results[3]!.label).toBe('faltan_n');
    expect(results[3]!.label_text).toBe('Faltan 2 ingredientes');
    // Huevos revueltos (un solo ingrediente real) no se sugiere aunque "tengas todo".
    expect(results.map((r) => r.recipe.slug)).not.toContain('huevos-revueltos');
  });

  it('no busca con menos de dos ingredientes', () => {
    expect(matchRecipes({ available: ['huevos'], recipes: RECIPES })).toEqual([]);
  });

  it('respeta las restricciones duras aplicadas antes del matcher', () => {
    const veg = filterCatalog(CATALOG, prefs({ styles: ['vegetariano'] }));
    const results = matchRecipes({ available: ['pollo', 'arroz', 'tomate'], recipes: veg, staples: STAPLES });
    expect(results.every((r) => r.recipe.protein_group !== 'pollo')).toBe(true);
  });

  it('cuenta una sustitución disponible como cubierta', () => {
    const results = matchRecipes({ available: ['cebolla', 'patata'], recipes: RECIPES, staples: STAPLES }, names);
    const crema = results.find((r) => r.recipe.slug === 'crema-puerro')!;
    expect(crema).toBeDefined();
    expect(crema.missing).toEqual([{ ingredient: 'puerro', substitutable_with: 'cebolla' }]);
    expect(crema.label_text).toBe('Tienes todo (usa Cebolla en vez de Puerro)');
  });

  it('etiqueta "Falta 1 ingrediente" con el nombre', () => {
    const results = matchRecipes({ available: ['pan', 'queso'], recipes: RECIPES, staples: STAPLES }, names);
    const tostada = results.find((r) => r.recipe.slug === 'tostada-queso')!;
    expect(tostada.label).toBe('falta_1');
    expect(tostada.label_text).toBe('Falta 1 ingrediente: Tomate');
  });

  it('aplica filtros de tiempo, comida y estilo', () => {
    const results = matchRecipes({
      available: ['tomate', 'cebolla', 'calabacin', 'patata'],
      recipes: RECIPES,
      staples: STAPLES,
      filters: { max_time: 20, meal: 'cena', style: 'vegano' },
      limit: 10,
    });
    expect(results.every((r) => r.recipe.time_min <= 20 && r.recipe.meal_types.includes('cena') && r.recipe.styles.includes('vegano'))).toBe(true);
  });

  it('descarta recetas con cobertura baja o más de 3 faltantes', () => {
    const results = matchRecipes({ available: ['pan', 'platano'], recipes: RECIPES, staples: STAPLES, limit: 20 });
    expect(results.every((r) => r.coverage >= 0.5 && r.missing.filter((m) => !m.substitutable_with).length <= 3)).toBe(true);
  });
});
