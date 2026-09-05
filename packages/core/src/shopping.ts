import type {
  CanonicalUnit,
  Catalog,
  Ingredient,
  MenuSlot,
  ShopCategory,
  ShoppingItem,
  ShoppingList,
} from './types';
import { ceilToStep, formatQuantity, toCanonical } from './units';

export const CATEGORY_ORDER: readonly ShopCategory[] = [
  'verduras_fruta',
  'proteinas',
  'lacteos',
  'despensa',
  'congelados',
  'otros',
];

export const CATEGORY_LABELS: Record<ShopCategory, string> = {
  verduras_fruta: 'Verduras y fruta',
  proteinas: 'Proteínas',
  lacteos: 'Lácteos y alternativas',
  despensa: 'Despensa',
  congelados: 'Congelados',
  otros: 'Otros',
};

export interface BuildListInput {
  slots: readonly MenuSlot[];
  catalog: Catalog;
  people: number;
  pantry?: readonly string[];
  previous?: ShoppingList;
}

interface Accumulated {
  ingredient: Ingredient;
  quantity: number;
  unit: CanonicalUnit;
  sources: string[];
}

export const slotKey = (slot: MenuSlot): string => `${slot.day_index}-${slot.meal}`;

function accumulate(input: BuildListInput): Map<string, Accumulated> {
  const acc = new Map<string, Accumulated>();
  for (const slot of input.slots) {
    if (!slot.recipe_slug) continue;
    const recipe = input.catalog.recipes.get(slot.recipe_slug);
    if (!recipe) continue;
    const factor = slot.servings / recipe.servings_base;
    for (const line of recipe.ingredients) {
      if (line.optional) continue;
      const ingredient = input.catalog.ingredients.get(line.ingredient);
      if (!ingredient) continue;
      const canonical = toCanonical(line.quantity * factor, line.unit, ingredient);
      const prev = acc.get(ingredient.slug);
      acc.set(ingredient.slug, {
        ingredient,
        unit: canonical.unit,
        quantity: (prev?.quantity ?? 0) + canonical.quantity,
        sources: [...(prev?.sources ?? []), slotKey(slot)],
      });
    }
  }
  return acc;
}

export function buyQuantity(needed: number, ingredient: Ingredient, unit: CanonicalUnit) {
  if (ingredient.package_size && ingredient.package_size > 0) {
    const packs = Math.max(1, Math.ceil(needed / ingredient.package_size));
    const label = ingredient.package_label ?? formatQuantity(ingredient.package_size, unit);
    return { buy_qty: packs * ingredient.package_size, buy_label: packs === 1 ? label : `${packs} × ${label}` };
  }
  const qty = ceilToStep(needed, unit);
  return { buy_qty: qty, buy_label: formatQuantity(qty, unit) };
}

function toItem(a: Accumulated, pantry: ReadonlySet<string>, previous?: ShoppingItem): ShoppingItem {
  const needed = Math.round(a.quantity * 100) / 100;
  return {
    ingredient: a.ingredient.slug,
    name: a.ingredient.name,
    category: a.ingredient.category,
    needed_qty: needed,
    unit: a.unit,
    ...buyQuantity(needed, a.ingredient, a.unit),
    source_slots: [...new Set(a.sources)],
    is_staple: a.ingredient.is_staple,
    checked: previous?.checked ?? false,
    have_it: previous?.have_it ?? pantry.has(a.ingredient.slug),
  };
}

function compareItems(x: ShoppingItem, y: ShoppingItem): number {
  const byCategory = CATEGORY_ORDER.indexOf(x.category) - CATEGORY_ORDER.indexOf(y.category);
  return byCategory !== 0 ? byCategory : x.name.localeCompare(y.name, 'es');
}

/** Lista de compra a partir de los huecos del menú (docs/09 §B). Función pura. */
export function buildShoppingList(input: BuildListInput): ShoppingList {
  const pantry = new Set(input.pantry ?? []);
  const previousByIngredient = new Map((input.previous?.items ?? []).map((i) => [i.ingredient, i]));
  const items = [...accumulate(input).values()]
    .map((a) => toItem(a, pantry, previousByIngredient.get(a.ingredient.slug)))
    .sort(compareItems);
  return { people: input.people, items };
}

export interface ListDelta {
  added: string[];
  removed: string[];
  changed: string[];
}

export function diffShoppingLists(previous: ShoppingList, next: ShoppingList): ListDelta {
  const prev = new Map(previous.items.map((i) => [i.ingredient, i]));
  const nxt = new Map(next.items.map((i) => [i.ingredient, i]));
  return {
    added: [...nxt.keys()].filter((k) => !prev.has(k)),
    removed: [...prev.keys()].filter((k) => !nxt.has(k)),
    changed: [...nxt.keys()].filter((k) => prev.has(k) && prev.get(k)!.buy_qty !== nxt.get(k)!.buy_qty),
  };
}

export function setItemState(
  list: ShoppingList,
  ingredient: string,
  patch: Partial<Pick<ShoppingItem, 'checked' | 'have_it'>>,
): ShoppingList {
  return {
    ...list,
    items: list.items.map((i) => (i.ingredient === ingredient ? { ...i, ...patch } : i)),
  };
}

export const activeItems = (list: ShoppingList) => list.items.filter((i) => !i.is_staple && !i.have_it);
export const stapleItems = (list: ShoppingList) => list.items.filter((i) => i.is_staple && !i.have_it);
export const haveItItems = (list: ShoppingList) => list.items.filter((i) => i.have_it);

export function groupByCategory(items: readonly ShoppingItem[]) {
  return CATEGORY_ORDER.map((category) => ({
    category,
    label: CATEGORY_LABELS[category],
    items: items.filter((i) => i.category === category),
  })).filter((g) => g.items.length > 0);
}
