# 10 · Plan por fases

Cuatro fases incrementales. Cada una termina con algo usable por personas reales. La
**definición de hecho (DoD)** de cada fase es la puerta para pasar a la siguiente.

## Fase 0 · Preparación (1–2 días)

- [ ] Confirmar decisiones `⚠️ DECIDIR` del doc 00.
- [ ] Crear repositorio público `nutri-plan` en GitHub con licencia, `.gitignore`, `.env.example`,
      esta documentación en `docs/`.
- [ ] Monorepo con workspaces (`apps/web`, `packages/core`), TypeScript estricto, Vitest, ESLint,
      Prettier, GitHub Actions `ci.yml` (lint + test + build).
- [ ] Catálogo de ingredientes (`data/ingredients.yaml`, ~150) y esquema Zod.
- [ ] Empezar el recetario: al menos las 15 comidas de diario y los 5 desayunos para tener con
      qué probar.

## Fase 1 · Mini App visual, sin backend (1 semana)

**Objetivo:** comprobar que la navegación es cómoda en móvil y que el menú y la lista tienen
sentido con el motor de reglas en el navegador.

Entregables:
- [x] Envoltorio del SDK con modo simulado; tema claro/oscuro; BackButton, BottomButton,
      SecondaryButton, HapticFeedback.
- [x] Pantallas A–F con datos del recetario (JSON generado en build).
- [x] `core/planner`, `core/scaling`, `core/shopping`, `core/matcher`, `core/safety` con tests.
- [x] Preferencias en CloudStorage (con fallback a localStorage en navegador); menú y lista en
      localStorage.
- [x] Puente al chat (`openTelegramLink` con plantillas M1–M6) y compartir/copiar (L1).
- [x] Despliegue a GitHub Pages; URL configurada en BotFather como Main Mini App y Menu Button.

DoD:
- Flujo F1 completo en < 2 min por una persona ajena al proyecto, en Android e iOS.
- Menú de 7 días × 2 personas sin repetición, con alergia a huevo y estilo vegetariano → cero
  recetas con huevo o carne (test automático + revisión manual).
- Lista de compra de ese menú revisada a mano: cantidades y envases razonables.
- Todos los tests de `core` en verde; cobertura ≥ 80 % en `core`.

## Fase 2 · Datos reales (1 semana)

**Objetivo:** que el usuario cierre Telegram, vuelva y conserve todo; que la lista funcione sin
cobertura.

Entregables:
- [x] Proyecto Supabase `nutri-plan` (org vulpex-order, eu-west-1), migración aplicada, RLS, catálogo cargado, función `api` desplegada y `VITE_API_BASE_URL` fijado en GitHub. Pendiente: `BOT_TOKEN` en secretos (lo pone el propietario).
- [x] Edge Function `api` con `verifyInitData`, límites de peticiones, rutas del doc 06, CORS. 17 tests en Deno.
- [x] Cliente de API + sincronización con caché local y reintento (doc 06 §Sincronización).
- [x] Favoritos y despensa sincronizados. Historial de menús: la tabla lo conserva (`is_current`), la pantalla llega después.
- [x] `DELETE /me` y botón "Borrar mis datos".
- [ ] Panel SQL con métricas agregadas de uso.

DoD:
- Prueba de aislamiento: `initData` de un usuario no accede a datos de otro (test de integración
  con dos `initData` reales).
- `initData` manipulado (hash alterado, `auth_date` viejo, sin `user`) → 401 en todos los casos
  (tests con vectores fijos).
- Lista de compra en modo avión: marcar 5 ítems, recuperar red, los 5 aparecen marcados en otra
  sesión.
- 3–5 personas de confianza usándola una semana; recogidas las pantallas que usan de verdad.

## Fase 3 · Generación inteligente (3–5 días)

**Objetivo:** menús con lógica semanal y adaptación al texto libre, con el motor de reglas como
respaldo.

