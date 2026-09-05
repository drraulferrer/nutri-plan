# 00 · Decisiones de la v1

Cada decisión tiene un valor **recomendado** para poder empezar a construir sin esperar. Las
marcadas con `⚠️ DECIDIR` son las que conviene confirmar antes de la Fase 2 (datos reales),
porque cambiarlas después cuesta más.

## Producto

| # | Decisión | Recomendación | Estado |
|---|---|---|---|
| D-01 | Días del plan | **7 días por defecto**, opción de 5 (lunes–viernes). El usuario elige en Preferencias. | Cerrada |
| D-02 | Comidas por día | Desayuno, comida y cena siempre. **Tentempié opcional**, desactivado por defecto (1 al día si se activa). | Cerrada |
| D-03 | Rango de personas | 1 a 8. Por defecto 2. | Cerrada |
| D-04 | Raciones base de las recetas | Todas las recetas del recetario se escriben **para 2 raciones**. El escalado es lineal con redondeo por unidad (ver doc 09). | Cerrada |
| D-05 | Alternativas por plato | Cada hueco del menú lleva **hasta 2 recetas alternativas** precalculadas (distinta proteína principal) y cada receta lleva sus **sustituciones de ingredientes**. | Cerrada |
| D-06 | Inicio de semana | El menú empieza el **próximo lunes** si hoy es jueves o después; si no, el lunes de la semana actual. El usuario puede cambiar la fecha. | `⚠️ DECIDIR` |
| D-07 | Idioma | **Español (es-ES)** único en v1. Textos en fichero de cadenas para poder traducir después. | Cerrada |
| D-08 | Nombre visible | **Nutri Plan**. Título corto en BotFather: "Nutri Plan". | Cerrada |
| D-09 | Tamaño del recetario inicial | **55 recetas** (15 diario <30 min, 10 batch cooking, 10 cenas, 10 vegetarianas, 5 aprovechamiento, 5 desayunos). | Cerrada |
| D-10 | Autoría del recetario | Las recetas las escribe o revisa el propietario del bot (profesional sanitario). La IA **no inventa recetas** en v1: elige del recetario. | Cerrada |
| D-11 | Categorías de la lista de compra | Verduras y fruta · Proteínas · Lácteos y alternativas · Despensa · Congelados · Otros. | Cerrada |
| D-12 | Alérgenos | Los **14 alérgenos de declaración obligatoria en la UE** (Reglamento 1169/2011). Se marcan en cada receta e ingrediente. | Cerrada |

## Técnica

| # | Decisión | Recomendación | Estado |
|---|---|---|---|
| T-01 | Frontend | **React 19 + Vite + TypeScript**. Estilos con CSS propio basado en variables `--tg-theme-*` (Tailwind opcional, no necesario). | Cerrada |
| T-02 | Backend y base de datos | **Supabase**: PostgreSQL + Edge Functions (Deno/TypeScript, router Hono). Sustituye a FastAPI del plan original para reducir piezas a mantener. Alternativa equivalente: FastAPI + Postgres en Render/Fly con el mismo contrato de API (doc 06). | `⚠️ DECIDIR` |
| T-03 | Hosting del frontend | **GitHub Pages** desde el repositorio público (HTTPS gratuito, `https://<usuario>.github.io/nutri-plan/`). Dominio propio opcional más adelante (`app.nutri…`). Alternativa: Cloudflare Pages o Vercel. | `⚠️ DECIDIR` |
| T-04 | Repositorio | **Público en GitHub**. Sin secretos en el código; `.env.example` documentado. Licencia MIT para el código; las recetas con licencia CC BY-NC-SA o "todos los derechos reservados" (ver doc 12). | `⚠️ DECIDIR` (licencia recetas) |
| T-05 | Autenticación | **`initData` validado en el servidor en cada petición** (cabecera `Authorization: tma <initData>`, HMAC-SHA256 con el token del bot, antigüedad máxima 24 h). No se emiten JWT propios en v1. | Cerrada |
| T-06 | Persistencia en Fase 1 (sin backend) | Preferencias en **`Telegram.WebApp.CloudStorage`**; menú y lista en `localStorage` como caché. Al llegar la Fase 2, Supabase es la fuente de verdad y CloudStorage/localStorage quedan como caché offline. | Cerrada |
| T-07 | Puente app → chat de Nutri | **`openTelegramLink("https://t.me/Nutri_RF_Bot?text=<mensaje>")`**: abre el chat con el mensaje prerrellenado y el usuario lo envía. Funciona desde el Main Mini App, no necesita `query_id` ni backend, y el usuario puede editar antes de enviar. | Cerrada |
| T-08 | Compartir lista | `openTelegramLink("https://t.me/share/url?url=<enlace a la app>&text=<lista>")` para elegir chat o grupo. Copiar con `navigator.clipboard.writeText`. | Cerrada |
| T-09 | Lógica compartida | Paquete `packages/core` en TypeScript puro (sin dependencias de React ni Deno): tipos, escalado, agregación, matcher y planificador de menús. Se ejecuta en el navegador (Fase 1) y en la Edge Function (Fase 2+). | Cerrada |
| T-10 | Motor de menús | **Fase 1–2: motor de reglas determinista** (semilla reproducible). **Fase 3: IA** (API de Claude) que elige recetas del catálogo por `id` respetando restricciones, con salida JSON validada. | Cerrada |
| T-11 | Formato del recetario | Un fichero **YAML por receta** en `data/recipes/`, validado con esquema (Zod) en CI y cargado en la base de datos con un script de seed. | Cerrada |
| T-12 | Offline | La **lista de compra debe funcionar sin conexión** (supermercado). Cache local + cola de cambios que se sincroniza al volver la red. | Cerrada |
| T-13 | Analítica | Solo contadores agregados por pantalla (`events` sin contenido). Nada de terceros. | Cerrada |
| T-14 | Retención de datos | Borrado automático de perfiles inactivos > 12 meses. Botón "Borrar mis datos" en Preferencias. | Cerrada |
| T-15 | Estado del usuario en la base de datos | **Documentos JSONB**: `menus.data` y `shopping_lists.data` guardan el mismo objeto que calcula `core`; despensa, favoritos e ingredientes que no gustan referencian **slugs**. El catálogo mantiene tablas normalizadas más el documento completo. Motivo: una sola lógica (core) en navegador y servidor sin capa de mapeo. Normalizar el menú por filas queda para cuando haga falta analítica por receta. | Cerrada |
| T-16 | Sincronización | Al abrir, el servidor manda si tiene datos y el dispositivo sube si el servidor está vacío. Después, cada cambio se sube con retardo (0,8 s) y reintento; última escritura gana. Sin sesión válida la app funciona en modo local. | Cerrada |

## Preguntas abiertas para el propietario del bot

1. **D-06** ¿Qué día debe empezar el menú por defecto? (Propuesto: lunes, con regla jueves→siguiente semana.)
2. **T-02** ¿Supabase (recomendado) o mantener FastAPI + Postgres?
3. **T-03** ¿GitHub Pages es suficiente para empezar o quieres dominio propio desde el día uno?
4. **T-04** Licencia de las recetas en el repositorio público.
5. **Nutri / Hermes**: ¿en qué plataforma corre el bot y puede llamar a una API externa (herramienta HTTP) cuando el usuario le pide algo sobre "su menú"? Determina cuánto de la Fase 4 se puede hacer (ver doc 03, sección "Puente bot → app").
6. ¿Necesitas que la app funcione también dentro de **grupos** (lista compartida familiar) en v1, o basta con chat privado? Propuesto: chat privado; compartir la lista a un grupo mediante `share/url`.
