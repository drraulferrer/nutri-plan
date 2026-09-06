// GENERADO por scripts/sync-core.ts desde packages/core/src — no editar aquí.
import type {
  Catalog,
  MealType,
  Menu,
  MenuSlot,
  PlannerWarning,
  Preferences,
  ProteinGroup,
  Recipe,
} from './types.ts';
import { hashToUnit } from './hash.ts';
import { candidatesFor, filterCatalog } from './restrictions.ts';

export interface PlannerInput {
  preferences: Preferences;
  catalog: Catalog;
  weekStart: string;
  seed: string;
  favorites?: readonly string[];
  pantry?: readonly string[];
  lockedSlots?: readonly MenuSlot[];
  recentRecipes?: readonly string[];
}

const COOK_TIME_MINUTES: Record<Preferences['cook_time'], number> = { '15': 15, '30': 30, '45': 45, '60+': 240 };
const BUDGET_ALLOWS: Record<Preferences['budget'], ReadonlySet<Recipe['cost_level']>> = {
  ajustado: new Set(['bajo']),
  medio: new Set(['bajo', 'medio']),
  flexible: new Set(['bajo', 'medio', 'alto']),
};
const BATCH_REUSE_PROBABILITY = 0.6;
const MIN_CANDIDATES = 3;
/** Un yogur con fruta puede ser desayuno un día y tentempié otro (docs/01 RF-11). */
const LIGHT_MEALS: ReadonlySet<MealType> = new Set<MealType>(['desayuno', 'tentempie']);

interface Context {
  input: PlannerInput;
  candidates: readonly Recipe[];
  slots: MenuSlot[];
  warnings: PlannerWarning[];
  /** En qué comidas se ha usado ya cada receta. */
  usedIn: Map<string, Set<MealType>>;
  /** En qué días aparece ya cada receta, para no repetirla el mismo día. */
  usedDays: Map<string, Set<number>>;
  batchAllowed: Set<string>;
  proteinCount: Map<string, number>;
  chosenIngredients: Set<string>;
}

function mealsFor(prefs: Preferences): MealType[] {
  return prefs.include_snacks ? ['comida', 'cena', 'desayuno', 'tentempie'] : ['comida', 'cena', 'desayuno'];
}

function emptySlots(prefs: Preferences): MenuSlot[] {
  const slots: MenuSlot[] = [];
  for (const meal of mealsFor(prefs)) {
    for (let day = 0; day < prefs.days; day += 1) {
      slots.push({ day_index: day, meal, recipe_slug: null, servings: prefs.people, alternatives: [], is_locked: false });
    }
  }
  return slots;
}

const isWeekend = (day: number) => day >= 5;

function fitsTime(recipe: Recipe, day: number, meal: MealType, prefs: Preferences): boolean {
  if (meal === 'desayuno' || meal === 'tentempie') return true;
  const limit = COOK_TIME_MINUTES[prefs.cook_time] * (isWeekend(day) ? 1.5 : 1);
  const time = recipe.batch_reuse && recipe.active_time_min ? recipe.active_time_min : recipe.time_min;
  return time <= limit;
}

const fitsBudget = (recipe: Recipe, prefs: Preferences) => BUDGET_ALLOWS[prefs.budget].has(recipe.cost_level);

function perishableShare(recipe: Recipe, ctx: Context): number {
  const perishables = recipe.ingredients.filter((l) => {
    const ing = ctx.input.catalog.ingredients.get(l.ingredient);
    return ing?.is_perishable && !ing.is_staple;
  });
  if (perishables.length === 0) return 0;
  return perishables.filter((l) => ctx.chosenIngredients.has(l.ingredient)).length / perishables.length;
}

function pantryShare(recipe: Recipe, pantry: ReadonlySet<string>): number {
  if (pantry.size === 0 || recipe.ingredients.length === 0) return 0;
  return recipe.ingredients.filter((l) => pantry.has(l.ingredient)).length / recipe.ingredients.length;
}

function proteinToday(ctx: Context, day: number, meal: MealType): Set<ProteinGroup> {
  const groups = new Set<ProteinGroup>();
  for (const s of ctx.slots) {
    if (s.day_index !== day || s.meal === meal || !s.recipe_slug) continue;
    const r = ctx.input.catalog.recipes.get(s.recipe_slug);
    if (r && r.protein_group !== 'ninguno') groups.add(r.protein_group);
  }
  return groups;
}

function score(recipe: Recipe, day: number, meal: MealType, ctx: Context): number {
  const prefs = ctx.input.preferences;
  const favorites = new Set(ctx.input.favorites ?? []);
  const pantry = new Set(ctx.input.pantry ?? []);
  const recent = new Set(ctx.input.recentRecipes ?? []);
  const proteinKey = `${meal}:${recipe.protein_group}`;
  const timesUsed = ctx.proteinCount.get(proteinKey) ?? 0;
  return (
    (favorites.has(recipe.slug) ? 3 : 0) +
    (fitsTime(recipe, day, meal, prefs) ? 2 : 0) +
    (fitsBudget(recipe, prefs) ? 1 : 0) +
    1.5 * perishableShare(recipe, ctx) +
    pantryShare(recipe, pantry) -
    (recipe.protein_group !== 'ninguno' && proteinToday(ctx, day, meal).has(recipe.protein_group) ? 2 : 0) -
    (timesUsed >= 2 ? 1 : 0) -
    (recent.has(recipe.slug) ? 1.5 : 0) +
    hashToUnit(`${ctx.input.seed}:${recipe.slug}:${day}:${meal}`) * 0.5
  );
}

