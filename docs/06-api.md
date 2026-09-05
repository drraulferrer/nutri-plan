# 06 · Contrato de API

Base: `https://<ref>.supabase.co/functions/v1/api`. JSON en ambos sentidos. Todas las rutas
`/me/*` exigen `Authorization: tma <initData>` (doc 03 §4) y se validan en cada petición. El
catálogo es público. Implementación: `supabase/functions/api/routes.ts`.

## Envoltorio de respuesta

```json
{ "ok": true,  "data": { … } }
{ "ok": false, "error": { "code": "unauthorized", "message": "Abre Nutri Plan desde Telegram" } }
```

| Código | HTTP | Cuándo |
|---|---|---|
| `unauthorized` | 401 | Sin cabecera, hash inválido, sin `user` |
| `expired` | 401 | `auth_date` de hace más de 24 h → la app pide reabrir |
| `no_preferences` | 422 | Generar menú sin preferencias guardadas |
| `validation` | 422 | Cuerpo no válido; `details` con las primeras incidencias de Zod |
| `rate_limited` | 429 | `retry_after` en segundos |
| `not_found` | 404 | |
| `internal` | 500 | Sin detalle al cliente; detalle en logs |

Límites: 60 peticiones/min por usuario en `/me/*`; 10/min en `/me/menus/generate`.

## Modelo: el estado del usuario como documento

Fase 2 (decisión T-15, doc 00): la lógica vive en `packages/core` y se ejecuta igual en el
navegador y en la Edge Function, así que la API intercambia **los mismos objetos** que calcula
`core` en lugar de filas normalizadas.

```ts
type State = {
  preferences: Preferences | null;   // core, validado con PreferencesSchema
  menu: Menu | null;                 // core, MenuSchema
  shopping_list: ShoppingList | null;// core, ShoppingListSchema
  pantry: string[];                  // slugs de ingredientes
  favorites: string[];               // slugs de recetas
  updated_at: string | null;
};
```

## Rutas públicas

| Método y ruta | Respuesta |
|---|---|
| `GET /health` | `{ service, phase }` |
| `GET /catalog` | `{ recipes: Recipe[], ingredients: Ingredient[] }` desde la base de datos. `Cache-Control: public, max-age=3600`. La app usa el JSON estático publicado con el build; esta ruta es para el bot y la IA. |

## Rutas de usuario (`tma`)

| Método y ruta | Cuerpo | Respuesta | Notas |
|---|---|---|---|
| `POST /me/session` | — | `{ profile: {id}, start_param, state: State }` | Crea o actualiza el perfil (`last_seen_at`). Primera llamada al abrir. |
| `GET /me/state` | — | `State` | |
| `PUT /me/state` | `Partial<State>` sin `updated_at` (`menu`/`shopping_list` admiten `null`) | `State` | Última escritura gana. Rechaza `allergens` sin `allergens_confirmed`. Calcula `safety_flags` en el servidor. |
| `POST /me/menus/generate` | `{ week_start?, seed? }` | `State` | Planificador de `core` con el catálogo de la base de datos y las preferencias guardadas; también construye la lista. Determinista con la misma `seed`. |
| `POST /me/events` | `{ screen, action }` | `204` | Solo contadores; sin contenido. |
| `DELETE /me` | — | `{ deleted: true }` | Borrado físico en cascada (doc 12). |

## Sincronización en la app (decisión T-16)

1. Al abrir: carga local (caché) → `POST /me/session`. Si el servidor tiene datos, manda; si está
   vacío y el dispositivo tiene datos de la Fase 1, se suben.
2. Cada cambio se sube con `PUT /me/state` tras 0,8 s de inactividad. Si falla por red, el estado
   pasa a `offline`/`pending` y se reintenta al recuperar la conexión y cada 30 s.
3. `401` ⇒ modo `local` (solo este dispositivo). La app sigue funcionando entera.
4. Generar menú usa el servidor si hay sesión; si no, el planificador local. El resultado es el
   mismo porque el código es el mismo.

## Previsto (no implementado aún)

- **Fase 3:** `POST /me/menus/generate { source: 'ia' }` con validación del JSON de la IA
  contra `MenuSchema` y respaldo en reglas (doc 08).
- **Fase 4:** `/bot/*` con `X-Bot-Secret`: `GET /bot/context/:telegram_user_id`,
  `POST /bot/menus/current/slots/:day/:meal`, `GET /bot/recipes/:slug`.
- Cola de cambios por ítem (`POST /shopping-list/sync`) si "última escritura gana" resulta
  insuficiente con varios dispositivos a la vez.

## Versionado

Prefijo implícito v1. Cambios incompatibles → `/v2/...`. El cliente envía `X-Client-Version`
(hash corto del commit) para detectar clientes antiguos en los logs.
