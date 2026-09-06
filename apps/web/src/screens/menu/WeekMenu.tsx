import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DAY_SHORT,
  SAFETY_LABELS,
  detectSafetyFlags,
  diffShoppingLists,
  m4ImproveMenu,
  recipeName,
  type MenuSlot,
  type Recipe,
} from '@nutri-plan/core';
import { Banner } from '../../components/Banner';
import { EmptyState } from '../../components/EmptyState';
import { Sheet, SheetAction } from '../../components/Sheet';
import { es } from '../../i18n/es';
import { useNav } from '../../navigation/NavProvider';
import { useApp } from '../../state/AppProvider';
import { formatDayHeading, formatWeekLabel, newSeed, recipeOf, slotsOfDay, todayIndex } from '../../state/selectors';
import { useBottomButtons } from '../../tg/BottomBar';
import { createNutriBridge } from '../../tg/nutri';
import { AskNutriSheet } from './AskNutriSheet';
import { ChangeDishSheet } from './ChangeDishSheet';
import { SlotCard } from './SlotCard';

type SheetState = { kind: 'none' } | { kind: 'slot'; slot: MenuSlot } | { kind: 'change'; slot: MenuSlot } | { kind: 'ask'; slot: MenuSlot } | { kind: 'day'; day: number } | { kind: 'week' };