function available(ctx: Context, meal: MealType, day: number, exclude: ReadonlySet<string> = new Set()): Recipe[] {
  return candidatesFor(ctx.candidates, meal).filter((r) => {
    if (exclude.has(r.slug)) return false;
    if (ctx.usedDays.get(r.slug)?.has(day)) return false;
    const usedIn = ctx.usedIn.get(r.slug);
    if (!usedIn) return true;
    if (ctx.batchAllowed.has(r.slug)) return true;
    // Desayuno y tentempié comparten repertorio: se permite una aparición en cada uno.
    return LIGHT_MEALS.has(meal) && [...usedIn].every((m) => LIGHT_MEALS.has(m) && m !== meal);
  });
}

function rank(recipes: readonly Recipe[], day: number, meal: MealType, ctx: Context): Recipe[] {
  return [...recipes]
    .map((r) => ({ r, s: score(r, day, meal, ctx) }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.r);
}

function alternativesFor(ranked: readonly Recipe[], chosen: Recipe): string[] {
  return ranked
    .filter((r) => r.slug !== chosen.slug && r.protein_group !== chosen.protein_group)
    .slice(0, 2)
    .map((r) => r.slug);
}

export function softWarnings(recipe: Recipe, day: number, meal: MealType, prefs: Preferences): PlannerWarning[] {
  const warnings: PlannerWarning[] = [];
  if (!fitsTime(recipe, day, meal, prefs)) {
    warnings.push({ day_index: day, meal, type: 'time', detail: `${recipe.time_min} min > ${prefs.cook_time}` });
  }
  if (!fitsBudget(recipe, prefs)) {
    warnings.push({ day_index: day, meal, type: 'budget', detail: `coste ${recipe.cost_level}` });
  }
  return warnings;
}

function commit(ctx: Context, index: number, recipe: Recipe, alternatives: string[]): void {
  const slot = ctx.slots[index]!;
  ctx.slots[index] = { ...slot, recipe_slug: recipe.slug, alternatives };
  ctx.usedIn.set(recipe.slug, new Set([...(ctx.usedIn.get(recipe.slug) ?? []), slot.meal]));
  ctx.usedDays.set(recipe.slug, new Set([...(ctx.usedDays.get(recipe.slug) ?? []), slot.day_index]));
  ctx.batchAllowed.delete(recipe.slug);
  const key = `${slot.meal}:${recipe.protein_group}`;
  ctx.proteinCount.set(key, (ctx.proteinCount.get(key) ?? 0) + 1);
  recipe.ingredients.forEach((l) => ctx.chosenIngredients.add(l.ingredient));
  ctx.warnings.push(...softWarnings(recipe, slot.day_index, slot.meal, ctx.input.preferences));
}

/** Programa la segunda aparición de una receta de batch cooking como cena 1–2 días después. */
function scheduleBatchReuse(ctx: Context, fromIndex: number, recipe: Recipe): void {
  const from = ctx.slots[fromIndex]!;
  if (from.meal !== 'comida' || !recipe.batch_reuse) return;
  if (hashToUnit(`${ctx.input.seed}:batch:${recipe.slug}`) >= BATCH_REUSE_PROBABILITY) return;
  const reuse = recipe.meal_types.includes('cena') ? recipe : undefined;
  const pair = recipe.pairs_with
    .map((slug) => ctx.input.catalog.recipes.get(slug))
    .find((r) => r && ctx.candidates.includes(r) && r.meal_types.includes('cena') && !ctx.usedIn.has(r.slug));
  const target = pair ?? reuse;
  if (!target) return;
  for (const offset of [1, 2]) {
    const idx = ctx.slots.findIndex(
      (s) => s.meal === 'cena' && s.day_index === from.day_index + offset && !s.recipe_slug && !s.is_locked,
    );
    if (idx === -1) continue;
    if (target === recipe) ctx.batchAllowed.add(recipe.slug);
    commit(ctx, idx, target, []);
    return;
  }
}

function fillSlot(ctx: Context, index: number, exclude: ReadonlySet<string> = new Set()): void {
  const slot = ctx.slots[index]!;
  if (slot.recipe_slug || slot.is_locked) return;
  const pool = available(ctx, slot.meal, slot.day_index, exclude);
  if (pool.length === 0) {
    ctx.warnings.push({ day_index: slot.day_index, meal: slot.meal, type: 'no_candidates', detail: 'sin recetas compatibles' });
    return;
  }
  const ranked = rank(pool, slot.day_index, slot.meal, ctx);
  const chosen = ranked[0]!;
  commit(ctx, index, chosen, alternativesFor(ranked, chosen));
  scheduleBatchReuse(ctx, index, chosen);
}

function createContext(input: PlannerInput, slots: MenuSlot[]): Context {
  const candidates = filterCatalog(input.catalog, input.preferences);
  const ctx: Context = {
    input,
    candidates,
    slots,
    warnings: [],
    usedIn: new Map(),
    usedDays: new Map(),
    batchAllowed: new Set(),
    proteinCount: new Map(),
    chosenIngredients: new Set(),
  };
  for (const meal of mealsFor(input.preferences)) {
    if (candidatesFor(candidates, meal).length < MIN_CANDIDATES) {
      ctx.warnings.push({ day_index: -1, meal, type: 'no_candidates', detail: `menos de ${MIN_CANDIDATES} recetas de ${meal}` });
    }
  }
  slots
    .filter((s) => s.recipe_slug)
    .forEach((s) => {
      const r = input.catalog.recipes.get(s.recipe_slug!);
      if (!r) return;
      ctx.usedIn.set(r.slug, new Set([...(ctx.usedIn.get(r.slug) ?? []), s.meal]));
      ctx.usedDays.set(r.slug, new Set([...(ctx.usedDays.get(r.slug) ?? []), s.day_index]));
      ctx.proteinCount.set(`${s.meal}:${r.protein_group}`, (ctx.proteinCount.get(`${s.meal}:${r.protein_group}`) ?? 0) + 1);
      r.ingredients.forEach((l) => ctx.chosenIngredients.add(l.ingredient));
    });
  return ctx;
}

function fillAll(ctx: Context): void {
  for (const meal of mealsFor(ctx.input.preferences)) {
    ctx.slots.forEach((s, i) => {
      if (s.meal === meal) fillSlot(ctx, i);
    });
  }
}

function toMenu(ctx: Context): Menu {
  return {
    week_start: ctx.input.weekStart,
    days: ctx.input.preferences.days,
    people: ctx.input.preferences.people,
    seed: ctx.input.seed,
    slots: ctx.slots.map((s) => ({ ...s, alternatives: [...s.alternatives] })),
    warnings: [...ctx.warnings],
  };
}

/** Menú completo de la semana (docs/08). Determinista para la misma entrada y semilla. */
export function planMenu(input: PlannerInput): Menu {
  const locked = new Map((input.lockedSlots ?? []).map((s) => [`${s.day_index}-${s.meal}`, s]));
  const slots = emptySlots(input.preferences).map((s) => {
    const l = locked.get(`${s.day_index}-${s.meal}`);
    return l ? { ...l, is_locked: true, servings: input.preferences.people } : s;
  });
  const ctx = createContext(input, slots);
  fillAll(ctx);
  return toMenu(ctx);
}

export type RegenerateScope =
  | { scope: 'week' }
  | { scope: 'day'; day_index: number }
  | { scope: 'slot'; day_index: number; meal: MealType; exclude?: readonly string[] };

/** Regenera parte del menú conservando lo bloqueado y, según el alcance, el resto (docs/08 §7). */
export function regenerateMenu(menu: Menu, input: PlannerInput, scope: RegenerateScope): Menu {
  const keep = (s: MenuSlot): boolean => {
    if (s.is_locked) return true;
    if (scope.scope === 'week') return false;
    if (scope.scope === 'day') return s.day_index !== scope.day_index;
    return !(s.day_index === scope.day_index && s.meal === scope.meal);
  };
  const slots = menu.slots.map((s) => (keep(s) ? { ...s } : { ...s, recipe_slug: null, alternatives: [] }));
  const ctx = createContext(input, slots);
  if (scope.scope === 'slot') {
    const idx = slots.findIndex((s) => s.day_index === scope.day_index && s.meal === scope.meal);
    const current = menu.slots[idx]?.recipe_slug;
    const exclude = new Set([...(scope.exclude ?? []), ...(current ? [current] : [])]);
    if (idx >= 0) fillSlot(ctx, idx, exclude);
  } else {
    fillAll(ctx);
  }
  return toMenu(ctx);
}

/** Lunes de la semana a planificar (docs/00 D-06): desde el jueves se salta a la siguiente. */
export function defaultWeekStart(today: Date): string {
  const d = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  const weekday = (d.getUTCDay() + 6) % 7; // 0 = lunes
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - weekday + (weekday >= 3 ? 7 : 0));
  return monday.toISOString().slice(0, 10);
}

/** Avisos blandos (tiempo, presupuesto) para huecos ya decididos, p. ej. por la IA. */
export function slotWarnings(slots: readonly MenuSlot[], prefs: Preferences, catalog: Catalog): PlannerWarning[] {
  return slots.flatMap((s) => {
    const r = s.recipe_slug ? catalog.recipes.get(s.recipe_slug) : undefined;
    return r ? softWarnings(r, s.day_index, s.meal, prefs) : [];
  });
}