Entregables:
- [x] `POST /me/menus/generate {source:'ia'}` según doc 08: candidatos tras restricciones duras, salida estructurada (tool use), validación con `core`, un reintento con los errores y respaldo en reglas (`ai_fallback`).
- [x] Reglas de seguridad en el prompt (no adaptar a situaciones de salud) y en UI.
- [x] Interruptor en Preferencias "Menús con ayuda de Nutri (IA)", activado por defecto.
- [x] Registro de tokens y resultado por menú en `ai_usage`.
- [x] **Verificado en producción (2026-09-06):** menú generado por Claude (`retry_ok`, 8 664 tokens de entrada y 2 095 de salida, unos 17 s) con nota de organización; los huecos sin candidatos (desayunos y tentempiés con 7 días) quedan vacíos hasta ampliar el recetario.

DoD:
- 20 menús generados con 10 perfiles distintos (incluyendo alergias combinadas y texto libre
  con banderas de seguridad): 0 violaciones de restricciones duras, 0 recetas fuera de catálogo.
- Tiempo p95 < 10 s; fallback probado desconectando la clave.
- Revisión de 5 menús por el propietario del bot: coherencia culinaria aceptable.

## Fase 4 · Puente completo con Nutri (según plataforma del bot)

Entregables:
- [x] Rutas `/bot/*` con `X-Bot-Secret` (doc 13), 5 tests.
- [x] Herramientas del agente en `bot/tools.json`: `nutri_plan_get_context`, `nutri_plan_get_slot`, `nutri_plan_set_slot`, `nutri_plan_get_recipe`. Falta conectarlas en la plataforma del bot.
- [ ] El bot envía botones inline `web_app` para abrir la app en la pantalla adecuada (configuración del bot, fuera de este repo).
- [ ] Opcional: `savePreparedInlineMessage` + `shareMessage` para compartir la lista como mensaje
      con formato.

DoD:
- Conversación de prueba: el usuario pulsa "Pedir alternativa a Nutri" en la cena del jueves,
  Nutri lee el menú real, propone dos opciones del catálogo y, al aceptar, la app refleja el
  cambio y la lista se actualiza.

## Publicación mínima viable (al cerrar Fase 2)

1. Dominio: empezar con `drraulferrer.github.io/nutri-plan/`; si se quiere dominio propio,
   `CNAME` + DNS y actualizar BotFather.
2. Frontend en GitHub Pages (HTTPS automático).
3. Supabase en región `eu-west` (Frankfurt o Irlanda) por RGPD.
4. Secretos solo en Supabase (`BOT_TOKEN`, `BOT_SHARED_SECRET`, `ANTHROPIC_API_KEY`).
5. URL en BotFather (Main Mini App + Menu Button) con icono y descripción.
6. Prueba con el usuario propietario en Android, iOS y Desktop.
7. Invitar a 3–5 personas; medir con `events` qué pantallas usan y en qué paso abandonan.

## Plan para esta semana (orden exacto)

| Día | Tarea | Resultado |
|---|---|---|
| 1 | Confirmar decisiones; crear repo; monorepo + CI | `npm test` en verde en GitHub |
| 1–2 | Catálogo de ingredientes + 20 primeras recetas en YAML | `npm run recipes:check` pasa |
| 2 | Envoltorio SDK + tema + pantalla A y B (CloudStorage) | Se abre en Telegram Desktop |
| 3 | `core/planner` + pantalla C con menú generado | Menú de ejemplo navegable |
| 3–4 | `core/shopping` + pantalla D + compartir/copiar | Lista real desde el menú |
| 4 | `core/matcher` + pantalla E + F | Tres recetas con lo que tengo |
| 5 | Pulido móvil, estados vacíos, offline básico; despliegue Pages; BotFather | Fase 1 usable |
| 5+ | Resto del recetario (hasta 55) en paralelo con la Fase 2 | |

Después: Fase 2 (Supabase + `verifyInitData`), Fase 3 (IA), Fase 4 (bot).
