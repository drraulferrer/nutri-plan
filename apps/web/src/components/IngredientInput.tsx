import { useId, useState } from 'react';
import { resolveIngredient, searchIngredients, type Catalog, type Ingredient } from '@nutri-plan/core';

interface Props {
  catalog: Catalog;
  exclude: ReadonlySet<string>;
  placeholder: string;
  onPick: (ingredient: Ingredient) => void;
  onUnknown?: (text: string) => void;
}

/** Campo con autocompletado por nombre y sinónimos (docs/02 pantalla E). */
export function IngredientInput({ catalog, exclude, placeholder, onPick, onUnknown }: Props) {
  const [query, setQuery] = useState('');
  const listId = useId();
  const suggestions = searchIngredients(catalog, query, 8).filter((i) => !exclude.has(i.slug));

  const pick = (ing: Ingredient) => {
    onPick(ing);
    setQuery('');
  };

  const submit = () => {
    const exact = resolveIngredient(catalog, query);
    if (exact && !exclude.has(exact.slug)) return pick(exact);
    if (suggestions[0]) return pick(suggestions[0]);
    if (query.trim() && onUnknown) {
      onUnknown(query.trim());
      setQuery('');
    }
  };

  return (
    <div className="ingredient-input">
      <input
        type="search"
        className="input"
        value={query}
        placeholder={placeholder}
        autoComplete="off"
        autoCapitalize="none"
        enterKeyHint="done"
        aria-autocomplete="list"
        aria-controls={listId}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            submit();
          }
        }}
      />
      {suggestions.length > 0 && (
        <ul className="suggestions" id={listId} role="listbox">
          {suggestions.map((s) => (
            <li key={s.slug}>
              <button type="button" role="option" aria-selected={false} onClick={() => pick(s)}>
                {s.name}
                {s.aliases[0] && s.aliases[0].toLowerCase() !== s.name.toLowerCase() && <span className="hint"> · {s.aliases[0]}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
