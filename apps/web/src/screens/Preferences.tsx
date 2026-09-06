import { useEffect, useMemo, useState } from 'react';
import {
  PreferencesSchema,
  SAFETY_LABELS,
  SAFETY_NOTICE,
  detectSafetyFlags,
  m6SafetyRedirect,
  type Allergen,
  type DietStyle,
  type Preferences as Prefs,
} from '@nutri-plan/core';
import { Banner } from '../components/Banner';
import { Chip, ChipGroup } from '../components/Chip';
import { IngredientInput } from '../components/IngredientInput';
import { Segmented } from '../components/Segmented';
import { Stepper } from '../components/Stepper';
import { Toggle } from '../components/Toggle';
import { ALLERGEN_OPTIONS, COOK_TIME_OPTIONS, STYLE_OPTIONS, es } from '../i18n/es';
import { useNav } from '../navigation/NavProvider';
import { useApp } from '../state/AppProvider';
import { newSeed } from '../state/selectors';
import { useBottomButtons } from '../tg/BottomBar';
import { createNutriBridge } from '../tg/nutri';

const DEFAULTS: Prefs = PreferencesSchema.parse({});
const AFFECTS_MENU: (keyof Prefs)[] = ['people', 'days', 'include_snacks', 'styles', 'allergens', 'disliked_ingredients', 'cook_time', 'budget'];

