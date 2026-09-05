# 04 · Arquitectura

## Visión general

```
┌────────────────────────── Telegram (cliente) ───────────────────────────┐
│  Chat con @Nutri_RF_Bot  ◀──── openTelegramLink(?text=) ────  Mini App │
│  (Nutri / agente IA)                                          (webview)│
└──────────┬───────────────────────────────────────────────────┬─────────┘
           │ Bot API                                            │ HTTPS
           │ (fase 4: herramientas HTTP)                        │ Authorization: tma <initData>
           ▼                                                    ▼
┌─────────────────────┐                     ┌──────────────────────────────────┐
│ Backend del bot     │  X-Bot-Secret       │ Supabase                         │
│ (ya existe)         │────────────────────▶│  Edge Function `api` (Deno+Hono) │
└─────────────────────┘                     │   ├─ auth: verifyInitData        │
                                            │   ├─ core: packages/core         │
                                            │   └─ db: service role            │
                                            │  PostgreSQL (RLS: sin acceso anon)│
                                            └──────────────────────────────────┘
        Frontend estático: GitHub Pages (React + Vite)  ◀── GitHub Actions ── repo público
```

Tres piezas, dos de ellas gestionadas (GitHub Pages, Supabase). Nada que mantener encendido.

## Stack

| Capa | Elección | Motivo |
|---|---|---|
| UI | React 19, Vite 6, TypeScript 5 (estricto) | Estándar, rápido, buen soporte de tipos. |
| Estado | Zustand (o React context) + TanStack Query para datos remotos | Ligero; caché y reintentos gratis. |
| Estilos | CSS Modules + variables `--tg-theme-*` | Cero dependencia de tema; bundle pequeño. Tailwind opcional si se prefiere. |
| Rutas | Estado propio (pila de pantallas) | 6 pantallas; el BackButton de Telegram controla la pila. Sin react-router. |
| Validación | Zod (compartido en `core`, `web` y `api`) | Un esquema para recetas, preferencias y respuestas de IA. |
| Backend | Supabase Edge Functions (Deno) + Hono | Una función `api` con router; despliegue con `supabase functions deploy`. |
| Base de datos | Supabase PostgreSQL 15 | Gestionada, backups, RLS. |
| IA (Fase 3) | API de Claude desde la Edge Function | Salida JSON con esquema; el catálogo limita las opciones. |
| Tests | Vitest (`core`, `web`), Deno test (`api`), Playwright (flujos E2E en viewport móvil) | |
| CI/CD | GitHub Actions: lint + tests + build → Pages; `supabase db push` y `functions deploy` manuales o por etiqueta | |

## Monorepo

```
nutri-plan/
├── package.json                # workspaces: apps/*, packages/*
├── apps/web/
│   ├── index.html              # carga telegram-web-app.js?63
│   ├── src/
│   │   ├── tg/                 # envoltorio tipado del SDK + modo simulado
│   │   ├── screens/            # Home, Preferences, WeekMenu, ShoppingList, Pantry, Recipe
│   │   ├── components/         # Card, Chip, Stepper, Segmented, Sheet, Banner, Skeleton
│   │   ├── state/              # stores (prefs, menu, list, pantry) + sincronización offline
│   │   ├── api/                # cliente HTTP (fetch + cabecera tma) generado del contrato
│   │   ├── i18n/es.ts          # todas las cadenas
│   │   └── main.tsx
│   └── vite.config.ts          # base: '/nutri-plan/' para GitHub Pages
├── packages/core/
│   └── src/
│       ├── types.ts            # Recipe, Ingredient, Preferences, Menu, ShoppingList…
│       ├── schemas.ts          # Zod
│       ├── units.ts            # normalización y conversión de unidades
│       ├── scaling.ts          # escalado por raciones + redondeo a envase
│       ├── shopping.ts         # agregación por ingrediente/categoría
│       ├── matcher.ts          # recetas por ingredientes disponibles
│       ├── planner.ts          # motor de reglas para el menú (semilla)
│       └── safety.ts           # detección de situaciones a derivar
├── supabase/
│   ├── config.toml
│   ├── migrations/0001_init.sql …
│   ├── functions/api/
│   │   ├── index.ts            # Hono app
│   │   ├── auth.ts             # verifyInitData, botSecret
│   │   ├── routes/             # preferences, menus, shopping, recipes, pantry, bot
│   │   └── ai/                 # Fase 3: prompts, esquema de salida, cliente
│   └── seed/import-recipes.ts  # data/recipes/*.yaml → tablas
├── data/recipes/*.yaml
├── docs/
└── .github/workflows/{ci.yml,pages.yml}
```

`packages/core` **no importa React ni APIs de Deno/Node**, para ejecutarse igual en el
navegador y en la Edge Function. Se publica como paquete de workspace; la función `api` lo
importa vía `import_map` (ruta relativa) o se empaqueta con `esbuild` antes de desplegar.

## Fases y dónde vive la lógica

