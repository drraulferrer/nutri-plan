import { assert, assertEquals } from 'jsr:@std/assert@1';
import { computeHash } from './auth.ts';
import { MemoryStore } from './memory-store.ts';
import { createApp } from './routes.ts';

const TOKEN = '123456:TEST-TOKEN-NOT-REAL';
const SECRET = 'bot-secret-for-tests';
const NOW = 1_800_000_000_000;

const ing = (slug: string, extra: Record<string, unknown> = {}) => ({
  slug,
  name: `Ingrediente ${slug}`,
  category: 'verduras_fruta',
  default_unit: 'g',
  ...extra,
});
const recipe = (slug: string, meal: string[], extra: Record<string, unknown> = {}) => ({
  slug,
  name: `Receta ${slug}`,
  time_min: 20,
  meal_types: meal,
  protein_group: 'ninguno',
  styles: ['mediterraneo', 'vegetariano', 'vegano', 'sin_gluten', 'sin_lactosa'],
  ingredients: [
    { ingredient: 'tomate', quantity: 2, unit: 'ud' },
    { ingredient: 'arroz', quantity: 100, unit: 'g' },
  ],
  steps: ['Cocina.'],
  ...extra,
});
const ROWS = {
  ingredients: [
    ing('tomate', { default_unit: 'ud', grams_per_unit: 150 }),
    ing('arroz', { category: 'despensa', package_size: 1000, package_label: 'paquete de 1 kg' }),
    ing('huevos', { default_unit: 'ud', allergens: ['huevos'] }),
    ing('pepino', { default_unit: 'ud' }),
  ],
  recipes: [
    ...['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7'].map((s) => recipe(s, ['desayuno'])),
    ...['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7'].map((s) => recipe(s, ['comida'])),
    ...['n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7'].map((s) => recipe(s, ['cena'])),
    recipe('con-huevo', ['cena'], {
      protein_group: 'huevo',
      allergens: ['huevos'],
      styles: ['mediterraneo', 'vegetariano'],
      ingredients: [{ ingredient: 'huevos', quantity: 2, unit: 'ud' }],
    }),
    recipe('con-pepino', ['cena'], {
      ingredients: [{ ingredient: 'pepino', quantity: 1, unit: 'ud' }],
    }),
  ],
};
const PREFS = {
  people: 2,
  days: 7,
  include_snacks: false,
  cook_time: '30',
  budget: 'medio',
  styles: ['mediterraneo'],
  allergens: ['huevos'],
  allergens_confirmed: true,
  disliked_ingredients: [],
};

async function initDataFor(userId: number): Promise<string> {
  const params = new URLSearchParams({
    user: JSON.stringify({ id: userId, first_name: 'Test' }),
    auth_date: String(NOW / 1000 - 30),
  });
  params.set('hash', await computeHash(params.toString(), TOKEN));
  return params.toString();
}

