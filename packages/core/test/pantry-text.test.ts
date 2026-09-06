import { describe, expect, it } from 'vitest';
import { mergePantry, normalize, parsePantryText, phraseForms, splitFragments } from '../src/pantry-text';
import { CATALOG } from './fixtures';

const slugs = (text: string) => parsePantryText(text, CATALOG).matched.map((m) => m.slug);

describe('parsePantryText', () => {
  it('lee la lista que devuelve Nutri al analizar una foto de la nevera', () => {
    const text = `🧊 En tu nevera veo:
- 6 huevos
- Leche (1 brick abierto)
- 2 tomates
- Medio calabacín
- Queso curado
- Un puñado de espinacas
- Yogures naturales x4`;
    const { matched, unknown } = parsePantryText(text, CATALOG);
    expect(matched.map((m) => m.slug)).toEqual(['huevos', 'leche', 'tomate', 'calabacin', 'queso', 'espinacas', 'yogur']);
    expect(unknown).toEqual([]);
    expect(matched[0]!.raw).toBe('6 huevos');
    expect(matched[0]!.name).toBe('Huevos');
  });

  it('acepta listas separadas por comas y en una sola línea', () => {
    expect(slugs('Tienes: huevos, leche, 2 tomates y espinacas')).toEqual(['huevos', 'leche', 'tomate', 'espinacas']);
  });

  it('reconoce alias, plurales y acentos indistintamente', () => {
    expect(slugs('zucchini')).toEqual(['calabacin']);
    expect(slugs('Calabacines')).toEqual(['calabacin']);
    expect(slugs('platanos')).toEqual(['platano']);
    expect(slugs('Plátano')).toEqual(['platano']);
  });

  it('quita cantidades, unidades y envases', () => {
    expect(slugs('500 g de arroz')).toEqual(['arroz']);
    expect(slugs('1 bote de garbanzos cocidos')).toEqual(['garbanzos-cocidos']);
    expect(slugs('2 latas de atún')).toEqual(['atun']);
    expect(slugs('1,5 kg de patatas')).toEqual(['patata']);
  });

  it('ignora encabezados y no repite ingredientes', () => {
    const { matched, unknown } = parsePantryText('Verduras:\n- tomate\n- tomates\nProteínas:\n- huevos', CATALOG);
    expect(matched.map((m) => m.slug)).toEqual(['tomate', 'huevos']);
    expect(unknown).toEqual([]);
  });

  it('devuelve aparte lo que no está en el catálogo', () => {
    const { matched, unknown } = parsePantryText('- huevos\n- salsa teriyaki\n- kimchi', CATALOG);
    expect(matched.map((m) => m.slug)).toEqual(['huevos']);
    expect(unknown).toEqual(['salsa teriyaki', 'kimchi']);
  });

  it('no se atraganta con texto vacío, largo o raro', () => {
    expect(parsePantryText('', CATALOG)).toEqual({ matched: [], unknown: [] });
    expect(parsePantryText('   \n\n  ', CATALOG).matched).toEqual([]);
    const long = parsePantryText('huevos\n'.repeat(500), CATALOG);
    expect(long.matched).toEqual([{ slug: 'huevos', name: 'Huevos', raw: 'huevos' }]);
  });

  it('splitFragments limpia viñetas, números y símbolos', () => {
    expect(splitFragments('1. huevos\n• leche\n  - 2 tomates')).toEqual(['huevos', 'leche', '2 tomates']);
  });

  it('normalize quita emojis y acentos', () => {
    expect(normalize('🥚 Huevos frescos!')).toBe('huevos frescos');
  });

  it('phraseForms cubre los dos plurales del español', () => {
    expect(phraseForms('tomates')).toContain('tomate');
    expect(phraseForms('yogures')).toContain('yogur');
    expect(phraseForms('nueces')).toContain('nuez');
  });

  it('reconoce varios ingredientes en una misma línea y prefiere el nombre más largo', () => {
    expect(slugs('tomates y espinacas')).toEqual(['tomate', 'espinacas']);
    expect(slugs('un bote de garbanzos cocidos')).toEqual(['garbanzos-cocidos']);
  });
});

describe('mergePantry', () => {
  it('une sin duplicar y conserva el orden', () => {
    expect(mergePantry(['arroz', 'huevos'], ['huevos', 'tomate'])).toEqual(['arroz', 'huevos', 'tomate']);
    expect(mergePantry([], [])).toEqual([]);
  });
});
