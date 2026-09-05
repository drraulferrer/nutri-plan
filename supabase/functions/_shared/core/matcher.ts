// GENERADO por scripts/sync-core.ts desde packages/core/src — no editar aquí.
import type { DietStyle, MealType, Recipe } from './types.ts';

export interface MatchFilters {
  max_time?: number;
  style?: DietStyle;
  meal?: MealType;
}

export interface MatchInput {
  available: readonly string[];
  recipes: readonly Recipe[];
  staples?: readonly string[];
  favorites?: readonly string[];
  filters?: MatchFilters;
  limit?: number;
}

export interface MissingIngredient {
  ingredient: string;
  substitutable_with?: string;
}

export type MatchLabel = 'tienes_todo' | 'rapida' | 'falta_1' | 'faltan_n';

export interface MatchResult {
  recipe: Recipe;
  coverage: number;
  missing: MissingIngredient[];
  score: number;
  label: MatchLabel;
  label_text: string;
}

export const MIN_INGREDIENTS = 2;
export const MAX_INGREDIENTS = 40;
const MIN_COVERAGE = 0.5;
const MAX_MISSING = 3;
const MIN_RECIPE_INGREDIENTS = 2;

function passesFilters(recipe: Recipe, filters: MatchFilters | undefined): boolean {
  if (!filters) return true;
  if (filters.max_time !== undefined && recipe.time_min > filters.max_time) return false;
  if (filters.meal && !recipe.meal_types.includes(filters.meal)) return false;
  if (filters.style) {
    const ok =
      filters.style === 'vegetariano'
        ? recipe.styles.includes('vegetariano') || recipe.styles.includes('vegano')
        : recipe.styles.includes(filters.style);
    if (!ok) return false;
  }
  return true;
}

function missingWithSubstitutes(recipe: Recipe, missing: string[], available: ReadonlySet<string>) {
  return missing.map<MissingIngredient>((slug) => {
    const sub = recipe.substitutions.find((s) => s.ingredient === slug && available.has(s.with));
    return sub ? { ingredient: slug, substitutable_with: sub.with } : { ingredient: slug };
  });
}

export function labelFor(recipe: Recipe, missing: MissingIngredient[], names: (slug: string) => string) {
  const unresolved = missing.filter((m) => !m.substitutable_with);
  if (unresolved.length === 0) {
    const subs = missing.filter((m) => m.substitutable_with);
    const suffix = subs.length
      ? ` (usa ${subs.map((s) => `${names(s.substitutable_with!)} en vez de ${names(s.ingredient)}`).join(', ')})`
      : '';
    if (recipe.time_min <= 20) {
      return { label: 'rapida' as const, label_text: `Lista en ${recipe.time_min} minutos${suffix}` };
    }
    return { label: 'tienes_todo' as const, label_text: `Tienes todo${suffix}` };
  }
  if (unresolved.length === 1) {
    return { label: 'falta_1' as const, label_text: `Falta 1 ingrediente: ${names(unresolved[0]!.ingredient)}` };
  }
  return { label: 'faltan_n' as const, label_text: `Faltan ${unresolved.length} ingredientes` };
}

function scoreRecipe(
  recipe: Recipe,
  available: ReadonlySet<string>,
  staples: ReadonlySet<string>,
  favorites: ReadonlySet<string>,
): Omit<MatchResult, 'label' | 'label_text'> | null {
  const required = recipe.ingredients
    .filter((l) => !l.optional && !staples.has(l.ingredient))
    .map((l) => l.ingredient);
  // Una receta con un solo ingrediente real (huevos revueltos) no es una sugerencia útil.
  if (required.length < MIN_RECIPE_INGREDIENTS) return null;
  const have = required.filter((s) => available.has(s));
  const missing = missingWithSubstitutes(recipe, required.filter((s) => !available.has(s)), available);
  const bySubstitution = missing.filter((m) => m.substitutable_with).length;
  const unresolved = missing.length - bySubstitution;
  const coverage = (have.length + 0.8 * bySubstitution) / required.length;
  if (coverage < MIN_COVERAGE || unresolved > MAX_MISSING) return null;
  const score =
    100 * coverage +
    6 * have.length -
    4 * unresolved +
    (recipe.time_min <= 20 ? 5 : 0) +
    (favorites.has(recipe.slug) ? 3 : 0);
  return { recipe, coverage, missing, score };
}

/** Recetas ordenadas por lo bien que aprovechan los ingredientes disponibles (docs/09 §D). */
export function matchRecipes(input: MatchInput, names: (slug: string) => string = (s) => s): MatchResult[] {
  if (input.available.length < MIN_INGREDIENTS) return [];
  const available = new Set(input.available.slice(0, MAX_INGREDIENTS));
  const staples = new Set(input.staples ?? []);
  const favorites = new Set(input.favorites ?? []);
  return input.recipes
    .filter((r) => passesFilters(r, input.filters))
    .map((r) => scoreRecipe(r, available, staples, favorites))
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => b.score - a.score || a.recipe.time_min - b.recipe.time_min)
    .slice(0, input.limit ?? 3)
    .map((r) => ({ ...r, ...labelFor(r.recipe, r.missing, names) }));
}
