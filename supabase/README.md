# Supabase · backend de Nutri Plan

Se activa en la **Fase 2** (docs/10). Hasta entonces la Mini App funciona sin backend.

## Puesta en marcha

```bash
supabase login
supabase init                       # genera config.toml (elige región eu-west)
supabase link --project-ref <ref>
supabase db push                    # aplica migrations/0001_init.sql
supabase secrets set BOT_TOKEN=... ALLOWED_ORIGIN=https://drraulferrer.github.io
supabase functions deploy api --no-verify-jwt
```

`--no-verify-jwt` porque las peticiones llevan `Authorization: tma <initData>` en lugar de un
JWT de Supabase; la función rechaza todo lo que no valide (`functions/api/auth.ts`).

## Pruebas locales

```bash
deno test --allow-env supabase/functions/api      # vectores de initData con token ficticio
supabase functions serve api --env-file .env.local
```

Para probar con un `initData` real: en Telegram Desktop, abre la Mini App, inspecciona y copia
`Telegram.WebApp.initData` desde la consola (docs/03 §9).
