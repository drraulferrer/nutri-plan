/**
 * Generación con IA (docs/08 "Fase 3"): Claude elige recetas del catálogo por slug; el resultado
 * se valida con `core`. Si el plan tiene fallos, se reintenta una vez con los errores; si sigue
 * fallando, se REPARA (se conservan las elecciones válidas y el motor de reglas rellena el resto).
 * Solo si no hay ningún plan legible se usa el motor de reglas por completo.
 * La lista de compra la calcula siempre `core`.
 */
import {
  AI_SYSTEM_PROMPT,
  AI_TOOL_SCHEMA,
  AiPlanSchema,
  aiPlanToMenu,
  buildAiCandidates,
  buildAiUserPrompt,
  repairAiPlan,
  validateAiPlan,
  type AiPlan,
} from '../_shared/core/ai-plan.ts';
import { planMenu, slotWarnings } from '../_shared/core/planner.ts';
import type { Catalog, Menu, Preferences } from '../_shared/core/types.ts';

export interface AiUsage {
  input_tokens: number;
  output_tokens: number;
}

export interface AiPlanner {
  readonly model: string;
  /** Devuelve el JSON crudo de la herramienta `plan_menu` y el uso de tokens. */
  plan(system: string, user: string, signal: AbortSignal): Promise<{ raw: unknown; usage: AiUsage }>;
}

export type AiOutcome = 'ok' | 'retry_ok' | 'repaired' | 'fallback' | 'error';

export interface AiGenerateInput {
  preferences: Preferences;
  catalog: Catalog;
  weekStart: string;
  seed: string;
  favorites: readonly string[];
  pantry: readonly string[];
  recentRecipes: readonly string[];
  /** Tiempo máximo por llamada al modelo. */
  attemptTimeoutMs?: number;
  /** Número de llamadas al modelo (la segunda lleva los errores de la primera). */
  attempts?: number;
}

export interface AiGenerateResult {
  menu: Menu;
  outcome: AiOutcome;
  usage: AiUsage;
  errors: string[];
}

const DEFAULT_ATTEMPT_TIMEOUT_MS = 25_000;
const DEFAULT_ATTEMPTS = 2;

async function withTimeout<T>(ms: number, fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fn(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

function rulesInput(input: AiGenerateInput) {
  return {
    preferences: input.preferences,
    catalog: input.catalog,
    weekStart: input.weekStart,
    seed: input.seed,
    favorites: input.favorites,
    pantry: input.pantry,
    recentRecipes: input.recentRecipes,
  };
}

/** Plan reparado + huecos vacíos rellenados por reglas, conservando las notas de la IA. */
function repairedMenu(plan: AiPlan, input: AiGenerateInput, dropped: string[]): Menu {
  const base = aiPlanToMenu({
    plan,
    preferences: input.preferences,
    catalog: input.catalog,
    weekStart: input.weekStart,
    seed: input.seed,
  });
  const locked = base.slots.filter((s) => s.recipe_slug);
  const filled = planMenu({ ...rulesInput(input), lockedSlots: locked });
  const detail = dropped.length
    ? `descartado: ${dropped.slice(0, 3).join(', ')}`
    : 'huecos completados por reglas';
  return {
    ...filled,
    slots: filled.slots.map((s) => ({ ...s, is_locked: false })),
    warnings: [
      ...filled.warnings,
      ...slotWarnings(locked, input.preferences, input.catalog),
      { day_index: -1, meal: 'comida', type: 'ia_repaired', detail: detail.slice(0, 120) },
    ],
    ...(base.notes ? { notes: base.notes } : {}),
  };
}

/** Llama al modelo, valida, reintenta, repara y, en último término, cae a reglas. */
export async function generateWithAi(planner: AiPlanner, input: AiGenerateInput): Promise<AiGenerateResult> {
  const usage: AiUsage = { input_tokens: 0, output_tokens: 0 };
  const candidates = buildAiCandidates(input.catalog, input.preferences);
  const attempts = input.attempts ?? DEFAULT_ATTEMPTS;
  const timeout = input.attemptTimeoutMs ?? DEFAULT_ATTEMPT_TIMEOUT_MS;
  let errors: string[] = [];
  let lastPlan: AiPlan | null = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const user = buildAiUserPrompt({
      preferences: input.preferences,
      candidates,
      favorites: input.favorites,
      recentRecipes: input.recentRecipes,
      previousErrors: errors,
    });
    let raw: unknown;
    try {
      const res = await withTimeout(timeout, (signal) => planner.plan(AI_SYSTEM_PROMPT, user, signal));
      raw = res.raw;
      usage.input_tokens += res.usage.input_tokens;
      usage.output_tokens += res.usage.output_tokens;
    } catch (e) {
      errors = [e instanceof Error ? e.message : String(e)];
      break; // sin respuesta: no tiene sentido reintentar con "errores"
    }
    const parsed = AiPlanSchema.safeParse(raw);
    if (!parsed.success) {
      errors = parsed.error.issues.slice(0, 8).map((i) => `${i.path.join('.')}: ${i.message}`);
      continue;
    }
    lastPlan = parsed.data;
    errors = validateAiPlan(lastPlan, input.preferences, input.catalog);
    if (errors.length === 0) {
      const menu = aiPlanToMenu({
        plan: lastPlan,
        preferences: input.preferences,
        catalog: input.catalog,
        weekStart: input.weekStart,
        seed: input.seed,
      });
      return {
        menu: { ...menu, warnings: slotWarnings(menu.slots, input.preferences, input.catalog) },
        outcome: attempt === 0 ? 'ok' : 'retry_ok',
        usage,
        errors: [],
      };
    }
  }

  if (lastPlan) {
    const { plan, dropped } = repairAiPlan(lastPlan, input.preferences, input.catalog);
    return { menu: repairedMenu(plan, input, dropped), outcome: 'repaired', usage, errors };
  }

  const fallback = planMenu(rulesInput(input));
  return {
    menu: {
      ...fallback,
      warnings: [
        ...fallback.warnings,
        { day_index: -1, meal: 'comida', type: 'ia_fallback', detail: errors[0]?.slice(0, 120) ?? 'sin plan válido' },
      ],
    },
    outcome: 'fallback',
    usage,
    errors,
  };
}

/** Cliente mínimo de la API de Claude (tool use forzado) sin dependencias. */
export class ClaudePlanner implements AiPlanner {
  constructor(
    private readonly apiKey: string,
    readonly model: string = 'claude-sonnet-5',
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  static fromEnv(): ClaudePlanner | null {
    const key = Deno.env.get('ANTHROPIC_API_KEY');
    if (!key) return null;
    return new ClaudePlanner(key, Deno.env.get('ANTHROPIC_MODEL') || 'claude-sonnet-5');
  }

  async plan(system: string, user: string, signal: AbortSignal): Promise<{ raw: unknown; usage: AiUsage }> {
    const res = await this.fetchImpl('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 2500,
        system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
        tools: [AI_TOOL_SCHEMA],
        tool_choice: { type: 'tool', name: AI_TOOL_SCHEMA.name },
        messages: [{ role: 'user', content: user }],
      }),
    });
    if (!res.ok) throw new Error(`Claude API ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const body = (await res.json()) as {
      content: Array<{ type: string; name?: string; input?: unknown }>;
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const tool = body.content.find((c) => c.type === 'tool_use' && c.name === AI_TOOL_SCHEMA.name);
    if (!tool) throw new Error('La respuesta no contiene el plan');
    return {
      raw: tool.input,
      usage: { input_tokens: body.usage?.input_tokens ?? 0, output_tokens: body.usage?.output_tokens ?? 0 },
    };
  }
}
