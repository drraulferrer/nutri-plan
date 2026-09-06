// GENERADO por scripts/sync-core.ts desde packages/core/src — no editar aquí.
import type { Catalog, Ingredient } from './types.ts';

/**
 * Convierte una lista escrita en lenguaje natural (la que Nutri devuelve al analizar la foto de
 * la nevera, o la que el usuario escribe a mano) en slugs del catálogo.
 *
 * Solo se guardan slugs conocidos: el texto libre nunca llega a la base de datos. Lo que no se
 * reconoce se devuelve aparte para enseñárselo al usuario.
 */

export interface PantryMatch {
  slug: string;
  name: string;
  /** Fragmento original que produjo la coincidencia, para poder mostrarlo. */
  raw: string;
}

export interface PantryParseResult {
  matched: PantryMatch[];
  unknown: string[];
}

export const MAX_PANTRY_TEXT = 4000;
const MAX_LINES = 120;

/** Minúsculas, sin acentos, sin emojis ni signos, espacios colapsados. */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s/-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const QUANTITY_WORDS = new Set([
  'medio', 'media', 'medios', 'medias', 'un', 'una', 'unos', 'unas', 'uno',
  'poco', 'poca', 'pocos', 'pocas', 'punado', 'punadito', 'trozo', 'trozos', 'resto', 'restos',
  'bote', 'botes', 'lata', 'latas', 'brick', 'bricks', 'bolsa', 'bolsas', 'paquete', 'paquetes',
  'bandeja', 'bandejas', 'tarrina', 'tarrinas', 'caja', 'cajas', 'docena', 'docenas',
  'pieza', 'piezas', 'unidad', 'unidades', 'racion', 'raciones', 'sobra', 'sobras',
  'abierto', 'abierta', 'abiertos', 'abiertas', 'aprox', 'algo', 'algunos', 'algunas', 'queda', 'quedan',
]);
const UNITS = new Set(['g', 'gr', 'gramos', 'kg', 'kilo', 'kilos', 'ml', 'l', 'litro', 'litros', 'cl']);
const FILLER = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y', 'con', 'en', 'al', 'para', 'casi', 'tienes', 'hay', 'veo', 'tu', 'mi']);

/** Numeración o viñeta al principio de la línea, sin comerse las cantidades ("2 tomates"). */
const BULLET = /^\s*(?:[-–—*+•·]+\s*)*(?:\d+\s*[.)]\s*)?/;

function stripNoise(fragment: string): string {
  const text = normalize(fragment.replace(/\([^)]*\)/g, ' ')); // (1 brick abierto)
  const words = text
    .split(' ')
    .filter(Boolean)
    .filter((w) => !/^\d+([.,/]\d+)?$/.test(w)) // 2, 1/2, 0,5
    .filter((w) => !/^x\d+$/.test(w)) // x4
    .filter((w) => !UNITS.has(w))
    .filter((w) => !QUANTITY_WORDS.has(w));
  const meaningful = words.filter((w) => !FILLER.has(w));
  return (meaningful.length ? meaningful : words).join(' ').trim();
}

/**
 * Formas singulares plausibles de una palabra. Se generan varias porque en español no hay una
 * regla única: "tomates" → "tomate" quitando la s, pero "yogures" → "yogur" quitando "es".
 */
function wordForms(word: string): string[] {
  const forms = new Set([word]);
  if (word.length > 3) {
    if (word.endsWith('ces')) forms.add(`${word.slice(0, -3)}z`);
    if (word.endsWith('es')) forms.add(word.slice(0, -2));
    if (word.endsWith('s')) forms.add(word.slice(0, -1));
  }
  return [...forms];
}

const MAX_PHRASE_WORDS = 4;

/** Combinaciones singular/plural de una frase corta ("2 tomates" ya viene limpio). */
export function phraseForms(text: string): string[] {
  const words = text.split(' ').filter(Boolean);
  if (words.length === 0) return [];
  if (words.length > MAX_PHRASE_WORDS) return [text];
  let combos: string[][] = [[]];
  for (const word of words) {
    combos = combos.flatMap((prefix) => wordForms(word).map((form) => [...prefix, form]));
  }
  return [...new Set(combos.map((c) => c.join(' ')))];
}

