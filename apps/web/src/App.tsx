import { useEffect, useMemo } from 'react';
import { es } from './i18n/es';
import { NavProvider, useNav } from './navigation/NavProvider';
import { Cook } from './screens/Cook';
import { Home } from './screens/Home';
import { Preferences } from './screens/Preferences';
import { Recipe } from './screens/Recipe';
import { ShoppingList } from './screens/ShoppingList';
import { WeekMenu } from './screens/menu/WeekMenu';
import { AppProvider, useApp } from './state/AppProvider';
import { BottomBarProvider } from './tg/BottomBar';
import { applyTheme, bootstrap, getWebApp, startScreenFrom } from './tg/webapp';

const BOT_USERNAME = import.meta.env.VITE_BOT_USERNAME ?? 'Nutri_RF_Bot';

export function App() {
  const { app, isReal } = useMemo(() => getWebApp(), []);

  useEffect(() => {
    bootstrap(app);
    applyTheme(app);
    const onTheme = () => applyTheme(app);
    app.onEvent('themeChanged', onTheme);
    return () => app.offEvent('themeChanged', onTheme);
  }, [app]);

  return (
    <AppProvider app={app} isReal={isReal} botUsername={BOT_USERNAME}>
      <NavProvider app={app} start={startScreenFrom(app.initDataUnsafe.start_param)}>
        <BottomBarProvider app={app} isReal={isReal}>
          <Shell />
        </BottomBarProvider>
      </NavProvider>
    </AppProvider>
  );
}

function Shell() {
  const { state, isReal } = useApp();
  const nav = useNav();

  if (!state.loaded) {
    return (
      <div className="screen skeletons" aria-busy="true" aria-label={es.app.loading}>
        <div className="skeleton" />
        <div className="skeleton" />
        <div className="skeleton" />
      </div>
    );
  }
  if (state.loadError || !state.catalog) {
    return (
      <div className="screen">
        <p role="alert">{es.app.loadError}</p>
      </div>
    );
  }

  return (
    <>
      {!isReal && nav.depth > 1 && (
        <div className="dev-topbar">
          <button type="button" className="link" onClick={nav.pop}>
            ‹ {es.common.back}
          </button>
        </div>
      )}
      <Router />
    </>
  );
}

function Router() {
  const { current } = useNav();
  switch (current.name) {
    case 'inicio':
      return <Home />;
    case 'prefs':
      return <Preferences firstRun={current.firstRun} />;
    case 'menu':
      return <WeekMenu />;
    case 'lista':
      return <ShoppingList />;
    case 'cocinar':
      return <Cook />;
    case 'receta':
      return <Recipe key={current.slug} {...current} />;
  }
}
