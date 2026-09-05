import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadCatalogFromDisk } from './load-data';

/** Genera apps/web/public/{recipes,ingredients}.json para la Fase 1 (sin backend). */
const { catalog, issues } = loadCatalogFromDisk();
if (issues.length) {
  console.error('El recetario tiene incidencias; ejecuta `npm run recipes:check`.');
  process.exit(1);
}
const outDir = join(import.meta.dirname, '..', 'apps', 'web', 'public');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'recipes.json'), JSON.stringify([...catalog.recipes.values()]));
writeFileSync(join(outDir, 'ingredients.json'), JSON.stringify([...catalog.ingredients.values()]));
console.log(`✓ ${catalog.recipes.size} recetas y ${catalog.ingredients.size} ingredientes → apps/web/public/`);
