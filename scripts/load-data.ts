import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { buildCatalog } from '../packages/core/src/catalog';

export const DATA_DIR = join(import.meta.dirname, '..', 'data');

/** Lee data/ingredients.yaml y data/recipes/*.yaml y construye el catálogo validado. */
export function loadCatalogFromDisk() {
  const ingredients = parse(readFileSync(join(DATA_DIR, 'ingredients.yaml'), 'utf8')) as unknown[];
  const recipesDir = join(DATA_DIR, 'recipes');
  const recipes = readdirSync(recipesDir)
    .filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
    .sort()
    .map((file) => ({ file, data: parse(readFileSync(join(recipesDir, file), 'utf8')) as unknown }));
  return buildCatalog(ingredients, recipes);
}