interface IndexEntry {
  slug: string;
  name: string;
  /** Formas normalizadas por las que se puede reconocer, de más larga a más corta. */
  keys: string[];
}

function buildIndex(catalog: Catalog): IndexEntry[] {
  return [...catalog.ingredients.values()].map((ing: Ingredient) => {
    const keys = new Set<string>();
    for (const raw of [ing.name, ing.slug.replace(/-/g, ' '), ...ing.aliases]) {
      const n = normalize(raw);
      if (!n) continue;
      for (const form of phraseForms(n)) keys.add(form);
    }
    return { slug: ing.slug, name: ing.name, keys: [...keys].sort((a, b) => b.length - a.length) };
  });
}

/** Posición de `needle` en `haystack` respetando límites de palabra; -1 si no aparece. */
function wordIndexOf(haystack: string, needle: string): number {
  if (!needle) return -1;
  const padded = ` ${haystack} `;
  const at = padded.indexOf(` ${needle} `);
  return at === -1 ? -1 : at;
}

interface Hit {
  entry: IndexEntry;
  at: number;
  length: number;
}

/**
 * Todos los ingredientes que aparecen en un fragmento ("tomates y espinacas" → los dos),
 * quedándose con la coincidencia más larga cuando dos se solapan ("garbanzos cocidos" gana a
 * "garbanzos").
 */
function findIngredients(text: string, index: readonly IndexEntry[]): IndexEntry[] {
  const forms = phraseForms(text);
  const hits: Hit[] = [];
  for (const entry of index) {
    let best: Hit | undefined;
    for (const key of entry.keys) {
      for (const form of forms) {
        const at = wordIndexOf(form, key);
        if (at !== -1 && (!best || key.length > best.length)) best = { entry, at, length: key.length };
        // "atun" reconoce a "Atún en conserva": la clave contiene al fragmento entero.
        if (at === -1 && form.length >= 3 && wordIndexOf(key, form) !== -1 && !best) {
          best = { entry, at: 0, length: form.length };
        }
      }
    }
    if (best) hits.push(best);
  }
  hits.sort((a, b) => b.length - a.length || a.at - b.at);
  const taken: Hit[] = [];
  for (const hit of hits) {
    const overlaps = taken.some((t) => hit.at < t.at + t.length && t.at < hit.at + hit.length);
    if (!overlaps) taken.push(hit);
  }
  return taken.sort((a, b) => a.at - b.at).map((h) => h.entry);
}

/** Divide el texto en fragmentos candidatos: por líneas, viñetas, comas y punto y coma. */
export function splitFragments(text: string): string[] {
  return text
    .slice(0, MAX_PANTRY_TEXT)
    .split(/\r?\n/)
    .flatMap((line) => line.split(/[,;•·]|\s+[-–—]\s+/))
    .map((f) => f.replace(BULLET, '').trim())
    .filter(Boolean)
    .slice(0, MAX_LINES);
}

/** Un fragmento que termina en ":" es un encabezado ("Verduras:", "En tu nevera veo:"). */
const isHeading = (fragment: string): boolean => /:$/.test(fragment.trim());

/**
 * Analiza el texto y devuelve los ingredientes del catálogo reconocidos (sin repetir, en orden de
 * aparición) y los fragmentos que no se han podido identificar.
 */
export function parsePantryText(text: string, catalog: Catalog): PantryParseResult {
  const index = buildIndex(catalog);
  const matched: PantryMatch[] = [];
  const unknown: string[] = [];
  const seen = new Set<string>();

  for (const fragment of splitFragments(text)) {
    if (isHeading(fragment)) continue;
    const cleaned = stripNoise(fragment);
    if (!cleaned) continue;
    const found = findIngredients(cleaned, index);
    if (found.length > 0) {
      for (const entry of found) {
        if (seen.has(entry.slug)) continue;
        seen.add(entry.slug);
        matched.push({ slug: entry.slug, name: entry.name, raw: fragment.trim() });
      }
      continue;
    }
    const label = fragment.trim();
    if (label.length >= 3 && label.length <= 60 && !unknown.includes(label)) unknown.push(label);
  }
  return { matched, unknown };
}

/** Une la despensa existente con lo nuevo, sin duplicados y conservando el orden. */
export function mergePantry(current: readonly string[], added: readonly string[]): string[] {
  return [...new Set([...current, ...added])];
}
