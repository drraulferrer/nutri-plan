/**
 * Puente bot → app (docs/03 §7, docs/13): el backend de Nutri lee y cambia el menú del usuario
 * con un secreto compartido. Nunca se expone al frontend.
 */
import type { Hono } from 'hono';
import { z } from 'zod';
import { DAY_NAMES } from '../_shared/core/templates.ts';
import { MEAL_TYPES } from '../_shared/core/schemas.ts';
import { passesHardConstraints } from '../_shared/core/restrictions.ts';
import { mergePantry, parsePantryText } from '../_shared/core/pantry-text.ts';
import { activeItems, buildShoppingList, diffShoppingLists } from '../_shared/core/shopping.ts';
import type { Catalog, MealType, Menu } from '../_shared/core/types.ts';
import { timingSafeEqual } from './auth.ts';
import { fail, loadCatalogFromStore, ok, type Vars } from './routes.ts';
import type { Store, UserState } from './store.ts';

const TelegramId = z.string().regex(/^\d{1,20}$/);
const SlotBody = z.object({ recipe_slug: z.string().min(2).max(60).nullable() });
const PantryBody = z.object({
  /** Ingredientes en texto libre, tal y como Nutri los extrae de la foto de la nevera. */
  items: z.array(z.string().min(1).max(120)).max(120),
  mode: z.enum(['merge', 'replace']).default('merge'),
});

function summarizeMenu(menu: Menu, catalog: Catalog) {
  const name = (slug: string | null) => (slug ? (catalog.recipes.get(slug)?.name ?? slug) : null);
  return {
    week_start: menu.week_start,
    days: menu.days,
    ref: menu.seed,
    notes: menu.notes ?? null,
    plan: Array.from({ length: menu.days }, (_, d) => ({
      day_index: d,
      day: DAY_NAMES[d],
      meals: Object.fromEntries(
        menu.slots
          .filter((s) => s.day_index === d)
          .map((s) => [
            s.meal,
            { recipe: s.recipe_slug, name: name(s.recipe_slug), locked: s.is_locked },
          ]),
      ),
    })),
  };
}

/** Contexto compacto (≤ 2 kB aprox.) que el agente lee antes de responder (docs/06 "Bot"). */
export function buildBotContext(state: UserState, catalog: Catalog) {
  const ingredientName = (slug: string) => catalog.ingredients.get(slug)?.name ?? slug;
  const list = state.shopping_list;
  const pending = list ? activeItems(list).filter((i) => !i.checked) : [];
  return {
    preferences: state.preferences,
    menu: state.menu ? summarizeMenu(state.menu, catalog) : null,
    shopping: list
      ? {
          total: activeItems(list).length,
          checked: activeItems(list).filter((i) => i.checked).length,
          pending: pending.slice(0, 12).map((i) => i.name),
        }
      : null,
    pantry: state.pantry.map(ingredientName),
    favorites: state.favorites.map((s) => catalog.recipes.get(s)?.name ?? s),
  };
}

