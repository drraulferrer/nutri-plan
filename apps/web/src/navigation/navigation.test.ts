import { describe, expect, it } from 'vitest';
import { initialStack, navReducer } from './navigation';

describe('navegación', () => {
  it('start_param abre la pantalla con Inicio debajo', () => {
    expect(initialStack('lista').map((s) => s.name)).toEqual(['inicio', 'lista']);
    expect(initialStack('inicio').map((s) => s.name)).toEqual(['inicio']);
  });
  it('despensa abre Cocinar con la hoja de pegar lista', () => {
    const stack = initialStack('despensa');
    expect(stack.map((s) => s.name)).toEqual(['inicio', 'cocinar']);
    expect(stack[1]).toEqual({ name: 'cocinar', paste: true });
  });
  it('pop nunca vacía la pila', () => {
    expect(navReducer([{ name: 'inicio' }], { type: 'pop' })).toEqual([{ name: 'inicio' }]);
    expect(navReducer([{ name: 'inicio' }, { name: 'menu' }], { type: 'pop' })).toEqual([{ name: 'inicio' }]);
  });
  it('push, replace y reset', () => {
    const s1 = navReducer([{ name: 'inicio' }], { type: 'push', screen: { name: 'menu' } });
    const s2 = navReducer(s1, { type: 'replace', screen: { name: 'lista' } });
    expect(s2.map((s) => s.name)).toEqual(['inicio', 'lista']);
    expect(navReducer(s2, { type: 'reset', screen: { name: 'cocinar' } })).toEqual([{ name: 'cocinar' }]);
  });
});
