import { useCallback, useMemo, useState } from 'react';
import {
  activeItems,
  formatQuantity,
  groupByCategory,
  haveItItems,
  renderListText,
  stapleItems,
  type ShoppingItem,
} from '@nutri-plan/core';
import { Banner } from '../components/Banner';
import { EmptyState } from '../components/EmptyState';
import { Stepper } from '../components/Stepper';
import { Toast } from '../components/Toast';
import { es } from '../i18n/es';
import { useNav } from '../navigation/NavProvider';
import { useApp } from '../state/AppProvider';
import { formatWeekLabel, listProgress } from '../state/selectors';
import { useBottomButtons } from '../tg/BottomBar';
import { createNutriBridge } from '../tg/nutri';

export function ShoppingList() {
  const { state, dispatch, app, botUsername } = useApp();
  const nav = useNav();
  const nutri = useMemo(() => createNutriBridge(app, botUsername), [app, botUsername]);
  const { list, menu, catalog } = state;
  const [expanded, setExpanded] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const clearToast = useCallback(() => setToast(null), []);

  const weekLabel = menu ? formatWeekLabel(menu.week_start, menu.days) : '';
  const text = list ? renderListText(list, { weekLabel, botUsername }) : '';

  useBottomButtons(
    list ? { text: es.list.share, onClick: () => nutri.share(text) } : null,
    list
      ? {
          text: es.list.copy,
          onClick: () => {
            void nutri.copy(text).then((ok) => (ok ? setToast(es.list.copied) : app.showAlert(text.slice(0, 500))));
          },
        }
      : null,
  );

  if (!list || !menu || !catalog) {
    return (
      <main className="screen">
        <EmptyState icon="🛒" title={es.list.emptyTitle} text={es.list.emptyText} action={{ label: es.list.goMenu, onClick: () => nav.replace({ name: 'menu' }) }} />
      </main>
    );
  }

  const progress = listProgress(list);
  const groups = groupByCategory(activeItems(list));
  const staples = stapleItems(list);
  const have = haveItItems(list);

  const toggleChecked = (item: ShoppingItem) => {
    app.HapticFeedback.impactOccurred('light');
    dispatch({ type: 'list/mark', slug: item.ingredient, checked: !item.checked });
  };
  const setHaveIt = (item: ShoppingItem, have_it: boolean) => {
    app.HapticFeedback.selectionChanged();
    dispatch({ type: 'list/mark', slug: item.ingredient, have_it });
  };

  const usedIn = (item: ShoppingItem) =>
    [...new Set(item.source_slots.map((key) => {
      const [d, meal] = key.split('-');
      const slot = menu.slots.find((s) => s.day_index === Number(d) && s.meal === meal);
      return slot?.recipe_slug ? catalog.recipes.get(slot.recipe_slug)?.name : undefined;
    }).filter(Boolean))].join(', ');

  const row = (item: ShoppingItem, inHaveIt = false) => (
    <li key={item.ingredient} className={item.checked ? 'item checked' : 'item'}>
      <label className="item-main">
        <input type="checkbox" checked={item.checked} onChange={() => toggleChecked(item)} aria-label={item.name} />
        <span className="item-name">{item.name}</span>
      </label>
      <button type="button" className="item-qty" onClick={() => setExpanded(expanded === item.ingredient ? null : item.ingredient)} aria-expanded={expanded === item.ingredient}>
        {item.buy_label}
      </button>
      {inHaveIt ? (
        <button type="button" className="item-action" onClick={() => setHaveIt(item, false)}>
          {es.list.backToList}
        </button>
      ) : (
        <button type="button" className="item-action" onClick={() => setHaveIt(item, true)} aria-label={`${es.list.haveItAction}: ${item.name}`}>
          {es.list.haveItAction}
        </button>
      )}
      {expanded === item.ingredient && (
        <p className="item-detail">
          {es.list.needed(formatQuantity(item.needed_qty, item.unit))}
          {usedIn(item) && ` · ${es.list.usedIn} ${usedIn(item)}`}
        </p>
      )}
    </li>
  );

  return (
    <main className="screen">
      <header className="screen-header row">
        <div>
          <h1>{es.list.title}</h1>
          <p>{es.list.week(weekLabel)}</p>
        </div>
        <Stepper compact label={es.list.people} value={list.people} min={1} max={8} onChange={(p) => dispatch({ type: 'list/set-people', people: p })} format={(n) => `👥 ${n}`} />
      </header>

      {state.sync === 'offline' && <Banner tone="info">{es.common.offline}</Banner>}

      <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.done} aria-label={es.list.progress(progress.done, progress.total)}>
        <span className="progress-text">{progress.total > 0 && progress.done === progress.total ? es.list.allDone : es.list.progress(progress.done, progress.total)}</span>
        <span className="progress-bar">
          <span className="progress-fill" style={{ width: progress.total ? `${(100 * progress.done) / progress.total}%` : '0%' }} />
        </span>
      </div>

      {groups.map((g) => (
        <section key={g.category} className="list-group">
          <h2 className="group-title">
            {g.label} <span className="count">({g.items.length})</span>
          </h2>
          <ul className="items">{[...g.items].sort((a, b) => Number(a.checked) - Number(b.checked)).map((i) => row(i))}</ul>
        </section>
      ))}

      {staples.length > 0 && (
        <details className="list-group collapsible">
          <summary className="group-title">
            {es.list.staples} <span className="count">({staples.length})</span>
          </summary>
          <ul className="items">{staples.map((i) => row(i))}</ul>
        </details>
      )}
      {have.length > 0 && (
        <details className="list-group collapsible">
          <summary className="group-title">
            {es.list.haveIt} <span className="count">({have.length})</span>
          </summary>
          <ul className="items">{have.map((i) => row(i, true))}</ul>
        </details>
      )}
      <Toast message={toast} onDone={clearToast} />
    </main>
  );
}