function toggleIn<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function menuAffected(a: Prefs, b: Prefs): boolean {
  return AFFECTS_MENU.some((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
}

export function Preferences({ firstRun = false }: { firstRun?: boolean }) {
  const { state, dispatch, app, botUsername, clearAll } = useApp();
  const nav = useNav();
  const nutri = useMemo(() => createNutriBridge(app, botUsername), [app, botUsername]);
  const saved = state.prefs;
  const [form, setForm] = useState<Prefs>(() => saved ?? DEFAULTS);
  const [confirmed, setConfirmed] = useState<boolean>(saved?.allergens_confirmed ?? false);
  const catalog = state.catalog!;

  const dirty = JSON.stringify(form) !== JSON.stringify(saved ?? DEFAULTS) || confirmed !== (saved?.allergens_confirmed ?? false);
  const needsConfirm = form.allergens.length > 0 && !confirmed;
  const safetyFlags = detectSafetyFlags(form.other_restrictions);

  useEffect(() => {
    if (dirty) app.enableClosingConfirmation();
    else app.disableClosingConfirmation();
    return () => app.disableClosingConfirmation();
  }, [app, dirty]);

  const update = <K extends keyof Prefs>(key: K, value: Prefs[K]) => setForm((f) => ({ ...f, [key]: value }));
  const updateAllergens = (allergens: Allergen[]) => {
    setConfirmed(false);
    update('allergens', allergens);
  };
  const toggleStyle = (style: DietStyle) => {
    let styles = toggleIn(form.styles, style);
    if (style === 'vegano' && styles.includes('vegano')) styles = [...new Set([...styles, 'vegetariano' as const])];
    update('styles', styles);
  };

  const save = () => {
    const prefs: Prefs = { ...form, allergens_confirmed: form.allergens.length === 0 || confirmed };
    dispatch({ type: 'prefs/save', prefs });
    app.HapticFeedback.notificationOccurred('success');
    const affected = saved && state.menu && menuAffected(saved, prefs);
    const leave = () => (firstRun ? nav.replace({ name: 'menu' }) : nav.pop());
    if (!affected) return leave();
    app.showConfirm(es.prefs.regenerateAsk, (ok) => {
      if (ok) dispatch({ type: 'menu/regenerate', seed: newSeed(), scope: { scope: 'week' } });
      leave();
    });
  };

  useBottomButtons({ text: es.prefs.save, onClick: save, disabled: needsConfirm });

  const deleteData = () => {
    app.showConfirm(es.prefs.deleteConfirm, (ok) => {
      if (!ok) return;
      void clearAll().then(() => {
        app.HapticFeedback.notificationOccurred('warning');
        nav.reset({ name: 'inicio' });
      });
    });
  };

  const disliked = new Set(form.disliked_ingredients);

  return (
    <main className="screen">
      <header className="screen-header">
        <h1>{es.prefs.title}</h1>
      </header>

      <section className="card form">
        <Stepper label={es.prefs.people} value={form.people} min={1} max={8} onChange={(v) => update('people', v)} />
        <Segmented
          label={es.prefs.days}
          options={[
            { value: 5, label: es.prefs.days5 },
            { value: 7, label: es.prefs.days7 },
          ]}
          value={form.days}
          onChange={(v) => update('days', v as 5 | 7)}
        />
        <Toggle label={es.prefs.snacks} hint={es.prefs.snacksHint} checked={form.include_snacks} onChange={(v) => update('include_snacks', v)} />
        <Toggle label={es.prefs.useAi} hint={es.prefs.useAiHint} checked={form.use_ai ?? true} onChange={(v) => update('use_ai', v)} />
        <Segmented label={es.prefs.cookTime} options={COOK_TIME_OPTIONS} value={form.cook_time} onChange={(v) => update('cook_time', v)} />
        <Segmented
          label={es.prefs.budget}
          options={[
            { value: 'ajustado', label: es.prefs.budgets.ajustado },
            { value: 'medio', label: es.prefs.budgets.medio },
            { value: 'flexible', label: es.prefs.budgets.flexible },
          ]}
          value={form.budget}
          onChange={(v) => update('budget', v)}
        />
      </section>

      <section className="card form">
        <span className="field-label">{es.prefs.style}</span>
        <ChipGroup label={es.prefs.style}>
          {STYLE_OPTIONS.map((o) => (
            <Chip key={o.value} selected={form.styles.includes(o.value)} onClick={() => toggleStyle(o.value)}>
              {o.label}
            </Chip>
          ))}
        </ChipGroup>
        {form.styles.includes('vegano') && <p className="hint">{es.prefs.veganNote}</p>}
      </section>

      <section className="card form danger-zone" aria-labelledby="allergens-title">
        <span className="field-label danger" id="allergens-title">
          ⚠️ {es.prefs.allergens}
        </span>
        <p className="hint">{es.prefs.allergensHint}</p>
        <ChipGroup label={es.prefs.allergens}>
          {ALLERGEN_OPTIONS.map((o) => (
            <Chip key={o.value} tone="danger" selected={form.allergens.includes(o.value)} onClick={() => updateAllergens(toggleIn(form.allergens, o.value))}>
              {o.label}
            </Chip>
          ))}
        </ChipGroup>
        {form.allergens.length > 0 && (
          <label className="check-row">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
            <span>{es.prefs.confirmAllergens}</span>
          </label>
        )}
      </section>

      <section className="card form">
        <label className="field">
          <span className="field-label">{es.prefs.other}</span>
          <textarea
            className="input"
            rows={2}
            maxLength={200}
            placeholder={es.prefs.otherPlaceholder}
            value={form.other_restrictions ?? ''}
            onChange={(e) => update('other_restrictions', e.target.value || undefined)}
          />
          <span className="hint">
            {es.prefs.otherHint} · {(form.other_restrictions ?? '').length}/200
          </span>
        </label>
        {safetyFlags.length > 0 && (
          <Banner tone="warning" action={{ label: es.prefs.talkToNutri, onClick: () => nutri.ask(m6SafetyRedirect(safetyFlags[0]!)) }}>
            {SAFETY_NOTICE} ({SAFETY_LABELS[safetyFlags[0]!]})
          </Banner>
        )}
      </section>

      <section className="card form">
        <span className="field-label">{es.prefs.disliked}</span>
        <IngredientInput
          catalog={catalog}
          exclude={disliked}
          placeholder={es.prefs.dislikedPlaceholder}
          onPick={(ing) => update('disliked_ingredients', [...form.disliked_ingredients, ing.slug])}
        />
        {form.disliked_ingredients.length > 0 && (
          <ChipGroup>
            {form.disliked_ingredients.map((slug) => (
              <Chip key={slug} onRemove={() => update('disliked_ingredients', form.disliked_ingredients.filter((s) => s !== slug))}>
                {catalog.ingredients.get(slug)?.name ?? slug}
              </Chip>
            ))}
          </ChipGroup>
        )}
      </section>

      <p className="footnote">
        {es.prefs.privacy}{' '}
        <button type="button" className="link danger" onClick={deleteData}>
          {es.prefs.deleteData}
        </button>
      </p>
    </main>
  );
}
