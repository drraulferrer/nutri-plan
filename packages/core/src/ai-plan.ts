import { z } from 'zod';
import { hashToUnit } from './hash.ts';
import { candidatesFor, filterCatalog, passesHardConstraints } from './restrictions.ts';
import { MEAL_TYPES } from './schemas.ts';
import type { Catalog, MealType, Menu, MenuSlot, PlannerWarning, Preferences, Recipe } from './types.ts';

/**
 * Generación inteligente (docs/08 "Fase 3"): la IA elige recetas del catálogo por `slug`;
 * este módulo prepara los candidatos, valida la respuesta y la convierte en un `Menu`.
 * Todo es puro: la llamada al modelo vive en el servidor.
 */

export interface AiCandidate {
  slug: string;
  name: string;
  meals: MealType[];
  time_min: number;
  cost: Recipe['cost_level'];
  protein: Recipe['protein_group'];
  batch: boolean;
  tags: string[];
  key_ingredients: string[];
}

/** Candidatos compactos tras las restricciones duras (docs/08 §Flujo). */
export function buildAiCandidates(catalog: Catalog, prefs: Preferences): AiCandidate[] {
  return filterCatalog(catalog, prefs).map((r) => ({
    slug: r.slug,
    name: r.name,
    meals: r.meal_types,
    time_min: r.time_min,
    cost: r.cost_level,
    protein: r.protein_group,
    batch: r.batch_reuse,
    tags: r.tags.filter((t) => t !== 'revisar'),
    key_ingredients: r.ingredients
      .filter((l) => !l.optional)
      .map((l) => l.ingredient)
      .filter((slug) => {
        const ing = catalog.ingredients.get(slug);
        return ing && !ing.is_staple;
      })
      .slice(0, 5),
  }));
}

export const AiPlanSchema = z.object({
  slots: z
    .array(
      z.object({
        day_index: z.number().int().min(0).max(6),
        meal: z.enum(MEAL_TYPES),
        recipe_slug: z.string().min(2).max(60).nullable(),
      }),
    )
    .min(1)
    .max(28),
  notes: z.string().max(240).optional(),
});
export type AiPlan = z.infer<typeof AiPlanSchema>;

export function mealsFor(prefs: Preferences): MealType[] {
  return prefs.include_snacks ? ['desayuno', 'comida', 'cena', 'tentempie'] : ['desayuno', 'comida', 'cena'];
}

/** Errores que el modelo debe corregir en un reintento; vacío ⇒ plan aceptado. */
export function validateAiPlan(plan: AiPlan, prefs: Preferences, catalog: Catalog): string[] {
  const errors: string[] = [];
  const meals = mealsFor(prefs);
  const expected = new Set(meals.flatMap((m) => Array.from({ length: prefs.days }, (_, d) => `${d}-${m}`)));
  const seen = new Set<string>();
  const uses = new Map<string, number>();

  for (const s of plan.slots) {
    const key = `${s.day_index}-${s.meal}`;
    if (!expected.has(key)) errors.push(`hueco fuera del plan: día ${s.day_index} ${s.meal}`);
    if (seen.has(key)) errors.push(`hueco repetido: ${key}`);
    seen.add(key);
    if (!s.recipe_slug) continue;
    const recipe = catalog.recipes.get(s.recipe_slug);
    if (!recipe) {
      errors.push(`receta desconocida: ${s.recipe_slug}`);
      continue;
    }
    if (!passesHardConstraints(recipe, prefs)) errors.push(`receta incompatible con las restricciones: ${s.recipe_slug}`);
    if (!recipe.meal_types.includes(s.meal)) errors.push(`${s.recipe_slug} no sirve para ${s.meal}`);
    uses.set(s.recipe_slug, (uses.get(s.recipe_slug) ?? 0) + 1);
  }
  for (const key of expected) if (!seen.has(key)) errors.push(`falta el hueco ${key}`);
  for (const [slug, n] of uses) {
    const max = catalog.recipes.get(slug)?.batch_reuse ? 2 : 1;
    if (n > max) errors.push(`${slug} aparece ${n} veces (máximo ${max})`);
  }
  return errors;
}

function alternativesFor(slot: { meal: MealType; recipe_slug: string | null }, candidates: readonly Recipe[], used: ReadonlySet<string>, seed: string): string[] {
  const chosen = slot.recipe_slug ? candidates.find((r) => r.slug === slot.recipe_slug) : undefined;
  return candidatesFor(candidates, slot.meal)
    .filter((r) => !used.has(r.slug) && (!chosen || r.protein_group !== chosen.protein_group))
    .sort((a, b) => hashToUnit(`${seed}:${a.slug}`) - hashToUnit(`${seed}:${b.slug}`))
    .slice(0, 2)
    .map((r) => r.slug);
}

