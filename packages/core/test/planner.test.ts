import { describe, expect, it } from 'vitest';
import type { Menu, Preferences } from '../src/types';
import { defaultWeekStart, planMenu, regenerateMenu } from '../src/planner';
import { passesHardConstraints } from '../src/restrictions';
import { ALLERGENS, DIET_STYLES } from '../src/schemas';
import { CATALOG, INGREDIENTS, RECIPES, makeCatalog, mulberry32, prefs } from './fixtures';

const plan = (p: Partial<Preferences> = {}, seed = 'test') =>
  planMenu({ preferences: prefs(p), catalog: CATALOG, weekStart: '2026-09-07', seed });

const filled = (menu: Menu) => menu.slots.filter((s) => s.recipe_slug);

describe('planMenu', () => {
  it('rellena 7 días × 3 comidas sin repetir recetas (salvo batch)', () => {
    // Sin tentempiés: desayuno, comida y cena no comparten repertorio.
    const menu = plan();
    expect(menu.slots).toHaveLength(21);
    expect(filled(menu)).toHaveLength(21);
    const counts = new Map<string, number>();
    filled(menu).forEach((s) => counts.set(s.recipe_slug!, (counts.get(s.recipe_slug!) ?? 0) + 1));
    for (const [slug, n] of counts) {
      const recipe = CATALOG.recipes.get(slug)!;
      expect(n, slug).toBeLessThanOrEqual(recipe.batch_reuse ? 2 : 1);
    }
  });

  it('5 días y tentempiés', () => {
    const menu = plan({ days: 5, include_snacks: true });
    expect(menu.slots).toHaveLength(20);
    expect(menu.slots.filter((s) => s.meal === 'tentempie')).toHaveLength(5);
  });

  it('una receta puede ser desayuno y tentempié, pero nunca dos veces el mismo día', () => {
    const menu = plan({ days: 7, include_snacks: true });
    const porDia = new Map<number, string[]>();
    const porComida = new Map<string, Set<string>>();
    for (const s of filled(menu)) {
      porDia.set(s.day_index, [...(porDia.get(s.day_index) ?? []), s.recipe_slug!]);
      porComida.set(s.recipe_slug!, new Set([...(porComida.get(s.recipe_slug!) ?? []), s.meal]));
    }
    for (const [dia, slugs] of porDia) expect(new Set(slugs).size, `día ${dia}`).toBe(slugs.length);
    for (const [slug, comidas] of porComida) {
      const recipe = CATALOG.recipes.get(slug)!;
      if (recipe.batch_reuse) continue;
      // Fuera de batch, solo se admite repetir entre desayuno y tentempié.
      const repetida = [...comidas].length > 1;
      if (repetida) expect([...comidas].every((m) => m === 'desayuno' || m === 'tentempie'), slug).toBe(true);
    }
  });

  it('es determinista con la misma semilla y varía con otra', () => {
    const a = plan({}, 'A');
    const b = plan({}, 'A');
    const c = plan({}, 'B');
    expect(a).toEqual(b);
    const diff = a.slots.filter((s, i) => s.recipe_slug !== c.slots[i]!.recipe_slug).length;
    expect(diff / a.slots.length).toBeGreaterThanOrEqual(0.3);
  });

  it('nunca incumple alergias, estilo ni ingredientes que no gustan (100 perfiles aleatorios)', () => {
    const rnd = mulberry32(42);
    const pick = <T>(arr: readonly T[], n: number) => [...arr].sort(() => rnd() - 0.5).slice(0, n);
    for (let i = 0; i < 100; i += 1) {
      const p = prefs({
        allergens: pick(ALLERGENS, Math.floor(rnd() * 3)),
        styles: ['mediterraneo', ...pick(DIET_STYLES.filter((s) => s !== 'mediterraneo'), Math.floor(rnd() * 2))],
        disliked_ingredients: pick(INGREDIENTS.map((x) => x.slug), Math.floor(rnd() * 3)),
        people: 1 + Math.floor(rnd() * 8),
        days: rnd() < 0.5 ? 5 : 7,
      });
      const menu = planMenu({ preferences: p, catalog: CATALOG, weekStart: '2026-09-07', seed: `p${i}` });
      for (const slot of filled(menu)) {
        const recipe = CATALOG.recipes.get(slot.recipe_slug!)!;
        expect(passesHardConstraints(recipe, p), `${recipe.slug} con ${JSON.stringify(p)}`).toBe(true);
        expect(recipe.meal_types).toContain(slot.meal);
        expect(slot.servings).toBe(p.people);
      }
    }
  });

  it('vegano ⇒ sin lácteos ni huevo; avisa si faltan candidatos', () => {
    const menu = plan({ styles: ['vegano'] });
    for (const s of filled(menu)) {
      const r = CATALOG.recipes.get(s.recipe_slug!)!;
      expect(r.allergens).not.toContain('lacteos');
      expect(r.allergens).not.toContain('huevos');
    }
    expect(menu.warnings.some((w) => w.type === 'no_candidates')).toBe(true);
  });

  it('emite aviso de tiempo sin bloquear cuando el límite es 15 min', () => {
    const menu = plan({ cook_time: '15' });
    expect(filled(menu).length).toBe(21);
    expect(menu.warnings.some((w) => w.type === 'time')).toBe(true);
  });

  it('las alternativas tienen distinta proteína que el plato elegido', () => {
    const menu = plan();
    for (const s of filled(menu)) {
      const chosen = CATALOG.recipes.get(s.recipe_slug!)!;
      for (const alt of s.alternatives) {
        expect(CATALOG.recipes.get(alt)!.protein_group).not.toBe(chosen.protein_group);
        expect(alt).not.toBe(s.recipe_slug);
      }
      expect(s.alternatives.length).toBeLessThanOrEqual(2);
    }
  });

  it('programa la segunda aparición de una receta batch como cena posterior', () => {
    const onlyBatch = makeCatalog(RECIPES.filter((r) => r.meal_types.includes('desayuno') || r.slug === 'lentejas-verduras' || r.meal_types.includes('cena')));
    let found = false;
    for (let i = 0; i < 20 && !found; i += 1) {
      const menu = planMenu({ preferences: prefs({ days: 5 }), catalog: onlyBatch, weekStart: '2026-09-07', seed: `b${i}` });
      const comida = menu.slots.find((s) => s.meal === 'comida' && s.recipe_slug === 'lentejas-verduras');
      const cena = menu.slots.find((s) => s.meal === 'cena' && (s.recipe_slug === 'lentejas-verduras' || s.recipe_slug === 'ensalada-lentejas'));
      if (comida && cena && cena.day_index > comida.day_index && cena.day_index - comida.day_index <= 2) found = true;
    }
    expect(found).toBe(true);
  });

  it('con solo dos cenas posibles avisa y no lanza excepción', () => {
    const tiny = makeCatalog(RECIPES.filter((r) => !r.meal_types.includes('cena') || r.slug === 'pisto' || r.slug === 'crema-calabacin'));
    const menu = planMenu({ preferences: prefs(), catalog: tiny, weekStart: '2026-09-07', seed: 's' });
    expect(menu.warnings.filter((w) => w.type === 'no_candidates').length).toBeGreaterThan(0);
    expect(menu.slots.filter((s) => s.meal === 'cena' && s.recipe_slug).length).toBeLessThanOrEqual(2 + 3); // 2 cenas + hasta 3 recetas comida/cena reutilizables
  });
});

