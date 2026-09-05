// GENERADO por scripts/sync-core.ts desde packages/core/src — no editar aquí.
import type { MealType, Menu, Preferences, Recipe, ShoppingList } from './types.ts';
import { CATEGORY_LABELS, activeItems, groupByCategory, stapleItems } from './shopping.ts';
import { SAFETY_LABELS, type SafetyFlag } from './safety.ts';

/** Margen bajo los 4096 caracteres de un mensaje de Telegram. */
export const MAX_MESSAGE_CHARS = 3500;

export const DAY_NAMES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'] as const;
export const DAY_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] as const;
export const MEAL_LABELS: Record<MealType, string> = {
  desayuno: 'desayuno',
  comida: 'comida',
  cena: 'cena',
  tentempie: 'tentempié',
};
const MEAL_SHORT: Record<MealType, string> = { desayuno: 'D', comida: 'C', cena: 'Ce', tentempie: 'T' };

const STYLE_LABELS: Record<string, string> = {
  vegetariano: 'vegetariano',
  vegano: 'vegano',
  sin_gluten: 'sin gluten',
  sin_lactosa: 'sin lactosa',
  flexitariano: 'flexitariano',
};
const ALLERGEN_LABELS: Record<string, string> = {
  gluten: 'gluten',
  crustaceos: 'crustáceos',
  huevos: 'huevo',
  pescado: 'pescado',
  cacahuetes: 'cacahuetes',
  soja: 'soja',
  lacteos: 'lácteos',
  frutos_cascara: 'frutos de cáscara',
  apio: 'apio',
  mostaza: 'mostaza',
  sesamo: 'sésamo',
  sulfitos: 'sulfitos',
  altramuces: 'altramuces',
  moluscos: 'moluscos',
};

/** Garantiza longitud máxima y que el texto no empiece por "@" (consulta inline en Telegram). */
export function finalizeMessage(text: string): string {
  const safe = text.trimStart().startsWith('@') ? `Hola. ${text.trimStart()}` : text.trim();
  return safe.length > MAX_MESSAGE_CHARS ? `${safe.slice(0, MAX_MESSAGE_CHARS - 1)}…` : safe;
}

export function restrictionsSuffix(prefs: Preferences): string {
  const styles = prefs.styles.filter((s) => STYLE_LABELS[s]).map((s) => STYLE_LABELS[s]);
  const allergens = prefs.allergens.map((a) => ALLERGEN_LABELS[a] ?? a);
  const parts = [...styles, ...(allergens.length ? [`sin ${allergens.join(', ')}`] : [])];
  return parts.length ? `, ${parts.join(', ')}` : '';
}

const people = (n: number) => `${n} persona${n === 1 ? '' : 's'}`;

export interface SlotRef {
  menuId: string;
  slotId: string;
  dayIndex: number;
  meal: MealType;
  recipeName: string;
}

/** M1 · Pedir alternativa a Nutri para un plato. */
export function m1ChangeDish(ref: SlotRef, criterion: string, prefs: Preferences): string {
  return finalizeMessage(
    `Hola Nutri 👋 Quiero cambiar la ${MEAL_LABELS[ref.meal]} del ${DAY_NAMES[ref.dayIndex]} ` +
      `(${ref.recipeName}) por algo ${criterion}. Cocino para ${people(prefs.people)}${restrictionsSuffix(prefs)}. ` +
      `[NP menu:${ref.menuId} slot:${ref.slotId}]`,
  );
}

/** M2 · Me falta un ingrediente. */
export function m2MissingIngredient(recipe: Recipe, ingredientName: string): string {
  return finalizeMessage(
    `No tengo ${ingredientName} para hacer «${recipe.name}». ¿Qué puedo usar en su lugar? [NP receta:${recipe.slug}]`,
  );
}

/** M3 · Preguntar a Nutri sobre una receta. */
export function m3AskAboutRecipe(recipe: Recipe, servings: number, question?: string): string {
  const q = question?.trim() || '¿me la puedes adaptar?';
  return finalizeMessage(
    `Tengo una duda sobre la receta «${recipe.name}» (${recipe.time_min} min, ${servings} raciones): ${q} [NP receta:${recipe.slug}]`,
  );
}

/** M4 · Mejora este menú (resumen compacto de la semana). */
export function m4ImproveMenu(
  menu: Menu,
  menuId: string,
  prefs: Preferences,
  recipeName: (slug: string) => string,
  weekLabel: string,
): string {
  const lines = Array.from({ length: menu.days }, (_, day) => {
    const parts = menu.slots
      .filter((s) => s.day_index === day)
      .map((s) => `${MEAL_SHORT[s.meal]}: ${s.recipe_slug ? recipeName(s.recipe_slug) : 'fuera'}`);
    return `${DAY_SHORT[day]} · ${parts.join(' · ')}`;
  });
  return finalizeMessage(
    `Este es mi menú de la semana del ${weekLabel}. ¿Qué ajustarías?\n\n${lines.join('\n')}\n\n` +
      `Somos ${people(prefs.people)}${restrictionsSuffix(prefs)}. [NP menu:${menuId}]`,
  );
}

/** M5 · Cocinar con lo que tengo, sin resultado bueno. */
export function m5NoMatch(ingredientNames: readonly string[], meal: MealType, maxMinutes: number): string {
  return finalizeMessage(
    `Tengo ${ingredientNames.join(', ')} y no sé qué hacer para ${MEAL_LABELS[meal]}. ¿Alguna idea en menos de ${maxMinutes} minutos?`,
  );
}

/** M6 · Derivación tras detectar una situación de salud. */
export function m6SafetyRedirect(flag: SafetyFlag): string {
  return finalizeMessage(
    `He indicado en Nutri Plan que tengo ${SAFETY_LABELS[flag]}. ¿Qué debería tener en cuenta y con quién debería consultarlo?`,
  );
}

export interface ListTextOptions {
  weekLabel: string;
  botUsername: string;
  compact?: boolean;
}

/** L1 · Texto plano de la lista para compartir o copiar. */
export function renderListText(list: ShoppingList, options: ListTextOptions): string {
  const header = `🛒 Lista de compra · ${options.weekLabel} · ${people(list.people)}`;
  const line = (i: (typeof list.items)[number]) => {
    const exact = !options.compact && i.buy_qty !== i.needed_qty ? ` (${i.needed_qty} ${i.unit})` : '';
    return `☐ ${i.name} · ${i.buy_label}${exact}`;
  };
  const groups = groupByCategory(activeItems(list)).map(
    (g) => `${CATEGORY_LABELS[g.category].toUpperCase()}\n${g.items.map(line).join('\n')}`,
  );
  const staples = stapleItems(list);
  const staplesBlock = staples.length ? [`BÁSICOS\n${staples.map(line).join('\n')}`] : [];
  const footer = `Hecha con Nutri Plan (@${options.botUsername})`;
  const full = [header, ...groups, ...staplesBlock, footer].join('\n\n');
  if (full.length <= MAX_MESSAGE_CHARS) return full;
  if (!options.compact) return renderListText(list, { ...options, compact: true });
  return finalizeMessage([header, ...groups, footer].join('\n\n'));
}

export function askNutriUrl(botUsername: string, message: string): string {
  return `https://t.me/${botUsername}?text=${encodeURIComponent(finalizeMessage(message))}`;
}

export function shareUrl(appLink: string, text: string): string {
  return `https://t.me/share/url?url=${encodeURIComponent(appLink)}&text=${encodeURIComponent(finalizeMessage(text))}`;
}