export function registerBotRoutes(app: Hono<Vars>, store: Store, env: { botSecret: string }) {
  app.use('/bot/*', async (c, next) => {
    const provided = c.req.header('X-Bot-Secret') ?? '';
    if (!env.botSecret || !provided || !timingSafeEqual(provided, env.botSecret))
      return fail('forbidden', 'No autorizado');
    await next();
  });

  const withUser = async (
    raw: string,
    handler: (profileId: string, state: UserState, catalog: Catalog) => Promise<Response>,
  ) => {
    const id = TelegramId.safeParse(raw);
    if (!id.success) return fail('validation', 'telegram_user_id no válido');
    const profile = await store.findProfile(BigInt(id.data));
    if (!profile) return fail('not_found', 'Este usuario aún no ha abierto Nutri Plan');
    const [state, catalog] = await Promise.all([
      store.getState(profile.id),
      loadCatalogFromStore(store),
    ]);
    return handler(profile.id, state, catalog);
  };

  app.get('/bot/context/:tg', (c) =>
    withUser(c.req.param('tg'), async (_id, state, catalog) => ok(buildBotContext(state, catalog))),
  );

  app.get('/bot/context/:tg/slots/:day/:meal', (c) =>
    withUser(c.req.param('tg'), async (_id, state, catalog) => {
      const day = Number(c.req.param('day'));
      const meal = c.req.param('meal') as MealType;
      const slot = state.menu?.slots.find((s) => s.day_index === day && s.meal === meal);
      if (!slot) return fail('not_found', 'Hueco no encontrado');
      const recipe = slot.recipe_slug ? catalog.recipes.get(slot.recipe_slug) : null;
      return ok({
        slot,
        recipe: recipe ?? null,
        alternatives: slot.alternatives
          .map((a) => catalog.recipes.get(a))
          .filter(Boolean)
          .map((r) => ({
            slug: r!.slug,
            name: r!.name,
            time_min: r!.time_min,
            protein_group: r!.protein_group,
          })),
      });
    }),
  );

  app.post('/bot/context/:tg/slots/:day/:meal', (c) =>
    withUser(c.req.param('tg'), async (profileId, state, catalog) => {
      const body = SlotBody.safeParse(await c.req.json().catch(() => null));
      if (!body.success) return fail('validation', 'Cuerpo no válido');
      const day = Number(c.req.param('day'));
      const meal = c.req.param('meal');
      if (!MEAL_TYPES.includes(meal as MealType)) return fail('validation', 'Comida no válida');
      if (!state.menu || !state.preferences) return fail('not_found', 'El usuario no tiene menú');
      const exists = state.menu.slots.some((s) => s.day_index === day && s.meal === meal);
      if (!exists) return fail('not_found', 'Hueco no encontrado');
      const slug = body.data.recipe_slug;
      if (slug) {
        const recipe = catalog.recipes.get(slug);
        if (!recipe) return fail('validation', 'Receta desconocida');
        if (!recipe.meal_types.includes(meal as MealType))
          return fail('validation', `La receta no sirve para ${meal}`);
        if (!passesHardConstraints(recipe, state.preferences))
          return fail('validation', 'La receta choca con las alergias o el estilo del usuario');
      }
      const menu: Menu = {
        ...state.menu,
        slots: state.menu.slots.map((s) =>
          s.day_index === day && s.meal === meal
            ? { ...s, recipe_slug: slug, alternatives: s.alternatives.filter((a) => a !== slug) }
            : s,
        ),
      };
      const shoppingList = buildShoppingList({
        slots: menu.slots,
        catalog,
        people: state.shopping_list?.people ?? state.preferences.people,
        pantry: state.pantry,
        previous: state.shopping_list ?? undefined,
      });
      const next = await store.putState(profileId, { menu, shopping_list: shoppingList });
      const delta = state.shopping_list
        ? diffShoppingLists(state.shopping_list, shoppingList)
        : { added: shoppingList.items.map((i) => i.ingredient), removed: [], changed: [] };
      return ok({
        slot: next.menu?.slots.find((s) => s.day_index === day && s.meal === meal) ?? null,
        shopping_list_delta: delta,
      });
    }),
  );

  // Despensa: Nutri analiza la foto de la nevera en el chat y sube aquí la lista (docs/13).
  app.put('/bot/context/:tg/pantry', (c) =>
    withUser(c.req.param('tg'), async (profileId, state, catalog) => {
      const body = PantryBody.safeParse(await c.req.json().catch(() => null));
      if (!body.success) return fail('validation', 'Cuerpo no válido');
      const { matched, unknown } = parsePantryText(body.data.items.join('\n'), catalog);
      const slugs = matched.map((m) => m.slug);
      const pantry = body.data.mode === 'replace' ? slugs : mergePantry(state.pantry, slugs);
      const next = await store.putState(profileId, { pantry });
      return ok({
        pantry: next.pantry.map((slug) => ({ slug, name: catalog.ingredients.get(slug)?.name ?? slug })),
        recognized: matched.map((m) => ({ slug: m.slug, name: m.name, from: m.raw })),
        unknown,
      });
    }),
  );

  app.get('/bot/recipes/:slug', async (c) => {
    const catalog = await loadCatalogFromStore(store);
    const recipe = catalog.recipes.get(c.req.param('slug'));
    return recipe ? ok(recipe) : fail('not_found', 'Receta no encontrada');
  });
}
