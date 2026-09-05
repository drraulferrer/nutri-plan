import { useMemo, useState } from 'react';
import {
  DAY_NAMES,
  formatQuantity,
  m2MissingIngredient,
  m3AskAboutRecipe,
  scaleRecipe,
  type MealType,
} from '@nutri-plan/core';
import { Chip, ChipGroup } from '../components/Chip';
import { EmptyState } from '../components/EmptyState';
import { Sheet, SheetAction } from '../components/Sheet';
import { Stepper } from '../components/Stepper';
import { Toast } from '../components/Toast';
import { ALLERGEN_OPTIONS, es } from '../i18n/es';
import type { Screen } from '../navigation/navigation';
import { useNav } from '../navigation/NavProvider';
import { useApp } from '../state/AppProvider';
import { useBottomButtons } from '../tg/BottomBar';
import { createNutriBridge } from '../tg/nutri';
import { ChangeDishSheet } from './menu/ChangeDishSheet';

type Props = Extract<Screen, { name: 'receta' }>;

const allergenLabel = (a: string) => ALLERGEN_OPTIONS.find((o) => o.value === a)?.label ?? a;

export function Recipe({ slug, from, day, meal, available }: Props) {
  const { state, dispatch, app, botUsername } = useApp();
  const nav = useNav();
  const nutri = useMemo(() => createNutriBridge(app, botUsername), [app, botUsername]);
  const catalog = state.catalog!;
  const recipe = catalog.recipes.get(slug);
  const slot = state.menu?.slots.find((s) => s.day_index === day && s.meal === meal) ?? null;
  const [servings, setServings] = useState(slot?.servings ?? state.prefs?.people ?? recipe?.servings_base ?? 2);
  const [sheet, setSheet] = useState<'none' | 'add' | 'change' | 'ask'>('none');
  const [toast, setToast] = useState<string | null>(null);

  if (!recipe) {
    return (
      <main className="screen">
        <EmptyState icon="📖" title="Receta no encontrada" action={{ label: es.common.back, onClick: nav.pop }} />
      </main>
    );
  }

  const availableSet = new Set(available ?? []);
  const staples = new Set([...catalog.ingredients.values()].filter((i) => i.is_staple).map((i) => i.slug));
  const scaled = scaleRecipe(recipe, servings, catalog);
  const missing = available ? scaled.filter((l) => !l.optional && !staples.has(l.ingredient) && !availableSet.has(l.ingredient)) : [];
  const conflicts = recipe.allergens.filter((a) => state.prefs?.allergens.includes(a));
  const optionalAllergens = [...new Set(recipe.ingredients.filter((l) => l.optional).flatMap((l) => catalog.ingredients.get(l.ingredient)?.allergens ?? []))].filter((a) => !recipe.allergens.includes(a));

  const addToMenu = (d: number, m: MealType) => {
    dispatch({ type: 'menu/set-slot', day: d, meal: m, recipe: recipe.slug });
    app.HapticFeedback.notificationOccurred('success');
    setSheet('none');
    setToast(es.recipe.added);
  };

  const askAbout = () => {
    if (missing[0]) return nutri.ask(m2MissingIngredient(recipe, missing.map((m) => m.name.toLowerCase()).join(', ')));
    setSheet('ask');
  };

  useBottomButtons(
    from === 'menu' && slot
      ? { text: es.recipe.changeDish, onClick: () => setSheet('change') }
      : { text: es.recipe.addToMenu, onClick: () => setSheet('add'), disabled: !state.menu },
    { text: missing[0] ? es.recipe.missingAsk(missing[0].name.toLowerCase()) : es.recipe.askNutri, onClick: askAbout },
  );

  return (
    <main className="screen recipe">
      <header className="screen-header">
        <h1>{recipe.name}</h1>
        {recipe.description && <p>{recipe.description}</p>}
        <ChipGroup>
          <Chip>⏱ {es.menu.minutes(recipe.time_min)}</Chip>
          {recipe.batch_reuse && <Chip>🔁 {es.recipe.tags['batch']}</Chip>}
          {recipe.tags.filter((t) => es.recipe.tags[t] && t !== 'batch').map((t) => (
            <Chip key={t}>{es.recipe.tags[t]}</Chip>
          ))}
          {recipe.styles.includes('vegano') ? <Chip tone="success">🌱 vegana</Chip> : recipe.styles.includes('vegetariano') ? <Chip tone="success">🥬 vegetariana</Chip> : null}
        </ChipGroup>
        <p className={conflicts.length ? 'allergens conflict' : 'allergens'}>
          {conflicts.length > 0 && '⚠️ '}
          <strong>{es.recipe.allergens}:</strong> {recipe.allergens.length ? recipe.allergens.map(allergenLabel).join(', ') : es.recipe.none}
          {optionalAllergens.length > 0 && ` · ${es.recipe.mayContain} ${optionalAllergens.map(allergenLabel).join(', ')}`}
          {conflicts.length > 0 && ` · ${es.recipe.conflict}`}
        </p>
      </header>

      <section className="card">
        <div className="row between">
          <h2 className="group-title">{es.recipe.ingredients}</h2>
          <Stepper compact label={es.recipe.servings} value={servings} min={1} max={8} onChange={setServings} format={(n) => `${n} rac.`} />
        </div>
        <ul className="ingredient-list">
          {scaled.map((l) => {
            const isMissing = missing.some((m) => m.ingredient === l.ingredient);
            const sub = recipe.substitutions.find((s) => s.ingredient === l.ingredient);
            return (
              <li key={l.ingredient} className={isMissing ? 'missing' : undefined}>
                <span>
                  {isMissing && '⚠️ '}
                  {l.name}
                  {l.note && <span className="hint"> · {l.note}</span>}
                  {l.optional && <span className="hint"> · {es.recipe.optional}</span>}
                  {isMissing && sub && <span className="hint"> · {es.recipe.missing} → {catalog.ingredients.get(sub.with)?.name ?? sub.with}</span>}
                </span>
                <span className="qty">{formatQuantity(l.scaled_quantity, l.unit)}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card">
        <h2 className="group-title">{es.recipe.steps}</h2>
        <ol className="steps">
          {recipe.steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      </section>

      {recipe.substitutions.length > 0 && (
        <section className="card">
          <h2 className="group-title">{es.recipe.substitutions}</h2>
          <ul className="subs">
            {recipe.substitutions.map((s, i) => (
              <li key={i}>
                {catalog.ingredients.get(s.ingredient)?.name ?? s.ingredient} → {catalog.ingredients.get(s.with)?.name ?? s.with}
                {s.note && <span className="hint"> · {s.note}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {recipe.tip && (
        <section className="card tip">
          <h2 className="group-title">{es.recipe.tip}</h2>
          <p>{recipe.tip}</p>
        </section>
      )}

      {sheet === 'add' && state.menu && (
        <Sheet open title={es.recipe.chooseSlot} onClose={() => setSheet('none')}>
          {Array.from({ length: state.menu.days }, (_, d) =>
            recipe.meal_types
              .filter((m) => state.menu!.slots.some((s) => s.day_index === d && s.meal === m))
              .map((m) => <SheetAction key={`${d}-${m}`} label={`${DAY_NAMES[d]} · ${es.common.meals[m]}`} onClick={() => addToMenu(d, m)} />),
          )}
        </Sheet>
      )}
      {sheet === 'change' && <ChangeDishSheet slot={slot} onClose={() => { setSheet('none'); nav.pop(); }} />}
      {sheet === 'ask' && (
        <Sheet open title={es.recipe.askNutri} onClose={() => setSheet('none')}>
          <SheetAction icon="💬" label="¿Me la puedes adaptar?" onClick={() => { nutri.ask(m3AskAboutRecipe(recipe, servings)); setSheet('none'); }} />
          <SheetAction icon="🧊" label="¿Puedo congelarla o hacerla con antelación?" onClick={() => { nutri.ask(m3AskAboutRecipe(recipe, servings, '¿puedo congelarla o prepararla con antelación?')); setSheet('none'); }} />
          <SheetAction icon="🔁" label="¿Con qué la acompaño o la completo?" onClick={() => { nutri.ask(m3AskAboutRecipe(recipe, servings, '¿con qué la acompaño para que sea una comida completa?')); setSheet('none'); }} />
        </Sheet>
      )}
      <Toast message={toast} onDone={() => setToast(null)} />
    </main>
  );
}
