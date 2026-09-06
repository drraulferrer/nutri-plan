import { afterEach, describe, expect, it } from 'vitest';
import { applyTheme, getWebApp, startScreenFrom } from './webapp';
import { createMockWebApp } from './mock';

describe('getWebApp', () => {
  afterEach(() => {
    delete window.Telegram;
  });
  it('usa la simulación cuando no hay SDK', () => {
    const { app, isReal } = getWebApp();
    expect(isReal).toBe(false);
    expect(app.platform).toBe('web-mock');
  });
  it('usa la simulación cuando el SDK existe pero no hay initData (abierto en navegador)', () => {
    window.Telegram = { WebApp: { ...createMockWebApp(), initData: '', platform: 'weba' } };
    expect(getWebApp().isReal).toBe(false);
  });
  it('usa el SDK real cuando hay initData', () => {
    window.Telegram = { WebApp: { ...createMockWebApp(), initData: 'user=%7B%22id%22%3A1%7D&hash=abc', platform: 'ios' } };
    const { app, isReal } = getWebApp();
    expect(isReal).toBe(true);
    expect(app.platform).toBe('ios');
  });
});

describe('applyTheme', () => {
  it('escribe las variables --tg-theme-* y el esquema', () => {
    const root = document.createElement('div');
    applyTheme(createMockWebApp(true), root);
    expect(root.style.getPropertyValue('--tg-theme-bg-color')).toBe('#212121');
    expect(root.style.getPropertyValue('--tg-theme-bottom-bar-bg-color')).toBe('#181818');
    expect(root.dataset['tgScheme']).toBe('dark');
  });
});

describe('startScreenFrom', () => {
  it('acepta solo los valores documentados', () => {
    expect(startScreenFrom('lista')).toBe('lista');
    expect(startScreenFrom('menu')).toBe('menu');
    expect(startScreenFrom('cocinar')).toBe('cocinar');
    expect(startScreenFrom('despensa')).toBe('despensa');
    expect(startScreenFrom('otra-cosa')).toBe('inicio');
    expect(startScreenFrom(undefined)).toBe('inicio');
  });
});

describe('CloudStorage simulado', () => {
  it('persiste en localStorage', () => {
    const app = createMockWebApp();
    app.CloudStorage.setItem('prefs', '{"people":2}');
    app.CloudStorage.getItem('prefs', (_err, value) => expect(value).toBe('{"people":2}'));
    app.CloudStorage.removeItem('prefs');
    app.CloudStorage.getItem('prefs', (_err, value) => expect(value).toBe(''));
  });
});
