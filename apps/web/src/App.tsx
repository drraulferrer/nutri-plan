import { useEffect, useMemo } from 'react';
import { Home } from './screens/Home';
import { applyTheme, bootstrap, getWebApp } from './tg/webapp';

const BOT_USERNAME = import.meta.env.VITE_BOT_USERNAME ?? 'Nutri_RF_Bot';

export function App() {
  const { app } = useMemo(() => getWebApp(), []);

  useEffect(() => {
    bootstrap(app);
    applyTheme(app);
    const onTheme = () => applyTheme(app);
    app.onEvent('themeChanged', onTheme);
    return () => app.offEvent('themeChanged', onTheme);
  }, [app]);

  return <Home app={app} botUsername={BOT_USERNAME} />;
}
