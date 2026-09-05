import type { MenuSlot, PlannerWarning, Recipe } from '@nutri-plan/core';
import { es } from '../../i18n/es';

interface Props {
  slot: MenuSlot;
  recipe: Recipe | undefined;
  alternatives: Recipe[];
  isFavorite: boolean;
  warning: PlannerWarning | undefined;
  cookTime: string;
  onOpen: () => void;
  onMore: () => void;
}

export function SlotCard({ slot, recipe, alternatives, isFavorite, warning, cookTime, onOpen, onMore }: Props) {
  const meal = es.common.meals[slot.meal] ?? slot.meal;
  return (
    <article className={slot.recipe_slug ? 'slot-card' : 'slot-card empty-slot'}>
      <header className="slot-head">
        <span className="slot-meal">{meal}</span>
        <button type="button" className="icon-btn" aria-label={`${es.menu.slotActions}: ${meal}`} onClick={onMore}>
          ⋯
        </button>
      </header>
      {recipe ? (
        <button type="button" className="slot-body" onClick={onOpen}>
          <span className="slot-name">{recipe.name}</span>
          <span className="slot-meta">
            {es.menu.minutes(recipe.time_min)} · {es.menu.servings(slot.servings)}
            {isFavorite && <span className="tag">⭐ {es.menu.favorite}</span>}
            {recipe.batch_reuse && <span className="tag">🔁 {es.menu.batch}</span>}
            {slot.is_locked && <span className="tag">🔒 {es.menu.locked}</span>}
          </span>
          {alternatives.length > 0 && (
            <span className="slot-alts">
              {es.menu.alternatives}: {alternatives.map((a) => a.name.toLowerCase()).join(' · ')}
            </span>
          )}
          {warning?.type === 'time' && <span className="slot-warning">{es.menu.timeWarning(recipe.time_min, `${cookTime} min`)}</span>}
        </button>
      ) : (
        <button type="button" className="slot-body" onClick={onMore}>
          <span className="slot-name muted">{es.menu.emptySlot}</span>
        </button>
      )}
    </article>
  );
}
