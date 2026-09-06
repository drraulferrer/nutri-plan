# Supabase · backend de Nutri Plan

Fase 2 (docs/10). La Mini App funciona sin backend; con backend, el estado se sincroniza entre
dispositivos y el menú se genera en el servidor (docs/06).

**Proyecto desplegado (2026-09-06):** `nutri-plan`, ref `qnwdavopytzuwjtnmsfp`, organización
`vulpex-order` (`kkcvtxaliytxcdvacsxc`), región eu-west-1 (Irlanda).
API: `https://qnwdavopytzuwjtnmsfp.supabase.co/functions/v1/api`. La cuenta drraulferrer es
Developer de esa organización, así que la CLI y el conector operan el proyecto con
`--project-ref qnwdavopytzuwjtnmsfp` sin `link`.

## Estructura

```
supabase/
├── migrations/0001_init.sql      # esquema (docs/05, revisado con T-15)
├── seed/catalog.sql              # generado: `npm run catalog:sql` (upserts idempotentes)
└── functions/
    ├── _shared/core/             # GENERADO: `npm run core:sync` copia packages/core/src
    └── api/
        ├── index.ts              # arranque: SupabaseStore + createApp
        ├── routes.ts             # rutas (Hono), autenticación, límites
        ├── auth.ts               # verifyInitData (HMAC-SHA256)
        ├── store.ts              # interfaz de datos
        ├── supabase-store.ts     # implementación PostgreSQL (service_role)
        ├── memory-store.ts       # implementación en memoria para tests
        ├── deno.json             # mapa de imports (hono, zod, supabase-js)
        └── *_test.ts
```

## Puesta en marcha (una vez)

```bash
REF=qnwdavopytzuwjtnmsfp
supabase login
# migración: aplicada con el conector (apply_migration); sin contraseña de BD no se usa `db push`
npm run catalog:sql && supabase db query --linked --project-ref $REF -f supabase/seed/catalog.sql
supabase secrets set --project-ref $REF BOT_TOKEN=<token de @BotFather> ALLOWED_ORIGIN=https://drraulferrer.github.io
npm run core:sync && supabase functions deploy api --project-ref $REF --no-verify-jwt
```

`--no-verify-jwt` porque las peticiones llevan `Authorization: tma <initData>` en lugar de un JWT
de Supabase; la función rechaza todo lo que no valide (`auth.ts`). **El token del bot solo vive en
los secretos de Supabase**: nunca en el repositorio ni en el frontend.

Después, en GitHub: variable de Actions `VITE_API_BASE_URL` =
`https://<ref>.supabase.co/functions/v1/api` para que el build de Pages apunte a la API.

## Actualizaciones

| Qué cambió | Comando |
|---|---|
| Recetas o ingredientes en `data/` | `npm run catalog:sql && supabase db query --linked --project-ref $REF -f supabase/seed/catalog.sql` |
| `packages/core` | `npm run core:sync && supabase functions deploy api --project-ref $REF --no-verify-jwt` (CI falla si `_shared` está desincronizado) |
| Rutas de la función | `supabase functions deploy api --project-ref $REF --no-verify-jwt` |
| Esquema | nueva migración en `migrations/` aplicada con el conector (`apply_migration`) o `supabase db query --linked --project-ref $REF -f …` |

## Pruebas

```bash
npm run api:check    # deno check
npm run api:test     # deno test (auth + rutas con almacén en memoria)
```

Para probar contra la base de datos real con un `initData` auténtico: en Telegram Desktop, abre
la Mini App, inspecciona y copia `Telegram.WebApp.initData` desde la consola (docs/03 §9); luego

```bash
curl -H "Authorization: tma <initData>" https://<ref>.supabase.co/functions/v1/api/me/state
```

## Secretos de la función

| Secreto | Obligatorio | Uso |
|---|---|---|
| `BOT_TOKEN` | Sí | Validar `initData`; sin él toda ruta `/me/*` responde 401 y la app queda en modo local |
| `ALLOWED_ORIGIN` | No (por defecto `https://drraulferrer.github.io`) | CORS, coma-separado |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | No | Fase 3: menús con IA; sin clave, solo reglas |
| `BOT_SHARED_SECRET` | No | Fase 4: habilita `/bot/*` para el agente de Nutri (docs/13) |

Tras cambiar secretos no hace falta redesplegar: la función los lee en cada arranque.