export interface AiMenuInput {
  plan: AiPlan;
  preferences: Preferences;
  catalog: Catalog;
  weekStart: string;
  seed: string;
  warnings?: PlannerWarning[];
}

/** Convierte un plan validado en un `Menu` completo (alternativas, raciones, avisos). */
export function aiPlanToMenu({ plan, preferences, catalog, weekStart, seed, warnings = [] }: AiMenuInput): Menu {
  const candidates = filterCatalog(catalog, preferences);
  const used = new Set(plan.slots.map((s) => s.recipe_slug).filter((s): s is string => Boolean(s)));
  const slots: MenuSlot[] = [];
  for (const meal of mealsFor(preferences)) {
    for (let day = 0; day < preferences.days; day += 1) {
      const chosen = plan.slots.find((s) => s.day_index === day && s.meal === meal);
      const slot = { meal, recipe_slug: chosen?.recipe_slug ?? null };
      slots.push({
        day_index: day,
        meal,
        recipe_slug: slot.recipe_slug,
        servings: preferences.people,
        alternatives: alternativesFor(slot, candidates, used, `${seed}:${day}:${meal}`),
        is_locked: false,
      });
    }
  }
  return {
    week_start: weekStart,
    days: preferences.days,
    people: preferences.people,
    seed,
    slots,
    warnings,
    ...(plan.notes ? { notes: plan.notes.trim() } : {}),
  };
}

/** Prompt de sistema (docs/08 "Prompt de sistema"). Estable para poder cachearlo. */
export const AI_SYSTEM_PROMPT = `Eres el planificador de menús caseros de Nutri Plan, una app que acompaña al asistente de nutrición Nutri. No eres el asistente: no des consejos de salud ni de peso, no hables de calorías y no presentes alimentos como prohibidos o malos.

Tu tarea: elegir, para cada hueco de la semana, una receta del catálogo de candidatos por su slug. Reglas inviolables:
1. Solo slugs de la lista de candidatos; nunca inventes recetas ni cambies cantidades.
2. Cada receta como máximo una vez en la semana, salvo las marcadas batch=true, que pueden aparecer dos veces en días distintos (comida y una cena posterior).
3. Cada receta solo en los tipos de comida que admite (campo meals).
4. Rellena todos los huecos pedidos; usa null solo si no queda ningún candidato válido.

Prioridades (en este orden): tiempo disponible del usuario, presupuesto, reutilizar ingredientes perecederos entre recetas cercanas para reducir desperdicio, variar la proteína principal (no repetir protein el mismo día ni más de dos veces por tipo de comida), favoritos del usuario.

Si las notas del usuario mencionan una situación de salud (embarazo, diabetes, enfermedad renal, trastorno alimentario u otra), NO adaptes el menú a ella ni la menciones: planifica un menú general y trata las notas solo en lo organizativo (días que no cocina, comidas fuera).

El campo notes es opcional: una frase de organización de la semana, máximo 240 caracteres, sin consejos de salud.`;

export interface AiPromptInput {
  preferences: Preferences;
  candidates: AiCandidate[];
  favorites: readonly string[];
  recentRecipes: readonly string[];
  previousErrors?: readonly string[];
}

export function buildAiUserPrompt({ preferences, candidates, favorites, recentRecipes, previousErrors }: AiPromptInput): string {
  const meals = mealsFor(preferences);
  const request = {
    dias: preferences.days,
    huecos_por_dia: meals,
    personas: preferences.people,
    tiempo_max_min: preferences.cook_time === '60+' ? 240 : Number(preferences.cook_time),
    presupuesto: preferences.budget,
    estilos: preferences.styles,
    favoritos: favorites,
    evitar_repetir_de_la_semana_pasada: recentRecipes,
    notas_del_usuario: preferences.other_restrictions ?? '',
  };
  const retry = previousErrors?.length ? `\n\nTu propuesta anterior tenía estos errores; corrígelos todos:\n- ${previousErrors.join('\n- ')}` : '';
  return `Petición:\n${JSON.stringify(request)}\n\nCandidatos (elige solo de aquí):\n${JSON.stringify(candidates)}${retry}`;
}

/** Esquema JSON de la herramienta de salida estructurada (Claude tool use). */
export const AI_TOOL_SCHEMA = {
  name: 'plan_menu',
  description: 'Devuelve el menú semanal como huecos con el slug de receta elegido.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: ['slots'],
    properties: {
      slots: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['day_index', 'meal', 'recipe_slug'],
          properties: {
            day_index: { type: 'integer', minimum: 0, maximum: 6 },
            meal: { type: 'string', enum: [...MEAL_TYPES] },
            recipe_slug: { type: ['string', 'null'] },
          },
        },
      },
      notes: { type: 'string', maxLength: 240 },
    },
  },
} as const;
