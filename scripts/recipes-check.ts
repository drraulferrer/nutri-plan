import { loadCatalogFromDisk } from './load-data';
import { MEAL_TYPES } from '../packages/core/src/schemas';

/** Valida el recetario y muestra la matriz de cobertura (docs/07 "Proceso de redacción"). */
const { catalog, issues } = loadCatalogFromDisk();

if (issues.length) {
  console.error(`✗ ${issues.length} incidencia(s) en data/:`);
  for (const i of issues) console.error(`  - ${i.file}: ${i.message}`);
  process.exit(1);
}

const recipes = [...catalog.recipes.values()];
console.log(`✓ ${catalog.ingredients.size} ingredientes, ${recipes.length} recetas válidas\n`);

const rows = MEAL_TYPES.map((meal) => {
  const of = recipes.filter((r) => r.meal_types.includes(meal));
  return {
    comida: meal,
    total: of.length,
    '≤20 min': of.filter((r) => r.time_min <= 20).length,
    vegetariano: of.filter((r) => r.styles.includes('vegetariano') || r.styles.includes('vegano')).length,
    vegano: of.filter((r) => r.styles.includes('vegano')).length,
    sin_gluten: of.filter((r) => r.styles.includes('sin_gluten')).length,
    sin_lactosa: of.filter((r) => r.styles.includes('sin_lactosa')).length,
    'coste bajo': of.filter((r) => r.cost_level === 'bajo').length,
  };
});
console.table(rows);

const TARGET = 55;
if (recipes.length < TARGET) {
  console.log(`\nRecetario en construcción: ${recipes.length}/${TARGET}. Objetivo por bloques en docs/07.`);
}
