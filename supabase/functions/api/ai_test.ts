import { assert, assertEquals } from 'jsr:@std/assert@1';
import { buildCatalog } from '../_shared/core/catalog.ts';
import { generateWithAi, type AiPlanner } from './ai.ts';
import type { Preferences } from '../_shared/core/types.ts';
import { computeHash } from './auth.ts';
import { MemoryStore } from './memory-store.ts';
import { createApp } from './routes.ts';

const TOKEN = '123456:TEST-TOKEN-NOT-REAL';
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
  ],
  recipes: [
    ...['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7'].map((s) => recipe(s, ['desayuno'])),
    ...['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7'].map((s) => recipe(s, ['comida'])),
    ...['n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7'].map((s) => recipe(s, ['cena'])),
    recipe('con-huevo', ['cena'], {
      protein_group: 'huevo',
      allergens: ['huevos'],
      styles: ['mediterraneo', 'vegetariano'],
      ingredients: [
        { ingredient: 'huevos', quantity: 2, unit: 'ud' },
        { ingredient: 'tomate', quantity: 1, unit: 'ud' },
      ],
    }),
  ],
};
const { catalog } = buildCatalog(
  ROWS.ingredients,
  ROWS.recipes.map((data, i) => ({ file: String(i), data })),
);
const PREFS: Preferences = {
  people: 2,
  days: 7,
  include_snacks: false,
  cook_time: '30',
  budget: 'medio',
  styles: ['mediterraneo'],
  allergens: [],
  allergens_confirmed: true,
  disliked_ingredients: [],
};

const validPlan = () => ({
  slots: [
    ...[0, 1, 2, 3, 4, 5, 6].map((d) => ({
      day_index: d,
      meal: 'desayuno',
      recipe_slug: `d${d + 1}`,
    })),
    ...[0, 1, 2, 3, 4, 5, 6].map((d) => ({
      day_index: d,
      meal: 'comida',
      recipe_slug: `c${d + 1}`,
    })),
    ...[0, 1, 2, 3, 4, 5, 6].map((d) => ({ day_index: d, meal: 'cena', recipe_slug: `n${d + 1}` })),
  ],
  notes: 'Semana sencilla.',
});

class FakePlanner implements AiPlanner {
  readonly model = 'fake';
  readonly prompts: string[] = [];
  constructor(private readonly answers: unknown[]) {}
  plan(
    _system: string,
    user: string,
  ): Promise<{ raw: unknown; usage: { input_tokens: number; output_tokens: number } }> {
    this.prompts.push(user);
    const raw = this.answers.shift();
    if (raw instanceof Error) return Promise.reject(raw);
    return Promise.resolve({ raw, usage: { input_tokens: 100, output_tokens: 50 } });
  }
}

const input = {
  preferences: PREFS,
  catalog,
  weekStart: '2026-09-07',
  seed: 'ai',
  favorites: [],
  pantry: [],
  recentRecipes: [],
};

Deno.test('plan válido a la primera → ok con notas y avisos', async () => {
  const r = await generateWithAi(new FakePlanner([validPlan()]), input);
  assertEquals(r.outcome, 'ok');
  assertEquals(r.menu.notes, 'Semana sencilla.');
  assertEquals(r.menu.slots.filter((s) => s.recipe_slug).length, 21);
  assertEquals(r.usage.input_tokens, 100);
});

Deno.test(
  'plan inválido y luego válido → retry_ok y el reintento incluye los errores',
  async () => {
    const bad = validPlan();
    bad.slots[0]!.recipe_slug = 'no-existe';
    const planner = new FakePlanner([bad, validPlan()]);
    const r = await generateWithAi(planner, input);
    assertEquals(r.outcome, 'retry_ok');
    assert(planner.prompts[1]!.includes('receta desconocida: no-existe'));
  },
);

