import { assert, assertEquals } from 'jsr:@std/assert@1';
import { computeHash } from './auth.ts';
import { MemoryStore } from './memory-store.ts';
import { createApp } from './routes.ts';

const TOKEN = '123456:TEST-TOKEN-NOT-REAL';
const NOW = 1_800_000_000_000;

async function initDataFor(userId: number): Promise<string> {
  const params = new URLSearchParams({ user: JSON.stringify({ id: userId, first_name: 'Test', language_code: 'es' }), auth_date: String(NOW / 1000 - 30) });
  params.set('hash', await computeHash(params.toString(), TOKEN));
  return params.toString();
}

const ing = (slug: string, extra: Record<string, unknown> = {}) => ({ slug, name: `Ingrediente ${slug}`, category: 'verduras_fruta', default_unit: 'g', ...extra });
const recipe = (slug: string, meal: string[], extra: Record<string, unknown> = {}) => ({
  slug,
  name: `Receta ${slug}`,
  time_min: 20,
  meal_types: meal,
  protein_group: 'ninguno',
  styles: ['mediterraneo', 'vegetariano', 'vegano', 'sin_gluten', 'sin_lactosa'],
  ingredients: [{ ingredient: 'tomate', quantity: 2, unit: 'ud' }, { ingredient: 'arroz', quantity: 100, unit: 'g' }],
  steps: ['Cocina.'],
  ...extra,
});

const CATALOG = {
  ingredients: [ing('tomate', { default_unit: 'ud', grams_per_unit: 150 }), ing('arroz', { category: 'despensa', package_size: 1000, package_label: 'paquete de 1 kg' })],
  recipes: [
    ...['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7'].map((s) => recipe(s, ['desayuno'])),
    ...['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7'].map((s) => recipe(s, ['comida'])),
    ...['n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7'].map((s) => recipe(s, ['cena'])),
  ],
};

const PREFS = { people: 2, days: 7, include_snacks: false, cook_time: '30', budget: 'medio', styles: ['mediterraneo'], allergens: [], allergens_confirmed: true, disliked_ingredients: [] };

function makeApp() {
  const store = new MemoryStore(CATALOG);
  const app = createApp(store, { botToken: TOKEN, allowedOrigins: ['http://localhost:5173'], now: () => NOW });
  const call = async (method: string, path: string, initData?: string, body?: unknown) => {
    const res = await app.request(`http://x/api${path}`, {
      method,
      headers: { ...(initData ? { Authorization: `tma ${initData}` } : {}), 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, json: res.status === 204 ? null : await res.json() };
  };
  return { store, call };
}

Deno.test('health y catálogo son públicos', async () => {
  const { call } = makeApp();
  assertEquals((await call('GET', '/health')).json.data.phase, 2);
  assertEquals((await call('GET', '/catalog')).json.data.recipes.length, 21);
});

Deno.test('sin initData → 401 en rutas /me', async () => {
  const { call } = makeApp();
  const res = await call('GET', '/me/state');
  assertEquals(res.status, 401);
  assertEquals(res.json.error.code, 'unauthorized');
});

Deno.test('sesión crea el perfil y devuelve estado vacío', async () => {
  const { call } = makeApp();
  const res = await call('POST', '/me/session', await initDataFor(1));
  assertEquals(res.status, 200);
  assertEquals(res.json.data.state.menu, null);
  assert(res.json.data.profile.id);
});

Deno.test('PUT /me/state guarda y GET lo devuelve; alergias sin confirmar → 422', async () => {
  const { call } = makeApp();
  const a = await initDataFor(1);
  const bad = await call('PUT', '/me/state', a, { preferences: { ...PREFS, allergens: ['huevos'], allergens_confirmed: false } });
  assertEquals(bad.status, 422);
  const put = await call('PUT', '/me/state', a, { preferences: PREFS, pantry: ['arroz'], favorites: ['c1'] });
  assertEquals(put.status, 200);
  const get = await call('GET', '/me/state', a);
  assertEquals(get.json.data.preferences.people, 2);
  assertEquals(get.json.data.pantry, ['arroz']);
  assertEquals(get.json.data.favorites, ['c1']);
  assert(get.json.data.updated_at);
});

Deno.test('generar menú en el servidor produce 21 huecos y lista de compra', async () => {
  const { call } = makeApp();
  const a = await initDataFor(1);
  const noPrefs = await call('POST', '/me/menus/generate', a, {});
  assertEquals(noPrefs.status, 422);
  await call('PUT', '/me/state', a, { preferences: PREFS });
  const res = await call('POST', '/me/menus/generate', a, { seed: 'abc' });
  assertEquals(res.status, 200);
  assertEquals(res.json.data.menu.slots.length, 21);
  assertEquals(res.json.data.menu.slots.filter((s: { recipe_slug: string | null }) => s.recipe_slug).length, 21);
  assertEquals(res.json.data.menu.seed, 'abc');
  assert(res.json.data.shopping_list.items.length > 0);
  const again = await call('POST', '/me/menus/generate', a, { seed: 'abc' });
  assertEquals(again.json.data.menu.slots.map((s: { recipe_slug: string }) => s.recipe_slug), res.json.data.menu.slots.map((s: { recipe_slug: string }) => s.recipe_slug));
});

Deno.test('aislamiento: el usuario B no ve el estado de A', async () => {
  const { call } = makeApp();
  const a = await initDataFor(1);
  const b = await initDataFor(2);
  await call('PUT', '/me/state', a, { preferences: PREFS, favorites: ['c1'] });
  const stateB = await call('GET', '/me/state', b);
  assertEquals(stateB.json.data.preferences, null);
  assertEquals(stateB.json.data.favorites, []);
});

Deno.test('límite: la 11ª generación en un minuto devuelve 429', async () => {
  const { call } = makeApp();
  const a = await initDataFor(3);
  await call('PUT', '/me/state', a, { preferences: PREFS });
  let last = 0;
  for (let i = 0; i < 11; i += 1) last = (await call('POST', '/me/menus/generate', a, {})).status;
  assertEquals(last, 429);
});

Deno.test('DELETE /me borra el estado; eventos se registran; cuerpo inválido → 422', async () => {
  const { store, call } = makeApp();
  const a = await initDataFor(4);
  await call('PUT', '/me/state', a, { preferences: PREFS });
  assertEquals((await call('POST', '/me/events', a, { screen: 'menu', action: 'generate' })).status, 204);
  assertEquals(store.events.length, 1);
  assertEquals((await call('POST', '/me/events', a, { screen: '' })).status, 422);
  assertEquals((await call('PUT', '/me/state', a, { menu: { bad: true } })).status, 422);
  const del = await call('DELETE', '/me', a);
  assertEquals(del.json.data.deleted, true);
  assertEquals((await call('GET', '/me/state', a)).json.data.preferences, null);
});
