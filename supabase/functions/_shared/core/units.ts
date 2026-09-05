// GENERADO por scripts/sync-core.ts desde packages/core/src — no editar aquí.
import type { CanonicalUnit, Ingredient, Unit } from './types.ts';

const VOLUME_ML: Partial<Record<Unit, number>> = { l: 1000, ml: 1, cda: 15, cdta: 5, taza: 240 };
const MASS_G: Partial<Record<Unit, number>> = { kg: 1000, g: 1, pizca: 0.5 };
const PIECE_UNITS: ReadonlySet<Unit> = new Set(['ud', 'manojo', 'diente', 'rebanada']);
const PACKAGE_UNITS: ReadonlySet<Unit> = new Set(['lata', 'bote', 'brick', 'paquete']);

export interface CanonicalQuantity {
  quantity: number;
  unit: CanonicalUnit;
}

/**
 * Convierte una cantidad de receta a la unidad canónica del ingrediente (g | ml | ud).
 * Entre masa y volumen se asume densidad 1 (aproximación documentada en docs/05).
 * Entre piezas y masa se usa `grams_per_unit`; si falta, se conserva la unidad de origen.
 */
export function toCanonical(quantity: number, unit: Unit, ingredient: Ingredient): CanonicalQuantity {
  const target = ingredient.default_unit;
  if (PACKAGE_UNITS.has(unit)) {
    const size = ingredient.package_size ?? 1;
    return { quantity: quantity * size, unit: target };
  }
  const asPieces = PIECE_UNITS.has(unit) ? quantity : undefined;
  const asMl = VOLUME_ML[unit] !== undefined ? quantity * (VOLUME_ML[unit] as number) : undefined;
  const asG = MASS_G[unit] !== undefined ? quantity * (MASS_G[unit] as number) : undefined;

  if (target === 'ud') {
    if (asPieces !== undefined) return { quantity: asPieces, unit: 'ud' };
    const grams = asG ?? asMl;
    if (grams !== undefined && ingredient.grams_per_unit) {
      return { quantity: grams / ingredient.grams_per_unit, unit: 'ud' };
    }
    return { quantity, unit: 'ud' };
  }
  if (asPieces !== undefined) {
    const grams = ingredient.grams_per_unit ? asPieces * ingredient.grams_per_unit : asPieces;
    return { quantity: grams, unit: target };
  }
  const amount = asG ?? asMl ?? quantity;
  return { quantity: amount, unit: target };
}

/** Redondeo hacia arriba en pasos razonables para cantidades de compra sin envase. */
export function ceilToStep(quantity: number, unit: CanonicalUnit): number {
  if (unit === 'ud') return Math.ceil(quantity);
  const step = quantity < 100 ? 5 : quantity < 1000 ? 10 : 50;
  return Math.max(step, Math.ceil(quantity / step) * step);
}

/** Redondeo para mostrar cantidades en la ficha de receta (docs/09 §A). */
export function roundForDisplay(quantity: number, unit: Unit, ingredient?: Ingredient): number {
  if (unit === 'g' || unit === 'ml') {
    const step = quantity < 100 ? 5 : quantity < 1000 ? 10 : 50;
    return Math.max(step, Math.round(quantity / step) * step);
  }
  if (unit === 'pizca') return Math.min(2, Math.ceil(quantity));
  if (unit === 'cda' || unit === 'cdta' || unit === 'taza') return Math.round(quantity * 2) / 2;
  if (unit === 'ud') {
    if (ingredient?.indivisible) return Math.ceil(quantity);
    return Math.max(0.5, Math.round(quantity * 2) / 2);
  }
  if (PIECE_UNITS.has(unit)) return Math.ceil(quantity);
  return Math.round(quantity * 100) / 100;
}

export function formatQuantity(quantity: number, unit: Unit): string {
  const n = Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(1).replace('.', ',');
  return `${n} ${unit}`;
}
