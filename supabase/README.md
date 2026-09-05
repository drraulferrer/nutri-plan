# Supabase · backend de Nutri Plan

Fase 2 (docs/10). La Mini App funciona sin backend; con backend, el estado se sincroniza entre
dispositivos y el menú se genera en el servidor (docs/06).

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
supabase login
supabase link --project-ref <ref>
supabase db push                                   # migrations/0001_init.sql
npm run catalog:sql && supabase db query -f supabase/seed/catalog.sql
supabase secrets set BOT_TOKEN=<token de @BotFather> ALLOWED_ORIGIN=https://drraulferrer.github.io
npm run core:sync && supabase functions deploy api --no-verify-jwt
```

`--no-verify-jwt` porque las peticiones llevan `Authorization: tma <initData>` en lugar de un JWT
de Supabase; la función rechaza todo lo que no valide (`auth.ts`). **El token del bot solo vive en
los secretos de Supabase**: nunca en el repositorio ni en el frontend.

Después, en GitHub: variable de Actions `VITE_API_BASE_URL` =
`https://<ref>.supabase.co/functions/v1/api` para que el build de Pages apunte a la API.

## Actualizaciones

| Qué cambió | Comando |
|---|---|
| Recetas o ingredientes en `data/` | `npm run catalog:sql && supabase db query -f supabase/seed/catalog.sql` |
| `packages/core` | `npm run core:sync && supabase functions deploy api --no-verify-jwt` (CI falla si `_shared` está desincronizado) |
| Rutas de la función | `supabase functions deploy api --no-verify-jwt` |
| Esquema | nueva migración en `migrations/` + `supabase db push` |

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
