// GENERADO por scripts/sync-core.ts desde packages/core/src — no editar aquí.
import type { Catalog, DietStyle, MealType, Preferences, Recipe } from './types.ts';

/** Estilos que actúan como filtro duro. `mediterraneo` y `flexitariano` no filtran. */
const FILTERING_STYLES: ReadonlySet<DietStyle> = new Set([
  'vegetariano',
  'vegano',
  'sin_gluten',
  'sin_lactosa',
]);

function satisfiesStyle(recipe: Recipe, style: DietStyle): boolean {
  if (style === 'vegetariano') {
    return recipe.styles.includes('vegetariano') || recipe.styles.includes('vegano');
  }
  return recipe.styles.includes(style);
}

export function hasAllergenConflict(recipe: Recipe, prefs: Preferences): boolean {
  return recipe.allergens.some((a) => prefs.allergens.includes(a));
}

export function violatesStyle(recipe: Recipe, prefs: Preferences): boolean {
  return prefs.styles
    .filter((s) => FILTERING_STYLES.has(s))
    .some((style) => !satisfiesStyle(recipe, style));
}

export function containsDisliked(recipe: Recipe, prefs: Preferences): boolean {
  const disliked = new Set(prefs.disliked_ingredients);
  return recipe.ingredients.some((line) => !line.optional && disliked.has(line.ingredient));
}

/** Restricciones duras (docs/08): alérgenos, estilo, ingredientes que no gustan. */
export function passesHardConstraints(recipe: Recipe, prefs: Preferences): boolean {
  return (
    !hasAllergenConflict(recipe, prefs) &&
    !violatesStyle(recipe, prefs) &&
    !containsDisliked(recipe, prefs)
  );
}

export function filterCatalog(catalog: Catalog, prefs: Preferences): Recipe[] {
  return [...catalog.recipes.values()].filter((r) => passesHardConstraints(r, prefs));
}

export function candidatesFor(recipes: readonly Recipe[], meal: MealType): Recipe[] {
  return recipes.filter((r) => r.meal_types.includes(meal));
}
