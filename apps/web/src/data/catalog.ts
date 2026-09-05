import { buildCatalog, type Catalog } from '@nutri-plan/core';

async function fetchJson(url: string): Promise<unknown[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo cargar ${url} (${res.status})`);
  const data: unknown = await res.json();
  if (!Array.isArray(data)) throw new Error(`Formato inesperado en ${url}`);
  return data;
}

/** Fase 1: catálogo estático generado en el build desde data/ (docs/04). */
export async function loadCatalog(baseUrl: string = import.meta.env.BASE_URL): Promise<Catalog> {
  const [recipes, ingredients] = await Promise.all([
    fetchJson(`${baseUrl}recipes.json`),
    fetchJson(`${baseUrl}ingredients.json`),
  ]);
  const { catalog, issues } = buildCatalog(
    ingredients,
    recipes.map((data, i) => ({ file: `recipes.json[${i}]`, data })),
  );
  if (issues.length) console.warn('[catalogo] incidencias', issues);
  return catalog;
}
