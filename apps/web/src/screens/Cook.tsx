import { useMemo, useState } from 'react';
import {
  MIN_INGREDIENTS,
  PreferencesSchema,
  filterCatalog,
  ingredientName,
  m5NoMatch,
  matchRecipes,
  mergePantry,
  type MatchFilters,
  type MatchResult,
} from '@nutri-plan/core';
import { Chip, ChipGroup } from '../components/Chip';
import { EmptyState } from '../components/EmptyState';
import { IngredientInput } from '../components/IngredientInput';
import { Toast } from '../components/Toast';
import { es } from '../i18n/es';
import { useNav } from '../navigation/NavProvider';
import { useApp } from '../state/AppProvider';
import { frequentIngredients } from '../state/selectors';
import { useBottomButtons } from '../tg/BottomBar';
import { createNutriBridge } from '../tg/nutri';
import { PantrySheet } from './cook/PantrySheet';

const PAGE = 3;

export function Cook({ openPaste = false }: { openPaste?: boolean }) {
  const { state, dispatch, app, botUsername } = useApp();
  const nav = useNav();
  const nutri = useMemo(() => createNutriBridge(app, botUsername), [app, botUsername]);
  const catalog = state.catalog!;
  const prefs = state.prefs ?? PreferencesSchema.parse({});
  /** Los chips son la despensa: lo que hay aquí se usa también al planificar la semana. */
  const pantry = state.pantry;
  const [unknown, setUnknown] = useState<string[]>([]);
  const [filters, setFilters] = useState({ fast: false, veg: false, dinner: false });
  const [results, setResults] = useState<MatchResult[] | null>(null);
  const [page, setPage] = useState(0);
  const [pasting, setPasting] = useState(openPaste);
  const [toast, setToast] = useState<string | null>(null);

  const pantrySet = useMemo(() => new Set(pantry), [pantry]);
  const names = ingredientName(catalog);
  const staples = useMemo(() => [...catalog.ingredients.values()].filter((i) => i.is_staple).map((i) => i.slug), [catalog]);
  // No sugerir ingredientes con alérgenos del usuario (RF-02).
  const excluded = useMemo(() => {
    const set = new Set(pantry);
    for (const ing of catalog.ingredients.values()) {
      if (ing.allergens.some((a) => prefs.allergens.includes(a))) set.add(ing.slug);
    }
    return set;
  }, [pantry, catalog, prefs.allergens]);
  const suggestions = frequentIngredients(catalog, excluded);

  const setPantry = (slugs: string[]) => {
    dispatch({ type: 'pantry/set', slugs });
    setResults(null);
  };
  const addToPantry = (slugs: string[]) => {
    if (slugs.length > 0) {
      setPantry(mergePantry(pantry, slugs));
      app.HapticFeedback.notificationOccurred('success');
      setToast(es.pantry.added(slugs.length));
    }
    setPasting(false);
  };

  const search = () => {
    const matchFilters: MatchFilters = {
      ...(filters.fast ? { max_time: 20 } : {}),
      ...(filters.veg ? { style: 'vegetariano' as const } : {}),
      ...(filters.dinner ? { meal: 'cena' as const } : {}),
    };
    setResults(
      matchRecipes(
        { available: pantry, recipes: filterCatalog(catalog, prefs), staples, favorites: state.favorites, filters: matchFilters, limit: 50 },
        names,
      ),
    );
    setPage(0);
    app.HapticFeedback.impactOccurred('medium');
  };

  const canSearch = pantry.length >= MIN_INGREDIENTS;
  useBottomButtons(
    results && results.length > PAGE
      ? { text: es.cook.more, onClick: () => setPage((p) => ((p + 1) * PAGE < results.length ? p + 1 : 0)) }
      : { text: es.cook.search, onClick: search, disabled: !canSearch },
  );

  const visible = results ? results.slice(page * PAGE, page * PAGE + PAGE) : [];

  return (
    <main className="screen">
      <header className="screen-header">
        <h1>{es.cook.title}</h1>
        <p>{es.pantry.hint}</p>
      </header>

      <section className="card form">
        <button type="button" className="btn btn-secondary paste-btn" onClick={() => setPasting(true)}>
          📋 {es.pantry.paste}
        </button>
        <IngredientInput
          catalog={catalog}
          exclude={pantrySet}
          placeholder={es.cook.placeholder}
          onPick={(ing) => setPantry([...pantry, ing.slug])}
          onUnknown={(text) => setUnknown((u) => [...u, text])}
        />
        {pantry.length > 0 || unknown.length > 0 ? (
          <ChipGroup label={es.pantry.title}>
            {pantry.map((slug) => (
              <Chip key={slug} selected onRemove={() => setPantry(pantry.filter((x) => x !== slug))} removeLabel={`Quitar ${names(slug)}`}>
                {names(slug)}
              </Chip>
            ))}
            {unknown.map((text) => (
              <Chip key={text} onRemove={() => setUnknown((u) => u.filter((x) => x !== text))}>
                {text} ?
              </Chip>
            ))}
          </ChipGroup>
        ) : (
          <p className="hint">{es.pantry.empty}</p>
        )}
        {unknown[0] && <p className="hint">{es.cook.unknown(unknown[unknown.length - 1]!)}</p>}
        {!canSearch && pantry.length > 0 && <p className="hint">{es.cook.minTwo}</p>}
        {suggestions.length > 0 && (
          <>
            <span className="field-label">{es.cook.suggestions}</span>
            <ChipGroup>
              {suggestions.map((slug) => (
                <Chip key={slug} onClick={() => setPantry([...pantry, slug])}>
                  + {names(slug)}
                </Chip>
              ))}
            </ChipGroup>
          </>
        )}
        <ChipGroup label="Filtros">
          <Chip selected={filters.fast} onClick={() => setFilters((f) => ({ ...f, fast: !f.fast }))}>
            {es.cook.filters.fast}
          </Chip>
          <Chip selected={filters.veg} onClick={() => setFilters((f) => ({ ...f, veg: !f.veg }))}>
            {es.cook.filters.veg}
          </Chip>
          <Chip selected={filters.dinner} onClick={() => setFilters((f) => ({ ...f, dinner: !f.dinner }))}>
            {es.cook.filters.dinner}
          </Chip>
        </ChipGroup>
      </section>

      {results && results.length === 0 && (
        <EmptyState
          icon="🤔"
          title={es.cook.noResults}
          text={es.cook.noResultsText}
          action={{
            label: es.cook.askNutri,
            onClick: () => nutri.ask(m5NoMatch([...pantry.map(names), ...unknown], filters.dinner ? 'cena' : 'comida', filters.fast ? 20 : 30)),
          }}
        />
      )}

      {visible.length > 0 && (
        <section>
          <h2 className="group-title">{es.cook.results}</h2>
          <div className="result-list">
            {visible.map((r) => (
              <button
                key={r.recipe.slug}
                type="button"
                className="result-card"
                onClick={() => nav.push({ name: 'receta', slug: r.recipe.slug, from: 'cocinar', available: [...pantry] })}
              >
                <span className="slot-name">{r.recipe.name}</span>
                <span className={`match-label match-${r.label}`}>
                  {r.label === 'tienes_todo' || r.label === 'rapida' ? '✅' : '⚠️'} {r.label_text}
                </span>
                <span className="slot-meta">
                  {es.menu.minutes(r.recipe.time_min)} · {es.menu.servings(r.recipe.servings_base)}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {pasting && <PantrySheet catalog={catalog} current={pantry} onAdd={addToPantry} onClose={() => setPasting(false)} />}
      <Toast message={toast} onDone={() => setToast(null)} />
    </main>
  );
}
