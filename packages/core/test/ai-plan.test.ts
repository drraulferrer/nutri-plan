import { describe, expect, it } from 'vitest';
import { AI_SYSTEM_PROMPT, AiPlanSchema, aiPlanToMenu, buildAiCandidates, buildAiUserPrompt, validateAiPlan, type AiPlan } from '../src/ai-plan';
import { slotWarnings } from '../src/planner';
import { CATALOG, prefs } from './fixtures';

const fullPlan = (p = prefs()): AiPlan => {
  const byMeal: Record<string, string[]> = {
    desayuno: ['yogur-avena', 'tostada-tomate', 'porridge-platano', 'huevos-revueltos', 'fruta-yogur', 'batido-leche', 'tortitas-avena'],
    comida: ['lentejas-verduras', 'arroz-pollo', 'garbanzos-espinacas', 'tofu-salteado', 'pasta-atun', 'arroz-verduras', 'merluza-horno'],
    cena: ['tortilla-espinacas', 'crema-puerro', 'sopa-pollo', 'revuelto-tofu', 'pisto', 'sandwich-pollo', 'merluza-plancha'],
  };
  return {
    slots: Object.entries(byMeal).flatMap(([meal, slugs]) =>
      slugs.slice(0, p.days).map((recipe_slug, day_index) => ({ day_index, meal: meal as AiPlan['slots'][number]['meal'], recipe_slug })),
    ),
    notes: 'El lunes haces doble de lentejas.',
  };
};

describe('buildAiCandidates', () => {
  it('excluye recetas incompatibles y resume ingredientes clave sin básicos', () => {
    const c = buildAiCandidates(CATALOG, prefs({ styles: ['vegetariano'], allergens: ['huevos'] }));
    expect(c.some((x) => x.protein === 'pollo')).toBe(false);
    expect(c.some((x) => x.slug === 'tortilla-espinacas')).toBe(false);
    const lentejas = c.find((x) => x.slug === 'lentejas-verduras')!;
    expect(lentejas.key_ingredients).not.toContain('aceite-oliva');
    expect(lentejas.batch).toBe(true);
  });
});

describe('validateAiPlan', () => {
  it('acepta un plan completo y válido', () => {
    expect(validateAiPlan(fullPlan(), prefs(), CATALOG)).toEqual([]);
  });
  it('detecta receta desconocida, repetida, incompatible, fuera de hueco y huecos que faltan', () => {
    const p = prefs({ allergens: ['huevos'], days: 5 });
    const plan: AiPlan = {
      slots: [
        { day_index: 0, meal: 'comida', recipe_slug: 'no-existe' },
        { day_index: 1, meal: 'comida', recipe_slug: 'tortilla-patata' }, // huevos
        { day_index: 2, meal: 'comida', recipe_slug: 'arroz-pollo' },
        { day_index: 3, meal: 'comida', recipe_slug: 'arroz-pollo' }, // repetida (no batch)
        { day_index: 4, meal: 'comida', recipe_slug: 'tostada-tomate' }, // desayuno en comida
        { day_index: 6, meal: 'comida', recipe_slug: 'pisto' }, // fuera de los 5 días
      ],
    };
    const errors = validateAiPlan(plan, p, CATALOG);
    expect(errors.join('|')).toContain('receta desconocida: no-existe');
    expect(errors.join('|')).toContain('incompatible con las restricciones: tortilla-patata');
    expect(errors.join('|')).toContain('arroz-pollo aparece 2 veces');
    expect(errors.join('|')).toContain('tostada-tomate no sirve para comida');
    expect(errors.join('|')).toContain('hueco fuera del plan: día 6');
    expect(errors.filter((e) => e.startsWith('falta el hueco')).length).toBe(10); // 5 desayunos + 5 cenas
  });
  it('permite dos apariciones de una receta batch', () => {
    const plan = fullPlan();
    const withBatch: AiPlan = { slots: plan.slots.map((s) => (s.day_index === 1 && s.meal === 'cena' ? { ...s, recipe_slug: 'lentejas-verduras' } : s)) };
    expect(validateAiPlan(withBatch, prefs(), CATALOG)).toEqual([]);
  });
});

describe('aiPlanToMenu', () => {
  it('construye 21 huecos con alternativas de otra proteína y avisos blandos', () => {
    const p = prefs({ cook_time: '15' });
    const menu = aiPlanToMenu({ plan: fullPlan(p), preferences: p, catalog: CATALOG, weekStart: '2026-09-07', seed: 'ai', warnings: [] });
    expect(menu.slots).toHaveLength(21);
    expect(menu.notes).toBe('El lunes haces doble de lentejas.');
    for (const s of menu.slots) {
      expect(s.servings).toBe(2);
      const chosen = CATALOG.recipes.get(s.recipe_slug!)!;
      for (const alt of s.alternatives) expect(CATALOG.recipes.get(alt)!.protein_group).not.toBe(chosen.protein_group);
    }
    const warnings = slotWarnings(menu.slots, p, CATALOG);
    expect(warnings.some((w) => w.type === 'time')).toBe(true);
  });
});

describe('prompts', () => {
  it('el prompt de usuario incluye petición, candidatos y errores previos', () => {
    const text = buildAiUserPrompt({ preferences: prefs(), candidates: buildAiCandidates(CATALOG, prefs()), favorites: ['pisto'], recentRecipes: [], previousErrors: ['falta el hueco 0-cena'] });
    expect(text).toContain('"favoritos":["pisto"]');
    expect(text).toContain('Candidatos');
    expect(text).toContain('falta el hueco 0-cena');
    expect(AI_SYSTEM_PROMPT).toContain('NO adaptes el menú');
    expect(AiPlanSchema.safeParse({ slots: [] }).success).toBe(false);
  });
});