export function WeekMenu() {
  const { state, dispatch, app, botUsername, generateMenu } = useApp();
  const nav = useNav();
  const nutri = useMemo(() => createNutriBridge(app, botUsername), [app, botUsername]);
  const { prefs, menu, catalog, favorites, list } = state;
  const [generating, setGenerating] = useState(false);
  const [sheet, setSheet] = useState<SheetState>({ kind: 'none' });
  const [day, setDay] = useState<number>(() => (menu ? (todayIndex(menu) ?? 0) : 0));
  const [delta, setDelta] = useState<string | null>(null);
  const previousList = useRef(list);

  useEffect(() => {
    if (previousList.current && list && previousList.current !== list && menu) {
      const d = diffShoppingLists(previousList.current, list);
      if (d.added.length || d.removed.length) setDelta(es.menu.listUpdated(d.added.length, d.removed.length));
    }
    previousList.current = list;
  }, [list, menu]);

  const generate = () => {
    setGenerating(true);
    app.HapticFeedback.impactOccurred('medium');
    void generateMenu().finally(() => {
      setGenerating(false);
      app.HapticFeedback.notificationOccurred('success');
    });
  };

  const improve = () => {
    if (!menu || !prefs || !catalog) return;
    nutri.ask(m4ImproveMenu(menu, menu.seed, prefs, recipeName(catalog), formatWeekLabel(menu.week_start, menu.days)));
  };

  useBottomButtons(
    menu ? { text: es.menu.viewList, onClick: () => nav.push({ name: 'lista' }) } : prefs ? { text: es.menu.generate(prefs.days, prefs.people), onClick: generate, progress: generating } : null,
    menu ? { text: es.menu.improve, onClick: improve } : null,
  );

  if (!prefs || !catalog) {
    return (
      <main className="screen">
        <EmptyState icon="⚙️" title={es.home.welcomeTitle} text={es.home.welcome} action={{ label: es.home.start, onClick: () => nav.push({ name: 'prefs', firstRun: true }) }} />
      </main>
    );
  }

  if (!menu) {
    return (
      <main className="screen">
        <header className="screen-header">
          <h1>{es.menu.title}</h1>
        </header>
        {generating ? (
          <div className="skeletons" aria-busy="true" aria-label={prefs.use_ai === false || state.sync === 'local' ? es.menu.generating : es.menu.generatingAi}>
            <p className="hint">{prefs.use_ai === false || state.sync === 'local' ? es.menu.generating : es.menu.generatingAi}</p>
            <div className="skeleton" />
            <div className="skeleton" />
            <div className="skeleton" />
          </div>
        ) : (
          <EmptyState icon="🗓" title={es.menu.emptyTitle} text={es.menu.emptyText} />
        )}
      </main>
    );
  }

  const safety = detectSafetyFlags(prefs.other_restrictions);
  const fewRecipes = menu.warnings.some((w) => w.type === 'no_candidates');
  const currentDay = Math.min(day, menu.days - 1);
  const slots = slotsOfDay(menu, currentDay);
  const sheetSlot = sheet.kind === 'slot' || sheet.kind === 'change' || sheet.kind === 'ask' ? sheet.slot : null;
  const sheetRecipe = sheetSlot ? recipeOf(catalog, sheetSlot) : undefined;
  const close = () => setSheet({ kind: 'none' });

  // La semana completa se planifica en el servidor (IA si está activa); un día o un hueco, en local.
  const regenerateWeek = () =>
    app.showConfirm(es.menu.regenerateWeekConfirm, (ok) => {
      close();
      if (!ok) return;
      setGenerating(true);
      void generateMenu().finally(() => setGenerating(false));
    });

  return (
    <main className="screen">
      <header className="screen-header row">
        <div>
          <h1>{es.menu.title}</h1>
          <p>{es.home.week(formatWeekLabel(menu.week_start, menu.days))}</p>
        </div>
        <button type="button" className="icon-btn" aria-label={es.menu.weekActions} onClick={() => setSheet({ kind: 'week' })}>
          ⋯
        </button>
      </header>

      <nav className="day-tabs" aria-label="Días">
        {Array.from({ length: menu.days }, (_, i) => (
          <button key={i} type="button" className={i === currentDay ? 'day-tab active' : 'day-tab'} aria-current={i === currentDay ? 'date' : undefined} onClick={() => setDay(i)}>
            {DAY_SHORT[i]}
            {todayIndex(menu) === i && <span className="dot" aria-label="hoy" />}
          </button>
        ))}
      </nav>

      {generating && <Banner tone="info">⏳ {prefs.use_ai === false || state.sync === 'local' ? es.menu.generating : es.menu.generatingAi}</Banner>}
      {safety[0] && <Banner tone="warning">{es.menu.safetyNote(SAFETY_LABELS[safety[0]])}</Banner>}
      {fewRecipes && <Banner tone="info">{es.menu.fewRecipes}</Banner>}
      {menu.notes && <Banner tone="success">💬 {menu.notes}</Banner>}
      {menu.warnings.some((w) => w.type === 'ia_fallback') && <Banner tone="info">{es.menu.aiFallback}</Banner>}
      {delta && (
        <Banner tone="success" onClose={() => setDelta(null)}>
          {delta}
        </Banner>
      )}

      <section className="day">
        <header className="day-head">
          <h2>{formatDayHeading(menu.week_start, currentDay)}</h2>
          <button type="button" className="icon-btn" aria-label={es.menu.dayActions} onClick={() => setSheet({ kind: 'day', day: currentDay })}>
            ⋯
          </button>
        </header>
        <div className="slot-list">
          {slots.map((slot) => {
            const recipe = recipeOf(catalog, slot);
            const alts = slot.alternatives.map((a) => catalog.recipes.get(a)).filter((r): r is Recipe => Boolean(r));
            return (
              <SlotCard
                key={slot.meal}
                slot={slot}
                recipe={recipe}
                alternatives={alts}
                isFavorite={Boolean(slot.recipe_slug && favorites.includes(slot.recipe_slug))}
                warning={menu.warnings.find((w) => w.day_index === slot.day_index && w.meal === slot.meal && w.type === 'time')}
                cookTime={prefs.cook_time}
                onOpen={() => slot.recipe_slug && nav.push({ name: 'receta', slug: slot.recipe_slug, from: 'menu', day: slot.day_index, meal: slot.meal })}
                onMore={() => setSheet({ kind: 'slot', slot })}
              />
            );
          })}
        </div>
      </section>

      {sheet.kind === 'slot' && (
        <Sheet open title={sheetRecipe?.name ?? es.menu.slotActions} onClose={close}>
          {sheetRecipe && (
            <SheetAction
              icon="📖"
              label={es.menu.viewRecipe}
              onClick={() => {
                close();
                nav.push({ name: 'receta', slug: sheetRecipe.slug, from: 'menu', day: sheet.slot.day_index, meal: sheet.slot.meal });
              }}
            />
          )}
          <SheetAction icon="🔄" label={es.menu.change} hint={es.menu.changeHint} onClick={() => setSheet({ kind: 'change', slot: sheet.slot })} />
          {sheetRecipe && (
            <SheetAction
              icon="⭐"
              label={favorites.includes(sheetRecipe.slug) ? es.menu.unmarkFavorite : es.menu.markFavorite}
              onClick={() => {
                dispatch({ type: 'favorites/toggle', slug: sheetRecipe.slug });
                close();
              }}
            />
          )}
          <SheetAction
            icon="🔒"
            label={sheet.slot.is_locked ? es.menu.unlock : es.menu.lock}
            onClick={() => {
              dispatch({ type: 'menu/toggle-lock', day: sheet.slot.day_index, meal: sheet.slot.meal });
              close();
            }}
          />
          {sheet.slot.recipe_slug && (
            <SheetAction
              icon="🍴"
              label={es.menu.setEatOut}
              onClick={() => {
                dispatch({ type: 'menu/set-slot', day: sheet.slot.day_index, meal: sheet.slot.meal, recipe: null });
                close();
              }}
            />
          )}
          <SheetAction icon="💬" label={es.menu.askNutri} onClick={() => setSheet({ kind: 'ask', slot: sheet.slot })} />
        </Sheet>
      )}
      {sheet.kind === 'change' && <ChangeDishSheet slot={sheet.slot} onClose={close} />}
      {sheet.kind === 'ask' && <AskNutriSheet slot={sheet.slot} recipe={sheetRecipe} nutri={nutri} onClose={close} />}
      {sheet.kind === 'day' && (
        <Sheet open title={formatDayHeading(menu.week_start, sheet.day)} onClose={close}>
          <SheetAction
            icon="🎲"
            label={es.menu.regenerateDay}
            onClick={() => {
              dispatch({ type: 'menu/regenerate', seed: newSeed(), scope: { scope: 'day', day_index: sheet.day } });
              close();
            }}
          />
        </Sheet>
      )}
      {sheet.kind === 'week' && (
        <Sheet open title={es.menu.weekActions} onClose={close}>
          <SheetAction icon="🎲" label={es.menu.regenerateWeek} tone="danger" onClick={regenerateWeek} />
          <SheetAction icon="💬" label={es.menu.improve} onClick={() => { close(); improve(); }} />
        </Sheet>
      )}
    </main>
  );
}
