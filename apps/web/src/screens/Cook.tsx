import { useMemo, useState } from 'react';
import {
  MIN_INGREDIENTS,
  PreferencesSchema,
  filterCatalog,
  ingredientName,
  m5NoMatch,
  matchRecipes,
  type MatchFilters,
  type MatchResult,
} from '@nutri-plan/core';
import { Chip, ChipGroup } from '../components/Chip';
import { EmptyState } from '../components/EmptyState';
import { IngredientInput } from '../components/IngredientInput';
import { es } from '../i18n/es';
import { useNav } from '../navigation/NavProvider';
import { useApp } from '../state/AppProvider';
import { frequentIngredients } from '../state/selectors';
import { useBottomButtons } from '../tg/BottomBar';
import { createNutriBridge } from '../tg/nutri';

const PAGE = 3;

export function Cook() {
  const { state, dispatch, app, botUsername } = useApp();
  const nav = useNav();
  const nutri = useMemo(() => createNutriBridge(app, botUsername), [app, botUsername]);
  const catalog = state.catalog!;
  const prefs = state.prefs ?? PreferencesSchema.parse({});
  const [selected, setSelected] = useState<string[]>(state.pantry);
  const [unknown, setUnknown] = useState<string[]>([]);
  const [filters, setFilters] = useState<{ fast: boolean; veg: boolean; dinner: boolean }>({ fast: false, veg: false, dinner: false });
  const [results, setResults] = useState<MatchResult[] | null>(null);
  const [page, setPage] = useState(0);

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const names = ingredientName(catalog);
  // No sugerir ingredientes con alérgenos del usuario (RF-02).
  const excludedForSuggestions = useMemo(() => {
    const set = new Set(selected);
    for (const ing of catalog.ingredients.values()) {
      if (ing.allergens.some((a) => prefs.allergens.includes(a))) set.add(ing.slug);
    }
    return set;
  }, [selected, catalog, prefs.allergens]);
  const suggestions = frequentIngredients(catalog, excludedForSuggestions);
  const staples = [...catalog.ingredients.values()].filter((i) => i.is_staple).map((i) => i.slug);

  const search = () => {
    const matchFilters: MatchFilters = {
      ...(filters.fast ? { max_time: 20 } : {}),
      ...(filters.veg ? { style: 'vegetariano' as const } : {}),
      ...(filters.dinner ? { meal: 'cena' as const } : {}),
    };
    const all = matchRecipes(
      { available: selected, recipes: filterCatalog(catalog, prefs), staples, favorites: state.favorites, filters: matchFilters, limit: 50 },
      names,
    );
    setResults(all);
    setPage(0);
    dispatch({ type: 'pantry/set', slugs: selected });
    app.HapticFeedback.impactOccurred('medium');
  };

  const more = () => {
    if (!results) return;
    const next = page + 1;
    setPage(next * PAGE < results.length ? next : 0);
  };

  const canSearch = selected.length >= MIN_INGREDIENTS;
  useBottomButtons(
    results && results.length > PAGE ? { text: es.cook.more, onClick: more } : { text: es.cook.search, onClick: search, disabled: !canSearch },
  );

  const visible = results ? results.slice(page * PAGE, page * PAGE + PAGE) : [];

  return (
    <main className="screen">
      <header className="screen-header">
        <h1>{es.cook.title}</h1>
      </header>

      <section className="card form">
        <IngredientInput
          catalog={catalog}
          exclude={selectedSet}
          placeholder={es.cook.placeholder}
          onPick={(ing) => setSelected((s) => [...s, ing.slug])}
          onUnknown={(text) => setUnknown((u) => [...u, text])}
        />
        {(selected.length > 0 || unknown.length > 0) && (
          <ChipGroup>
            {selected.map((slug) => (
              <Chip key={slug} selected onRemove={() => setSelected((s) => s.filter((x) => x !== slug))}>
                {names(slug)}
              </Chip>
            ))}
            {unknown.map((text) => (
              <Chip key={text} onRemove={() => setUnknown((u) => u.filter((x) => x !== text))}>
                {text} ?
              </Chip>
            ))}
          </ChipGroup>
        )}
        {unknown[0] && <p className="hint">{es.cook.unknown(unknown[unknown.length - 1]!)}</p>}
        {!canSearch && <p className="hint">{es.cook.minTwo}</p>}
        {suggestions.length > 0 && (
          <>
            <span className="field-label">{es.cook.suggestions}</span>
            <ChipGroup>
              {suggestions.map((slug) => (
                <Chip key={slug} onClick={() => setSelected((s) => [...s, slug])}>
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
            onClick: () => nutri.ask(m5NoMatch([...selected.map(names), ...unknown], filters.dinner ? 'cena' : 'comida', filters.fast ? 20 : 30)),
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
                onClick={() => nav.push({ name: 'receta', slug: r.recipe.slug, from: 'cocinar', available: selected })}
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
    </main>
  );
}
