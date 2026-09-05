import { useMemo } from 'react';
import { es } from '../i18n/es';
import { useNav } from '../navigation/NavProvider';
import { useApp } from '../state/AppProvider';
import { formatWeekLabel, listProgress, prefsSummary, todaySummary } from '../state/selectors';
import { createNutriBridge } from '../tg/nutri';

interface Action {
  icon: string;
  title: string;
  subtitle: string;
  onClick: () => void;
}

export function Home() {
  const { state, app, botUsername } = useApp();
  const nav = useNav();
  const nutri = useMemo(() => createNutriBridge(app, botUsername), [app, botUsername]);
  const name = app.initDataUnsafe.user?.first_name ?? 'Invitado';
  const { prefs, menu, list, catalog } = state;

  if (!prefs) {
    return (
      <main className="screen">
        <header className="screen-header">
          <h1>{es.home.welcomeTitle}</h1>
          <p>{es.home.welcome}</p>
        </header>
        <button type="button" className="btn btn-primary inline" onClick={() => nav.push({ name: 'prefs', firstRun: true })}>
          {es.home.start}
        </button>
        <Footnote onOpenChat={nutri.openChat} sync={state.sync} />
      </main>
    );
  }

  const progress = list ? listProgress(list) : null;
  const actions: Action[] = [
    {
      icon: '🗓',
      title: menu ? es.home.viewMenu : es.home.plan,
      subtitle: (menu && catalog && todaySummary(menu, catalog)) || es.home.planHint,
      onClick: () => nav.push({ name: 'menu' }),
    },
    { icon: '🍳', title: es.home.cook, subtitle: es.home.cookHint, onClick: () => nav.push({ name: 'cocinar' }) },
    {
      icon: '🛒',
      title: es.home.list,
      subtitle: progress && progress.total ? es.home.listProgress(progress.done, progress.total) : es.home.listHint,
      onClick: () => nav.push({ name: 'lista' }),
    },
    { icon: '⚙️', title: es.home.prefs, subtitle: prefsSummary(prefs), onClick: () => nav.push({ name: 'prefs' }) },
  ];

  return (
    <main className="screen">
      <header className="screen-header">
        <h1>{es.home.greeting(name)}</h1>
        {menu && <p>{es.home.week(formatWeekLabel(menu.week_start, menu.days))}</p>}
      </header>
      <nav className="action-list" aria-label="Acciones principales">
        {actions.map((a) => (
          <button
            key={a.title}
            type="button"
            className="action"
            onClick={() => {
              app.HapticFeedback.impactOccurred('light');
              a.onClick();
            }}
          >
            <span className="action-icon" aria-hidden="true">
              {a.icon}
            </span>
            <span className="action-text">
              <span className="action-title">{a.title}</span>
              <span className="action-subtitle">{a.subtitle}</span>
            </span>
          </button>
        ))}
      </nav>
      <Footnote onOpenChat={nutri.openChat} sync={state.sync} />
    </main>
  );
}

const SYNC_ICON: Record<string, string> = { local: '📱', syncing: '⏳', synced: '☁️', pending: '⏳', offline: '📡' };

function Footnote({ onOpenChat, sync }: { onOpenChat: () => void; sync: string }) {
  return (
    <p className="footnote">
      {es.app.tagline}{' '}
      <button type="button" className="link" onClick={onOpenChat}>
        {es.app.openChat}
      </button>
      <br />
      <span className="sync-status" data-sync={sync}>
        {SYNC_ICON[sync]} {es.sync[sync]}
      </span>
    </p>
  );
}
