import type { TelegramWebApp } from '../tg/types';
import { es } from '../i18n/es';

interface Props {
  app: TelegramWebApp;
  botUsername: string;
}

interface Action {
  icon: string;
  title: string;
  subtitle: string;
}

const ACTIONS: Action[] = [
  { icon: '🗓', title: es.home.plan, subtitle: '7 días · desayuno, comida y cena' },
  { icon: '🍳', title: es.home.cook, subtitle: 'Tres recetas con lo que hay en la nevera' },
  { icon: '🛒', title: es.home.list, subtitle: 'Por categorías, para el súper' },
  { icon: '⚙️', title: es.home.prefs, subtitle: 'Personas, tiempo, alergias, estilo' },
];

export function Home({ app, botUsername }: Props) {
  const name = app.initDataUnsafe.user?.first_name ?? 'Invitado';
  return (
    <main>
      <header className="home-header">
        <h1>{es.home.greeting(name)}</h1>
        <p>{es.home.noPrefs}</p>
      </header>
      <nav className="action-list" aria-label="Acciones principales">
        {ACTIONS.map((a) => (
          <button
            key={a.title}
            type="button"
            className="action"
            onClick={() => app.HapticFeedback.impactOccurred('light')}
          >
            <span className="action-icon" aria-hidden="true">
              {a.icon}
            </span>
            <span>
              <span className="action-title">{a.title}</span>
              <br />
              <span className="action-subtitle">{a.subtitle}</span>
            </span>
          </button>
        ))}
      </nav>
      <p className="footnote">
        {es.app.tagline}{' '}
        <a href={`https://t.me/${botUsername}`} onClick={(e) => { e.preventDefault(); app.openTelegramLink(`https://t.me/${botUsername}`); }}>
          Abrir chat
        </a>
        <br />
        {es.home.phase}
      </p>
    </main>
  );
}
