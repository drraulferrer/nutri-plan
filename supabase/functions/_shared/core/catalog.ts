// GENERADO por scripts/sync-core.ts desde packages/core/src — no editar aquí.
import type { Catalog, Ingredient, Recipe } from './types.ts';
import { IngredientSchema, RecipeSchema } from './schemas.ts';

export interface CatalogIssue {
  file: string;
  message: string;
}

/**
 * Construye el catálogo desde datos ya parseados (YAML o JSON) y valida la coherencia:
 * ingredientes existentes, alérgenos derivados, sustituciones válidas, pairs_with existentes.
 */
export function buildCatalog(
  rawIngredients: readonly unknown[],
  rawRecipes: readonly { file: string; data: unknown }[],
): { catalog: Catalog; issues: CatalogIssue[] } {
  const issues: CatalogIssue[] = [];
  const ingredients = new Map<string, Ingredient>();
  for (const raw of rawIngredients) {
    const parsed = IngredientSchema.safeParse(raw);
    if (!parsed.success) {
      issues.push({ file: 'ingredients.yaml', message: parsed.error.issues.map((i) => i.message).join('; ') });
      continue;
    }
    if (ingredients.has(parsed.data.slug)) issues.push({ file: 'ingredients.yaml', message: `slug duplicado ${parsed.data.slug}` });
    ingredients.set(parsed.data.slug, parsed.data);
  }

  const recipes = new Map<string, Recipe>();
  for (const { file, data } of rawRecipes) {
    const parsed = RecipeSchema.safeParse(data);
    if (!parsed.success) {
      issues.push({ file, message: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') });
      continue;
    }
    const recipe = parsed.data;
    if (recipes.has(recipe.slug)) issues.push({ file, message: `slug duplicado ${recipe.slug}` });
    issues.push(...validateRecipe(recipe, ingredients).map((message) => ({ file, message })));
    recipes.set(recipe.slug, recipe);
  }
  for (const [slug, r] of recipes) {
    r.pairs_with.filter((p) => !recipes.has(p)).forEach((p) => issues.push({ file: slug, message: `pairs_with desconocido: ${p}` }));
  }
  return { catalog: { ingredients, recipes }, issues };
}

export function validateRecipe(recipe: Recipe, ingredients: ReadonlyMap<string, Ingredient>): string[] {
  const messages: string[] = [];
  for (const line of recipe.ingredients) {
    if (!ingredients.has(line.ingredient)) messages.push(`ingrediente desconocido: ${line.ingredient}`);
  }
  for (const sub of recipe.substitutions) {
    if (!recipe.ingredients.some((l) => l.ingredient === sub.ingredient)) {
      messages.push(`sustitución de un ingrediente que la receta no usa: ${sub.ingredient}`);
    }
    if (!ingredients.has(sub.with)) messages.push(`sustituto desconocido: ${sub.with}`);
  }
  const derived = derivedAllergens(recipe, ingredients);
  const missing = derived.filter((a) => !recipe.allergens.includes(a));
  if (missing.length) messages.push(`alérgenos derivados no declarados: ${missing.join(', ')}`);
  return messages;
}

/** Alérgenos de los ingredientes no opcionales (docs/05 "derivación automática"). */
export function derivedAllergens(recipe: Recipe, ingredients: ReadonlyMap<string, Ingredient>) {
  const set = new Set<Recipe['allergens'][number]>();
  for (const line of recipe.ingredients) {
    if (line.optional) continue;
    ingredients.get(line.ingredient)?.allergens.forEach((a) => set.add(a));
  }
  return [...set];
}

export function ingredientName(catalog: Catalog): (slug: string) => string {
  return (slug) => catalog.ingredients.get(slug)?.name ?? slug;
}

export function recipeName(catalog: Catalog): (slug: string) => string {
  return (slug) => catalog.recipes.get(slug)?.name ?? slug;
}

/** Resuelve texto libre a un slug del catálogo por nombre o alias (insensible a acentos). */
export function resolveIngredient(catalog: Catalog, text: string): Ingredient | undefined {
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const q = norm(text);
  if (!q) return undefined;
  for (const ing of catalog.ingredients.values()) {
    if (norm(ing.name) === q || ing.slug === q || ing.aliases.some((a) => norm(a) === q)) return ing;
  }
  return undefined;
}

export function searchIngredients(catalog: Catalog, query: string, limit = 20): Ingredient[] {
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const q = norm(query.trim());
  if (q.length < 2) return [];
  return [...catalog.ingredients.values()]
    .filter((i) => norm(i.name).includes(q) || i.aliases.some((a) => norm(a).includes(q)))
    .sort((a, b) => Number(!norm(a.name).startsWith(q)) - Number(!norm(b.name).startsWith(q)) || a.name.localeCompare(b.name, 'es'))
    .slice(0, limit);
}