| Fase | Datos | Menú y lista | Recetas |
|---|---|---|---|
| 1 | CloudStorage (prefs) + localStorage (menú, lista) | `core/planner` en el navegador | JSON estático generado desde `data/recipes` en el build |
| 2 | Supabase | `core/planner` en la Edge Function; el navegador conserva caché | Tabla `recipes` + endpoint `GET /recipes` |
| 3 | Supabase | IA elige del catálogo; `core` valida y construye la lista | Igual |
| 4 | Supabase | Igual | Endpoints `/bot/*` para Nutri |

La misma UI funciona en todas las fases porque el cliente habla con una interfaz `DataSource`
(`LocalDataSource` en Fase 1, `RemoteDataSource` desde Fase 2, con `CachedDataSource` que
combina ambas para el modo offline).

## Despliegue

### Frontend (GitHub Pages)

- `vite.config.ts` → `base: '/nutri-plan/'`. La URL final:
  `https://drraulferrer.github.io/nutri-plan/`.
- Workflow `pages.yml`: en cada push a `main` → `npm ci` → tests → `vite build` →
  `actions/deploy-pages`. Publicación en 1–2 minutos.
- Cabeceras: GitHub Pages no permite cabeceras personalizadas; la CSP se declara con
  `<meta http-equiv="Content-Security-Policy">`:
  `default-src 'self'; script-src 'self' https://telegram.org; connect-src 'self' https://*.supabase.co; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors https://web.telegram.org https://*.telegram.org`.
- Dominio propio más adelante: fichero `CNAME` + DNS; hay que actualizar BotFather.

### Backend (Supabase)

```bash
supabase link --project-ref <ref>
supabase db push                           # migraciones
supabase secrets set BOT_TOKEN=… BOT_SHARED_SECRET=… ANTHROPIC_API_KEY=…
supabase functions deploy api --no-verify-jwt   # la autenticación la hace verifyInitData
```

`--no-verify-jwt` porque las peticiones no llevan JWT de Supabase sino `initData`. La función
rechaza todo lo que no valide.

## Configuración y secretos

| Variable | Dónde | Uso |
|---|---|---|
| `BOT_TOKEN` | Supabase secrets | Derivar la clave HMAC para `initData`. **Nunca** en el frontend ni en el repo. |
| `BOT_SHARED_SECRET` | Supabase secrets + backend del bot | Autenticar `/bot/*` (Fase 4). 32 bytes aleatorios. |
| `ANTHROPIC_API_KEY` | Supabase secrets | Fase 3. |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Inyectadas por Supabase en la función | Acceso a la base de datos desde la función. |
| `VITE_API_BASE_URL` | Variable de build en GitHub Actions (no secreta) | `https://<ref>.supabase.co/functions/v1/api` |
| `VITE_BOT_USERNAME` | Build | `Nutri_RF_Bot` para los enlaces `t.me`. |

El repositorio incluye `.env.example` con todas las claves vacías y un check en CI
(`gitleaks`) que falla si aparece un token.

## Seguridad

- **Autenticación**: `initData` HMAC en cada petición (doc 03 §4). Sin sesión propia en v1.
- **Autorización**: toda consulta filtra por `profile_id` derivado del `telegram_user_id`
  validado. RLS activado en todas las tablas y **sin políticas para `anon`/`authenticated`**: la
  clave pública de Supabase no puede leer nada. Solo `service_role` desde la función.
- **Catálogo** (`recipes`, `ingredients`): lectura pública permitida (política `select` para
  `anon`) porque no contiene datos personales; permite servirlo cacheado.
- **Validación de entrada**: Zod en cada endpoint; límites de tamaño (texto libre ≤ 200,
  ingredientes ≤ 40 por consulta, listas ≤ 300 ítems).
- **Límite de peticiones**: por `telegram_user_id`, 60/min general y 10/min para
  `/menus/generate` (contador en tabla `rate_limits` o Upstash si hace falta).
- **CORS**: origen permitido solo `https://drraulferrer.github.io` (y `http://localhost:5173`
  en desarrollo).
- **Registro**: sin `initData` ni contenido de usuario en logs; solo `telegram_user_id` hasheado
  con sal del servidor y códigos de error.
- **Dependencias**: `npm audit` y Dependabot en CI.

## Rendimiento

- Objetivo: bundle inicial ≤ 200 kB gz. React + Zustand + Zod ≈ 70 kB; el catálogo de recetas
  (55 recetas ≈ 60 kB JSON) se carga aparte y se cachea.
- División por pantalla con `React.lazy`.
- Imágenes: ninguna en v1 (iconos SVG inline).
- Las respuestas de `/recipes` llevan `Cache-Control: public, max-age=3600` y `ETag`.

## Observabilidad mínima

- Supabase: logs de la función y `get_advisors` (seguridad/rendimiento) revisados antes de
  cada release.
- Tabla `events` (`profile_id`, `screen`, `action`, `created_at`) para saber qué pantallas se
  usan; sin contenido. Consulta agregada en un panel SQL de Supabase.
- Errores del frontend: `window.onerror` → `POST /events` con tipo `error` y mensaje truncado
  (sin datos personales).
