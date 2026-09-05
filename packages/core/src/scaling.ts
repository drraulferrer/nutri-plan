import type { Catalog, Recipe, RecipeIngredient } from './types';
import { roundForDisplay } from './units';

export interface ScaledIngredient extends RecipeIngredient {
  name: string;
  scaled_quantity: number;
}

export function scaleFactor(servings: number, servingsBase: number): number {
  if (servings <= 0 || servingsBase <= 0) throw new RangeError('raciones deben ser > 0');
  return servings / servingsBase;
}

/** Ingredientes de una receta escalados y redondeados para mostrar (no para sumar). */
export function scaleRecipe(recipe: Recipe, servings: number, catalog: Catalog): ScaledIngredient[] {
  const factor = scaleFactor(servings, recipe.servings_base);
  return recipe.ingredients.map((line) => {
    const ingredient = catalog.ingredients.get(line.ingredient);
    return {
      ...line,
      name: ingredient?.name ?? line.ingredient,
      scaled_quantity: roundForDisplay(line.quantity * factor, line.unit, ingredient),
    };
  });
}
