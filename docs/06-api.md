# 06 · Contrato de API

Base: `https://<ref>.supabase.co/functions/v1/api`. JSON en ambos sentidos. Todas las rutas de
usuario exigen `Authorization: tma <initData>` (doc 03 §4). Las rutas `/bot/*` exigen
`X-Bot-Secret`. El catálogo es público.

## Envoltorio de respuesta

```json
{ "ok": true,  "data": { … }, "meta": { "generated_at": "…" } }
{ "ok": false, "error": { "code": "unauthorized", "message": "Abre Nutri Plan desde Telegram" } }
```

Códigos de error: `unauthorized` (401), `expired` (401), `forbidden` (403), `not_found` (404),
`validation` (422, con `details` de Zod), `rate_limited` (429, con `retry_after`),
`safety_redirect` (200 con `data.redirect = true`, ver doc 08), `upstream` (502, IA),
`internal` (500).

## Usuario

| Método y ruta | Cuerpo | Respuesta | Notas |
|---|---|---|---|
| `POST /session` | — | `{ profile: {id, created_at}, preferences, has_menu, start_param }` | Upsert del perfil; actualiza `last_seen_at`. Primera llamada al abrir. |
| `DELETE /me` | — | `{ deleted: true }` | Borra todo (RF, doc 12). |

## Preferencias

| Método y ruta | Cuerpo | Respuesta |
|---|---|---|
| `GET /preferences` | — | `Preferences` |
| `PUT /preferences` | `Preferences` (Zod) | `Preferences` + `safety_flags[]` |

```ts
type Preferences = {
  people: 1|2|3|4|5|6|7|8; days: 5|7; include_snacks: boolean;
  cook_time: '15'|'30'|'45'|'60+'; budget: 'ajustado'|'medio'|'flexible';
  styles: DietStyle[]; allergens: Allergen[]; allergens_confirmed: boolean;
  disliked_ingredient_ids: string[]; other_restrictions?: string;
};
```

Regla: si `allergens.length > 0 && !allergens_confirmed` → 422 `allergens_unconfirmed`.

## Catálogo (público, cacheable)

| Método y ruta | Parámetros | Respuesta |
|---|---|---|
| `GET /recipes` | `?meal=cena&style=vegetariano&max_time=30&tag=rapida` | `RecipeSummary[]` |
| `GET /recipes/:slug` | — | `Recipe` con ingredientes (base 2 raciones) y sustituciones |
| `GET /ingredients` | `?q=cala` (autocompletado, ≥ 2 letras, busca en `name` y `aliases`) | `IngredientSummary[]` (máx. 20) |

Cabeceras: `Cache-Control: public, max-age=3600`, `ETag`.

## Menús

| Método y ruta | Cuerpo | Respuesta | Notas |
|---|---|---|---|
| `GET /menus/current` | — | `Menu` (con `slots[]`, cada uno con `recipe` resumida y `alternatives[]`) o 404 | Semana en curso o siguiente según D-06. |
| `GET /menus?limit=4` | — | `MenuSummary[]` | Historial. |
| `POST /menus/generate` | `{ week_start?: 'YYYY-MM-DD', seed?: string, source?: 'reglas'|'ia' }` | `{ menu: Menu, shopping_list: ShoppingList, warnings[] }` | Usa preferencias guardadas. Límite 10/min. Si hay `safety_flags`, responde igualmente pero con `data.redirect_notice`. |
| `POST /menus/:id/regenerate` | `{ scope: 'week' }` \| `{ scope: 'day', day_index }` \| `{ scope: 'slot', slot_id, exclude_recipe_ids?: string[] }` | `{ menu, shopping_list, changed_slot_ids[] }` | Respeta `is_locked`. Recalcula la lista conservando `checked`/`have_it` de los ítems que siguen. |
| `PATCH /menus/:id/slots/:slot_id` | `{ recipe_id?: string \| null, is_locked?: boolean, servings?: number }` | `{ slot, shopping_list_delta }` | `recipe_id: null` = comer fuera. `recipe_id` debe estar en `alternatives` o pasar las restricciones duras. |
| `PATCH /menus/:id` | `{ week_start }` | `Menu` | Cambiar fecha de inicio. |

## Lista de compra

| Método y ruta | Cuerpo | Respuesta | Notas |
|---|---|---|---|
| `GET /shopping-list/current` | — | `ShoppingList` (`items[]` agrupados por `category`, `staples[]`, `have_it[]`) | Incluye `text` ya renderizado (plantilla L1) para compartir/copiar. |
| `PATCH /shopping-list/:id/items/:item_id` | `{ checked?: boolean, have_it?: boolean }` | `ShoppingItem` | `have_it: true` añade a `pantry_items`. |
| `POST /shopping-list/:id/recompute` | `{ people: number }` | `ShoppingList` | RF-24. Conserva marcas. |
| `POST /shopping-list/:id/sync` | `{ changes: [{ item_id, checked?, have_it?, at }] }` | `ShoppingList` | Cola offline (RF-27). Última escritura gana por `at`. |

## Cocinar con lo que tengo

| Método y ruta | Cuerpo | Respuesta |
|---|---|---|
| `POST /recipes/match` | `{ ingredient_ids: string[] (2–40), filters?: { max_time?: number, style?: DietStyle, meal?: MealType }, limit?: 3 }` | `{ results: [{ recipe: RecipeSummary, coverage: 0.87, missing: [{ingredient, substitutable_with?}], label: 'tienes_todo' \| 'faltan_n' \| 'rapida', label_text: 'Faltan 2 ingredientes' }] }` |
| `GET /pantry` | — | `PantryItem[]` |
| `PUT /pantry` | `{ items: [{ ingredient_id, quantity?, unit?, expires_on? }] }` | `PantryItem[]` (reemplaza) |
| `POST /menus/:id/slots/:slot_id/assign` | `{ recipe_id }` | igual que `PATCH slot` | RF-35 desde pantalla E. |

Las restricciones duras del usuario (alérgenos, estilo, no gusta) se aplican también al matcher;
las recetas excluidas no aparecen aunque cubran los ingredientes.

## Favoritos y eventos

| Método y ruta | Cuerpo | Respuesta |
|---|---|---|
| `PUT /favorites/:recipe_id` / `DELETE /favorites/:recipe_id` | — | `{ favorites: string[] }` |
| `POST /events` | `{ screen, action }` | `204` |

## Bot (Fase 4) — `X-Bot-Secret`

| Método y ruta | Respuesta | Uso por Nutri |
|---|---|---|
| `GET /bot/context/:telegram_user_id` | `{ preferences, menu_current: {…compacto, por día}, shopping_summary: {total, checked}, pantry: string[] }` | Antes de responder a un mensaje con `[NP …]` o que hable de "mi menú". Máx. 2 kB. |
| `GET /bot/menus/:menu_id/slots/:slot_id` | `{ slot, recipe, alternatives }` | Resolver la referencia de M1. |
| `POST /bot/menus/:menu_id/slots/:slot_id` | cuerpo `{ recipe_slug }` → `{ slot, shopping_list_delta }` | Aplicar el cambio que el usuario acordó con Nutri. Solo recetas del catálogo. |
| `GET /bot/recipes/:slug` | `Recipe` | Explicar o adaptar una receta. |

Sin `X-Bot-Secret` correcto → 403 sin detalle. Registro de cada llamada con `telegram_user_id`
hasheado.

## Versionado

Prefijo implícito v1. Cambios incompatibles → `/v2/...`. El cliente envía `X-Client-Version`
(hash del build) para detectar clientes antiguos en los logs.