describe('regenerateMenu', () => {
  const input = { preferences: prefs(), catalog: CATALOG, weekStart: '2026-09-07', seed: 'base' };

  it('regenerar un hueco excluye la receta actual y conserva el resto', () => {
    const menu = planMenu(input);
    const before = menu.slots.find((s) => s.day_index === 3 && s.meal === 'cena')!;
    const next = regenerateMenu(menu, { ...input, seed: 'base:1' }, { scope: 'slot', day_index: 3, meal: 'cena' });
    const after = next.slots.find((s) => s.day_index === 3 && s.meal === 'cena')!;
    expect(after.recipe_slug).not.toBe(before.recipe_slug);
    next.slots.filter((s) => !(s.day_index === 3 && s.meal === 'cena')).forEach((s, i) => {
      const original = menu.slots.filter((o) => !(o.day_index === 3 && o.meal === 'cena'))[i]!;
      expect(s.recipe_slug).toBe(original.recipe_slug);
    });
  });

  it('los huecos bloqueados no cambian al regenerar la semana', () => {
    const menu = planMenu(input);
    const locked: Menu = { ...menu, slots: menu.slots.map((s, i) => (i % 4 === 0 ? { ...s, is_locked: true } : s)) };
    const next = regenerateMenu(locked, { ...input, seed: 'other' }, { scope: 'week' });
    locked.slots.forEach((s, i) => {
      if (s.is_locked) expect(next.slots[i]!.recipe_slug).toBe(s.recipe_slug);
    });
    expect(next.slots.some((s, i) => !s.is_locked && s.recipe_slug !== locked.slots[i]!.recipe_slug)).toBe(true);
  });

  it('regenerar un día solo toca ese día', () => {
    const menu = planMenu(input);
    const next = regenerateMenu(menu, { ...input, seed: 'day' }, { scope: 'day', day_index: 2 });
    menu.slots.forEach((s, i) => {
      if (s.day_index !== 2) expect(next.slots[i]!.recipe_slug).toBe(s.recipe_slug);
    });
  });

  it('no muta el menú de entrada', () => {
    const menu = planMenu(input);
    const snapshot = JSON.stringify(menu);
    regenerateMenu(menu, input, { scope: 'week' });
    expect(JSON.stringify(menu)).toBe(snapshot);
  });
});

describe('defaultWeekStart', () => {
  it('lunes a miércoles ⇒ lunes de esta semana; desde el jueves ⇒ el siguiente', () => {
    expect(defaultWeekStart(new Date(2026, 8, 7))).toBe('2026-09-07'); // lunes
    expect(defaultWeekStart(new Date(2026, 8, 9))).toBe('2026-09-07'); // miércoles
    expect(defaultWeekStart(new Date(2026, 8, 10))).toBe('2026-09-14'); // jueves
    expect(defaultWeekStart(new Date(2026, 8, 13))).toBe('2026-09-14'); // domingo
  });
});
