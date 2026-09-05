import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { BottomButton, TelegramWebApp } from './types';

export interface ButtonConfig {
  text: string;
  onClick: () => void;
  disabled?: boolean;
  progress?: boolean;
}

interface BarState {
  main: ButtonConfig | null;
  secondary: ButtonConfig | null;
}

interface BarContextValue {
  setMain: (cfg: ButtonConfig | null) => void;
  setSecondary: (cfg: ButtonConfig | null) => void;
}

const BarContext = createContext<BarContextValue | null>(null);

function syncButton(button: BottomButton | undefined, cfg: ButtonConfig | null): void {
  if (!button) return;
  if (!cfg) {
    button.hide();
    return;
  }
  button.setText(cfg.text);
  if (cfg.disabled) button.disable();
  else button.enable();
  if (cfg.progress) button.showProgress(false);
  else button.hideProgress();
  button.show();
}

interface Props {
  app: TelegramWebApp;
  isReal: boolean;
  children: ReactNode;
}

/**
 * Botones inferiores nativos de Telegram (MainButton/SecondaryButton) con una barra dibujada en
 * pantalla cuando no hay SDK real o cuando el cliente no soporta SecondaryButton (docs/03 §1).
 */
export function BottomBarProvider({ app, isReal, children }: Props) {
  const [bar, setBar] = useState<BarState>({ main: null, secondary: null });
  const latest = useRef(bar);
  latest.current = bar;

  const hasSecondary = isReal && Boolean(app.SecondaryButton) && app.isVersionAtLeast('7.10');

  useEffect(() => {
    if (!isReal) return;
    const onMain = () => latest.current.main?.onClick();
    const onSecondary = () => latest.current.secondary?.onClick();
    app.MainButton.onClick(onMain);
    app.SecondaryButton?.onClick(onSecondary);
    return () => {
      app.MainButton.offClick(onMain);
      app.SecondaryButton?.offClick(onSecondary);
    };
  }, [app, isReal]);

  useEffect(() => {
    if (!isReal) return;
    syncButton(app.MainButton, bar.main);
    if (hasSecondary) syncButton(app.SecondaryButton, bar.secondary);
  }, [app, isReal, hasSecondary, bar]);

  const value = useMemo<BarContextValue>(
    () => ({
      setMain: (main) => setBar((b) => ({ ...b, main })),
      setSecondary: (secondary) => setBar((b) => ({ ...b, secondary })),
    }),
    [],
  );

  const drawMain = !isReal && bar.main;
  const drawSecondary = !hasSecondary && bar.secondary;

  return (
    <BarContext.Provider value={value}>
      {children}
      {(drawMain || drawSecondary) && (
        <div className="dev-bottom-bar" data-testid="bottom-bar">
          {drawSecondary && (
            <button type="button" className="btn btn-secondary" onClick={bar.secondary!.onClick} disabled={bar.secondary!.disabled}>
              {bar.secondary!.text}
            </button>
          )}
          {drawMain && (
            <button type="button" className="btn btn-primary" onClick={bar.main!.onClick} disabled={bar.main!.disabled || bar.main!.progress}>
              {bar.main!.progress ? '…' : bar.main!.text}
            </button>
          )}
        </div>
      )}
    </BarContext.Provider>
  );
}

/** Declara los botones inferiores de la pantalla actual; se retiran al desmontar. */
export function useBottomButtons(main: ButtonConfig | null, secondary: ButtonConfig | null = null): void {
  const ctx = useContext(BarContext);
  if (!ctx) throw new Error('useBottomButtons debe usarse dentro de BottomBarProvider');
  const mainRef = useRef(main);
  const secRef = useRef(secondary);
  mainRef.current = main;
  secRef.current = secondary;
  const mainKey = main ? `${main.text}|${main.disabled ? 1 : 0}|${main.progress ? 1 : 0}` : '';
  const secKey = secondary ? `${secondary.text}|${secondary.disabled ? 1 : 0}` : '';

  useEffect(() => {
    ctx.setMain(main ? { ...main, onClick: () => mainRef.current?.onClick() } : null);
    ctx.setSecondary(secondary ? { ...secondary, onClick: () => secRef.current?.onClick() } : null);
    // Las claves resumen texto/estado; los manejadores se leen de las refs para no re-registrar en cada render.
  }, [ctx, mainKey, secKey]);

  useEffect(
    () => () => {
      ctx.setMain(null);
      ctx.setSecondary(null);
    },
    [ctx],
  );
}
