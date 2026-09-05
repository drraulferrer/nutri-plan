import { describe, expect, it } from 'vitest';
import { buildCatalog, derivedAllergens, resolveIngredient, searchIngredients } from '../src/catalog';
import { filterCatalog, passesHardConstraints } from '../src/restrictions';
import { CATALOG, INGREDIENTS, RECIPES, prefs } from './fixtures';

describe('buildCatalog', () => {
  it('acepta las fixtures sin incidencias', () => {
    const { catalog, issues } = buildCatalog(INGREDIENTS, RECIPES.map((r) => ({ file: r.slug, data: r })));
    expect(issues).toEqual([]);
    expect(catalog.recipes.size).toBe(RECIPES.length);
  });
  it('detecta ingrediente desconocido, alérgeno no declarado y pairs_with roto', () => {
    const bad = {
      ...RECIPES.find((r) => r.slug === 'tortilla-espinacas')!,
      slug: 'mala',
      allergens: [],
      pairs_with: ['no-existe'],
      ingredients: [{ ingredient: 'unicornio', quantity: 1, unit: 'ud', optional: false }, { ingredient: 'huevos', quantity: 2, unit: 'ud', optional: false }],
      substitutions: [{ ingredient: 'leche', with: 'nada' }],
    };
    const { issues } = buildCatalog(INGREDIENTS, [{ file: 'mala.yaml', data: bad }]);
    const messages = issues.map((i) => i.message).join(' | ');
    expect(messages).toContain('ingrediente desconocido: unicornio');
    expect(messages).toContain('alérgenos derivados no declarados: huevos');
    expect(messages).toContain('pairs_with desconocido: no-existe');
    expect(messages).toContain('sustitución de un ingrediente que la receta no usa: leche');
    expect(messages).toContain('sustituto desconocido: nada');
  });
  it('rechaza YAML que no cumple el esquema', () => {
    const { issues } = buildCatalog([{ slug: 'Mal Slug', name: '', category: 'nope' }], [{ file: 'r.yaml', data: { slug: 'x' } }]);
    expect(issues.length).toBe(2);
  });
  it('deriva alérgenos solo de ingredientes no opcionales', () => {
    const r = { ...RECIPES[0]!, ingredients: [{ ingredient: 'huevos', quantity: 1, unit: 'ud' as const, optional: true }, { ingredient: 'pasta', quantity: 1, unit: 'g' as const, optional: false }] };
    expect(derivedAllergens(r, CATALOG.ingredients)).toEqual(['gluten']);
  });
});

describe('resolver y buscar ingredientes', () => {
  it('resuelve por nombre, alias y sin acentos', () => {
    expect(resolveIngredient(CATALOG, 'Calabacín')?.slug).toBe('calabacin');
    expect(resolveIngredient(CATALOG, 'zucchini')?.slug).toBe('calabacin');
    expect(resolveIngredient(CATALOG, 'tomates')?.slug).toBe('tomate');
    expect(resolveIngredient(CATALOG, 'kiwi')).toBeUndefined();
    expect(resolveIngredient(CATALOG, '  ')).toBeUndefined();
  });
  it('autocompleta desde dos letras, priorizando prefijos', () => {
    expect(searchIngredients(CATALOG, 'p').length).toBe(0);
    const pa = searchIngredients(CATALOG, 'pa').map((i) => i.slug);
    expect(pa.slice(0, 3)).toEqual(['pan', 'pasta', 'patata']); // prefijos primero
    expect(pa.slice(3).sort()).toEqual(['lentejas', 'ternera']); // "Lentejas pardinas", "Ternera para guisar"
    expect(searchIngredients(CATALOG, 'ate').map((i) => i.slug)).toContain('tomate');
  });
});

describe('restricciones duras', () => {
  it('vegetariano admite recetas veganas; sin gluten excluye pasta', () => {
    const veg = filterCatalog(CATALOG, prefs({ styles: ['vegetariano'] }));
    expect(veg.some((r) => r.slug === 'pisto')).toBe(true);
    expect(veg.some((r) => r.protein_group === 'pollo')).toBe(false);
    const gf = filterCatalog(CATALOG, prefs({ styles: ['sin_gluten'] }));
    expect(gf.some((r) => r.slug === 'pasta-atun')).toBe(false);
  });
  it('ingrediente que no gusta excluye solo si no es opcional', () => {
    const tortilla = CATALOG.recipes.get('tortilla-espinacas')!;
    expect(passesHardConstraints(tortilla, prefs({ disliked_ingredients: ['cebolla'] }))).toBe(true);
    expect(passesHardConstraints(tortilla, prefs({ disliked_ingredients: ['espinacas'] }))).toBe(false);
  });
});
