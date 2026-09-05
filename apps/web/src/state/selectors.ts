import {
  DAY_NAMES,
  activeItems,
  type Catalog,
  type Menu,
  type MenuSlot,
  type Preferences,
  type Recipe,
  type ShoppingList,
} from '@nutri-plan/core';

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function addDays(iso: string, days: number): Date {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d;
}

/** "8–14 sep" o "28 sep–4 oct". */
export function formatWeekLabel(weekStart: string, days: number): string {
  const a = addDays(weekStart, 0);
  const b = addDays(weekStart, days - 1);
  const ma = MONTHS[a.getMonth()] ?? '';
  const mb = MONTHS[b.getMonth()] ?? '';
  return ma === mb ? `${a.getDate()}–${b.getDate()} ${ma}` : `${a.getDate()} ${ma}–${b.getDate()} ${mb}`;
}

export function formatDayHeading(weekStart: string, dayIndex: number): string {
  const d = addDays(weekStart, dayIndex);
  const name = DAY_NAMES[dayIndex] ?? '';
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${d.getDate()}`;
}

/** Índice del día de hoy dentro del menú, o null si hoy no cae en la semana. */
export function todayIndex(menu: Menu, today = new Date()): number | null {
  const start = addDays(menu.week_start, 0);
  const diff = Math.floor((startOfDay(today).getTime() - start.getTime()) / 86_400_000);
  return diff >= 0 && diff < menu.days ? diff : null;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

const MEAL_ORDER: Record<string, number> = { desayuno: 0, comida: 1, tentempie: 2, cena: 3 };

/** Huecos de un día en orden de lectura: desayuno, comida, tentempié, cena. */
export function slotsOfDay(menu: Menu, day: number): MenuSlot[] {
  return menu.slots
    .filter((s) => s.day_index === day)
    .sort((a, b) => (MEAL_ORDER[a.meal] ?? 9) - (MEAL_ORDER[b.meal] ?? 9));
}

export function recipeOf(catalog: Catalog, slot: MenuSlot): Recipe | undefined {
  return slot.recipe_slug ? catalog.recipes.get(slot.recipe_slug) : undefined;
}

const STYLE_LABEL: Record<string, string> = {
  vegetariano: 'vegetariano',
  vegano: 'vegano',
  flexitariano: 'flexitariano',
  sin_gluten: 'sin gluten',
  sin_lactosa: 'sin lactosa',
};

export function prefsSummary(prefs: Preferences): string {
  const parts = [`${prefs.people} persona${prefs.people === 1 ? '' : 's'}`];
  prefs.styles.filter((s) => STYLE_LABEL[s]).forEach((s) => parts.push(STYLE_LABEL[s]!));
  if (prefs.allergens.length) parts.push(`${prefs.allergens.length} alergia${prefs.allergens.length === 1 ? '' : 's'}`);
  return parts.join(' · ');
}

export function listProgress(list: ShoppingList): { done: number; total: number } {
  const items = activeItems(list);
  return { done: items.filter((i) => i.checked).length, total: items.length };
}

export function todaySummary(menu: Menu, catalog: Catalog, today = new Date()): string | null {
  const idx = todayIndex(menu, today);
  if (idx === null) return null;
  const names = slotsOfDay(menu, idx)
    .filter((s) => s.meal === 'comida' || s.meal === 'cena')
    .map((s) => recipeOf(catalog, s)?.name.toLowerCase() ?? 'comer fuera');
  return names.length ? `Hoy: ${names.join(' · ')}` : null;
}

/** Ingredientes más frecuentes en el recetario, para sugerir en "Cocinar con lo que tengo". */
export function frequentIngredients(catalog: Catalog, exclude: ReadonlySet<string>, limit = 6): string[] {
  const counts = new Map<string, number>();
  for (const r of catalog.recipes.values()) {
    for (const line of r.ingredients) {
      const ing = catalog.ingredients.get(line.ingredient);
      if (!ing || ing.is_staple || exclude.has(ing.slug)) continue;
      counts.set(ing.slug, (counts.get(ing.slug) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([slug]) => slug);
}

export function newSeed(): string {
  return Math.random().toString(36).slice(2, 10);
}
