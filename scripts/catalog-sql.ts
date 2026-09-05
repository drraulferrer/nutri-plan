import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadCatalogFromDisk } from './load-data';

/**
 * Genera supabase/seed/catalog.sql con upserts idempotentes del recetario (docs/07 §Proceso).
 * Se aplica con `supabase db query -f` o con el MCP de Supabase (execute_sql).
 */
const { catalog, issues } = loadCatalogFromDisk();
if (issues.length) {
  console.error('El recetario tiene incidencias; ejecuta `npm run recipes:check`.');
  process.exit(1);
}

const lit = (v: unknown): string => {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (Array.isArray(v)) return `array[${v.map((x) => lit(x)).join(',')}]::text[]`;
  return `'${String(v).replace(/'/g, "''")}'`;
};
const json = (v: unknown) => `${lit(JSON.stringify(v))}::jsonb`;
const enumArray = (values: readonly string[], type: string) => `array[${values.map(lit).join(',')}]::${type}[]`;

const lines: string[] = ['begin;'];
for (const i of catalog.ingredients.values()) {
  lines.push(
    `insert into ingredients (slug, name, aliases, category, default_unit, grams_per_unit, package_size, package_label, is_staple, is_perishable, indivisible, allergens, data, updated_at) values (` +
      [
        lit(i.slug), lit(i.name), lit(i.aliases), `${lit(i.category)}::shop_category`, `${lit(i.default_unit)}::unit_code`,
        lit(i.grams_per_unit ?? null), lit(i.package_size ?? null), lit(i.package_label ?? null),
        lit(i.is_staple), lit(i.is_perishable), lit(i.indivisible), enumArray(i.allergens, 'allergen'), json(i), 'now()',
      ].join(', ') +
      `) on conflict (slug) do update set name = excluded.name, aliases = excluded.aliases, category = excluded.category, default_unit = excluded.default_unit, grams_per_unit = excluded.grams_per_unit, package_size = excluded.package_size, package_label = excluded.package_label, is_staple = excluded.is_staple, is_perishable = excluded.is_perishable, indivisible = excluded.indivisible, allergens = excluded.allergens, data = excluded.data, updated_at = now();`,
  );
}
for (const r of catalog.recipes.values()) {
  lines.push(
    `insert into recipes (slug, name, servings_base, time_min, active_time_min, meal_types, tags, styles, allergens, cost_level, protein_group, batch_reuse, data, updated_at) values (` +
      [
        lit(r.slug), lit(r.name), lit(r.servings_base), lit(r.time_min), lit(r.active_time_min ?? null),
        enumArray(r.meal_types, 'meal_type'), lit(r.tags), enumArray(r.styles, 'diet_style'), enumArray(r.allergens, 'allergen'),
        `${lit(r.cost_level)}::cost_level`, lit(r.protein_group), lit(r.batch_reuse), json(r), 'now()',
      ].join(', ') +
      `) on conflict (slug) do update set name = excluded.name, servings_base = excluded.servings_base, time_min = excluded.time_min, active_time_min = excluded.active_time_min, meal_types = excluded.meal_types, tags = excluded.tags, styles = excluded.styles, allergens = excluded.allergens, cost_level = excluded.cost_level, protein_group = excluded.protein_group, batch_reuse = excluded.batch_reuse, data = excluded.data, version = recipes.version + 1, updated_at = now();`,
  );
  lines.push(`delete from recipe_ingredients where recipe_slug = ${lit(r.slug)};`);
  r.ingredients.forEach((line, position) => {
    lines.push(
      `insert into recipe_ingredients (recipe_slug, ingredient_slug, quantity, unit, is_optional, position) values (${lit(r.slug)}, ${lit(line.ingredient)}, ${lit(line.quantity)}, ${lit(line.unit)}::unit_code, ${lit(line.optional)}, ${position});`,
    );
  });
}
lines.push('commit;');

const out = join(import.meta.dirname, '..', 'supabase', 'seed', 'catalog.sql');
writeFileSync(out, lines.join('\n') + '\n');
console.log(`✓ ${catalog.ingredients.size} ingredientes y ${catalog.recipes.size} recetas → supabase/seed/catalog.sql (${lines.length} sentencias)`);