Deno.test('dos planes inválidos pero legibles → reparado: se conservan los válidos y reglas rellena', async () => {
  const bad = validPlan();
  bad.slots[3]!.recipe_slug = 'c1'; // repetida (día 3 comida)
  bad.notes = 'Nota de la IA';
  const r = await generateWithAi(new FakePlanner([bad, bad]), input);
  assertEquals(r.outcome, 'repaired');
  assert(r.menu.warnings.some((w) => w.type === 'ia_repaired'));
  assertEquals(r.menu.notes, 'Nota de la IA');
  assertEquals(r.menu.slots.filter((s) => s.recipe_slug).length, 21);
  const day0 = r.menu.slots.find((s) => s.day_index === 0 && s.meal === 'comida')!;
  assertEquals(day0.recipe_slug, 'c1'); // la primera aparición se conserva
  const day3 = r.menu.slots.find((s) => s.day_index === 3 && s.meal === 'comida')!;
  assert(day3.recipe_slug !== 'c1' && day3.recipe_slug !== null); // la repetida se sustituye
  assert(r.menu.slots.every((s) => !s.is_locked));
});

Deno.test('respuesta ilegible dos veces → fallback completo a reglas', async () => {
  const r = await generateWithAi(new FakePlanner([{ slots: 'nope' }, 'x']), input);
  assertEquals(r.outcome, 'fallback');
  assert(r.menu.warnings.some((w) => w.type === 'ia_fallback'));
});

Deno.test('tiempo agotado en la llamada → fallback sin reintento', async () => {
  const slow: AiPlanner = {
    model: 'slow',
    plan: (_s, _u, signal) =>
      new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('The signal has been aborted')))),
  };
  const r = await generateWithAi(slow, { ...input, attemptTimeoutMs: 50 });
  assertEquals(r.outcome, 'fallback');
  assertEquals(r.errors[0], 'The signal has been aborted');
});

Deno.test('error de red → fallback', async () => {
  const r = await generateWithAi(new FakePlanner([new Error('Claude API 529')]), input);
  assertEquals(r.outcome, 'fallback');
  assertEquals(r.errors[0], 'Claude API 529');
});

Deno.test('la IA nunca cuela una receta con alérgenos del usuario (ni reparando)', async () => {
  const bad = validPlan();
  bad.slots[20]!.recipe_slug = 'con-huevo';
  const r = await generateWithAi(new FakePlanner([bad, bad]), {
    ...input,
    preferences: { ...PREFS, allergens: ['huevos'] },
  });
  assertEquals(r.outcome, 'repaired');
  assert(r.menu.slots.every((s) => s.recipe_slug !== 'con-huevo'));
});

async function initDataFor(userId: number): Promise<string> {
  const params = new URLSearchParams({
    user: JSON.stringify({ id: userId, first_name: 'Test' }),
    auth_date: String(NOW / 1000 - 30),
  });
  params.set('hash', await computeHash(params.toString(), TOKEN));
  return params.toString();
}

Deno.test(
  'POST /me/menus/generate usa la IA por defecto y registra el uso; use_ai=false usa reglas',
  async () => {
    const store = new MemoryStore(ROWS);
    const planner = new FakePlanner([validPlan(), validPlan()]);
    const app = createApp(store, {
      botToken: TOKEN,
      allowedOrigins: [],
      ai: planner,
      now: () => NOW,
    });
    const a = await initDataFor(9);
    const call = (method: string, path: string, body?: unknown) =>
      app.request(`http://x/api${path}`, {
        method,
        headers: { Authorization: `tma ${a}`, 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });

    await call('PUT', '/me/state', { preferences: PREFS });
    const ia = await (await call('POST', '/me/menus/generate', {})).json();
    assertEquals(ia.data.menu.notes, 'Semana sencilla.');
    assertEquals(store.aiUsage.length, 1);
    assertEquals(store.aiUsage[0]!.outcome, 'ok');

    await call('PUT', '/me/state', { preferences: { ...PREFS, use_ai: false } });
    const rules = await (await call('POST', '/me/menus/generate', { seed: 'r' })).json();
    assertEquals(rules.data.menu.notes, undefined);
    assertEquals(store.aiUsage.length, 1);
    assertEquals(planner.prompts.length, 1);
  },
);
