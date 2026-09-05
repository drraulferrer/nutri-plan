import { describe, expect, it } from 'vitest';
import { detectSafetyFlags, normalizeText } from '../src/safety';

describe('detectSafetyFlags', () => {
  it.each([
    ['estoy embarazada de 5 meses', 'embarazo'],
    ['Embarazo', 'embarazo'],
    ['en periodo de lactancia', 'embarazo'],
    ['tengo diabetes tipo 2', 'diabetes'],
    ['soy diabético', 'diabetes'],
    ['me pincho insulina', 'diabetes'],
    ['insuficiencia renal crónica', 'renal'],
    ['problemas de riñón', 'renal'],
    ['estoy en diálisis', 'renal'],
    ['he tenido anorexia', 'tca'],
    ['TCA en tratamiento', 'tca'],
    ['atracones por la noche', 'tca'],
    ['soy celíaca', 'otro_clinico'],
    ['tengo el colesterol alto', 'otro_clinico'],
  ])('detecta «%s» → %s', (text, flag) => {
    expect(detectSafetyFlags(text)).toContain(flag);
  });

  it('funciona dentro de frases largas y con acentos o sin ellos', () => {
    const text = 'No me gusta el brócoli y, por cierto, mi médico dice que tengo DIABETES gestacional';
    expect(detectSafetyFlags(text)).toEqual(['embarazo', 'diabetes']);
  });

  it('no dispara con texto neutro', () => {
    expect(detectSafetyFlags('no me gusta el azúcar ni la cebolla cruda')).toEqual([]);
    expect(detectSafetyFlags('')).toEqual([]);
    expect(detectSafetyFlags(undefined)).toEqual([]);
  });

  it('normaliza acentos y mayúsculas', () => {
    expect(normalizeText('  Riñón   CRÓNICO ')).toBe('rinon cronico');
  });
});