async function setup() {
  const store = new MemoryStore(ROWS);
  const app = createApp(store, {
    botToken: TOKEN,
    allowedOrigins: [],
    botSecret: SECRET,
    now: () => NOW,
  });
  const a = await initDataFor(77);
  const user = (method: string, path: string, body?: unknown) =>
    app.request(`http://x/api${path}`, {
      method,
      headers: { Authorization: `tma ${a}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const bot = async (method: string, path: string, body?: unknown, secret = SECRET) => {
    const res = await app.request(`http://x/api${path}`, {
      method,
      headers: { 'X-Bot-Secret': secret, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, json: await res.json() };
  };
  await user('PUT', '/me/state', { preferences: PREFS, pantry: ['arroz'], favorites: ['c1'] });
  await user('POST', '/me/menus/generate', { seed: 'bot', source: 'reglas' });
  return { store, app, user, bot };
}

Deno.test('sin secreto o con secreto incorrecto → 403', async () => {
  const { bot } = await setup();
  assertEquals((await bot('GET', '/bot/context/77', undefined, '')).status, 403);
  assertEquals((await bot('GET', '/bot/context/77', undefined, 'wrong')).status, 403);
});

Deno.test('rutas /bot deshabilitadas si no hay secreto configurado', async () => {
  const app = createApp(new MemoryStore(ROWS), {
    botToken: TOKEN,
    allowedOrigins: [],
    botSecret: '',
  });
  const res = await app.request('http://x/api/bot/recipes/c1', { headers: { 'X-Bot-Secret': '' } });
  assertEquals(res.status, 403);
});

Deno.test('contexto compacto del usuario y 404 para desconocidos', async () => {
  const { bot } = await setup();
  assertEquals((await bot('GET', '/bot/context/12345')).status, 404);
  assertEquals((await bot('GET', '/bot/context/abc')).status, 422);
  const ctx = await bot('GET', '/bot/context/77');
  assertEquals(ctx.status, 200);
  assertEquals(ctx.json.data.menu.plan.length, 7);
  assertEquals(ctx.json.data.menu.plan[0].day, 'lunes');
  assert(ctx.json.data.menu.plan[0].meals.comida.name.startsWith('Receta'));
  assertEquals(ctx.json.data.pantry, ['Ingrediente arroz']);
  assertEquals(ctx.json.data.favorites, ['Receta c1']);
  assert(ctx.json.data.shopping.total > 0);
  assert(JSON.stringify(ctx.json.data).length < 4000);
});

Deno.test('leer y cambiar un hueco; alérgenos y comida incorrecta se rechazan', async () => {
  const { bot } = await setup();
  const before = await bot('GET', '/bot/context/77/slots/3/cena');
  assertEquals(before.status, 200);
  assert(before.json.data.recipe);

  assertEquals(
    (await bot('POST', '/bot/context/77/slots/3/cena', { recipe_slug: 'con-huevo' })).status,
    422,
  );
  assertEquals(
    (await bot('POST', '/bot/context/77/slots/3/cena', { recipe_slug: 'c1' })).status,
    422,
  ); // c1 es de comida
  assertEquals(
    (await bot('POST', '/bot/context/77/slots/3/merienda', { recipe_slug: 'n1' })).status,
    422,
  );

  const change = await bot('POST', '/bot/context/77/slots/3/cena', { recipe_slug: 'con-pepino' });
  assertEquals(change.status, 200);
  assertEquals(change.json.data.slot.recipe_slug, 'con-pepino');
  assert(change.json.data.shopping_list_delta.added.includes('pepino'));

  const after = await bot('GET', '/bot/context/77/slots/3/cena');
  assertEquals(after.json.data.recipe.slug, 'con-pepino');

  const eatOut = await bot('POST', '/bot/context/77/slots/3/cena', { recipe_slug: null });
  assertEquals(eatOut.json.data.slot.recipe_slug, null);
});

Deno.test('la despensa se sube desde el chat en texto libre', async () => {
  const { bot } = await setup();
  const res = await bot('PUT', '/bot/context/77/pantry', {
    items: ['6 huevos', '2 tomates', 'Medio pepino', 'salsa teriyaki'],
  });
  assertEquals(res.status, 200);
  assertEquals(res.json.data.recognized.map((r: { slug: string }) => r.slug), ['huevos', 'tomate', 'pepino']);
  assertEquals(res.json.data.unknown, ['salsa teriyaki']);
  // 'arroz' ya estaba en la despensa: merge conserva lo anterior.
  assertEquals(res.json.data.pantry.map((p: { slug: string }) => p.slug), ['arroz', 'huevos', 'tomate', 'pepino']);

  const replaced = await bot('PUT', '/bot/context/77/pantry', { items: ['tomate'], mode: 'replace' });
  assertEquals(replaced.json.data.pantry.map((p: { slug: string }) => p.slug), ['tomate']);

  assertEquals((await bot('PUT', '/bot/context/77/pantry', { items: 'no' })).status, 422);
  assertEquals((await bot('PUT', '/bot/context/999/pantry', { items: ['huevos'] })).status, 404);
});

Deno.test('receta por slug', async () => {
  const { bot } = await setup();
  assertEquals((await bot('GET', '/bot/recipes/c1')).json.data.name, 'Receta c1');
  assertEquals((await bot('GET', '/bot/recipes/nope')).status, 404);
});
