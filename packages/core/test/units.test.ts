import { describe, expect, it } from 'vitest';
import { ceilToStep, formatQuantity, roundForDisplay, toCanonical } from '../src/units';
import { CATALOG } from './fixtures';

const ing = (slug: string) => CATALOG.ingredients.get(slug)!;

describe('toCanonical', () => {
  it('convierte kg y l a g y ml', () => {
    expect(toCanonical(1.5, 'kg', ing('arroz'))).toEqual({ quantity: 1500, unit: 'g' });
    expect(toCanonical(0.5, 'l', ing('leche'))).toEqual({ quantity: 500, unit: 'ml' });
  });
  it('convierte cucharadas a ml o g según el ingrediente', () => {
    expect(toCanonical(2, 'cda', ing('aceite-oliva'))).toEqual({ quantity: 30, unit: 'ml' });
    expect(toCanonical(1, 'cdta', ing('sal'))).toEqual({ quantity: 5, unit: 'g' });
  });
  it('convierte piezas a gramos con grams_per_unit cuando el ingrediente se compra en g', () => {
    expect(toCanonical(2, 'ud', ing('lentejas'))).toEqual({ quantity: 2, unit: 'g' });
    expect(toCanonical(1, 'diente', ing('ajo'))).toEqual({ quantity: 1, unit: 'ud' });
  });
  it('convierte gramos a piezas cuando el ingrediente se compra por unidad', () => {
    expect(toCanonical(300, 'g', ing('tomate'))).toEqual({ quantity: 2, unit: 'ud' });
  });
  it('convierte envases (lata) a la unidad canónica por package_size', () => {
    expect(toCanonical(2, 'lata', ing('atun'))).toEqual({ quantity: 160, unit: 'g' });
  });
  it('conserva la cantidad si no hay factor conocido', () => {
    expect(toCanonical(3, 'g', ing('platano'))).toEqual({ quantity: 3, unit: 'ud' });
  });
});

describe('ceilToStep', () => {
  it('redondea hacia arriba por tramos', () => {
    expect(ceilToStep(43, 'g')).toBe(45);
    expect(ceilToStep(101, 'g')).toBe(110);
    expect(ceilToStep(1001, 'ml')).toBe(1050);
    expect(ceilToStep(2.2, 'ud')).toBe(3);
    expect(ceilToStep(1, 'g')).toBe(5);
  });
});

describe('roundForDisplay', () => {
  it('sigue las reglas de docs/09 §A', () => {
    expect(roundForDisplay(47, 'g')).toBe(45);
    expect(roundForDisplay(233, 'ml')).toBe(230);
    expect(roundForDisplay(1520, 'g')).toBe(1500);
    expect(roundForDisplay(0.75, 'ud', ing('huevos'))).toBe(1);
    expect(roundForDisplay(0.75, 'ud', ing('tomate'))).toBe(1);
    expect(roundForDisplay(1.2, 'ud', ing('tomate'))).toBe(1);
    expect(roundForDisplay(3, 'pizca')).toBe(2);
    expect(roundForDisplay(1.3, 'cda')).toBe(1.5);
    expect(roundForDisplay(1.2, 'diente')).toBe(2);
    expect(roundForDisplay(1.234, 'lata')).toBe(1.23);
  });
});

describe('formatQuantity', () => {
  it('usa coma decimal', () => {
    expect(formatQuantity(1.5, 'ud')).toBe('1,5 ud');
    expect(formatQuantity(200, 'g')).toBe('200 g');
  });
});
