# 11 · Pruebas

## Pirámide

| Nivel | Herramienta | Qué cubre | Cuándo corre |
|---|---|---|---|
| Unitarias | Vitest (`packages/core`, `apps/web`) | escalado, agregación, matcher, planificador, safety, render de plantillas, envoltorio SDK en modo simulado | cada push (CI) |
| Integración | Deno test (`supabase/functions/api`) contra Supabase local | `verifyInitData`, aislamiento entre usuarios, contratos de rutas, límites | cada push (CI) |
| E2E | Playwright, viewport 375×667 y 360×640, `initData` simulado | flujos F1–F5 | antes de cada release |
| Manual | Matriz de dispositivos (abajo) | tema, gestos, teclado, offline, BotFather | antes de cada release |

Cobertura mínima: 80 % en `packages/core` y en las rutas de la Edge Function.

## Unitarias: casos obligatorios

**core/planner**
- Sin repetición de recetas en 7 × 3 huecos (salvo `batch_reuse`, máximo 2 apariciones).
- Alergia a huevo + vegetariano + no gusta "calabacín": ninguna receta resultante contiene
  huevo, carne, pescado ni calabacín (no opcional). Probar con las 14 alergias una a una.
- Vegano ⇒ ninguna receta con lácteos o huevo.
- Restricción blanda incumplida genera `warning` y no bloquea.
- Misma semilla ⇒ mismo resultado. Semilla distinta ⇒ al menos 30 % de huecos distintos.
- Slots bloqueados no cambian al regenerar semana/día.
- Regenerar slot excluye la receta actual.
- Catálogo con 2 recetas de cena: warning `no_candidates` y sin excepción.

**core/shopping** — los casos de referencia del doc 09 §B, más:
- Personas 1 → 4: `needed_qty` se cuadruplica; envases recalculados.
- Ingrediente repetido en 4 recetas con unidades mixtas (g, ud, manojo).
- Delta conserva `checked` y `have_it`.

**core/matcher** — los casos del doc 09 §D, más límites (1 ingrediente, 41 ingredientes).

**core/safety**
- Detecta "estoy embarazada", "Embarazo", "diabetes tipo 2", "diabético", "insuficiencia renal",
  "anorexia", "TCA", con y sin acentos, dentro de frases largas.
- No detecta falsos positivos evidentes: "no me gusta el azúcar", "riñones de cordero" (→ se
  acepta el falso positivo documentado y se prioriza la seguridad: se muestra el aviso igualmente).

**core/templates** — M1–M6 y L1 producen texto ≤ 3 500 caracteres, nunca empiezan por `@`, y
escapan correctamente en `encodeURIComponent`.

**web/tg** — modo simulado expone la misma interfaz; `themeChanged` actualiza las variables CSS;
BackButton hace pop de la pila; BottomButton refleja el estado (`showProgress`).

## Integración: `verifyInitData`

Vectores fijos (generados con un token de prueba `123456:TEST` que **no** es de un bot real):

| Caso | Esperado |
|---|---|
| `initData` válido, `auth_date` ahora | 200, `telegramUserId` correcto |
| hash con un carácter cambiado | 401 `unauthorized` |
| `auth_date` hace 25 h | 401 `expired` |
| sin campo `user` | 401 |
| campo extra añadido sin recalcular hash | 401 |
| campo `signature` presente (Ed25519) | ignorado en HMAC, 200 |
| cabecera ausente | 401 |
| cabecera `Bearer …` en lugar de `tma …` | 401 |

**Aislamiento:** con dos `initData` válidos (usuarios A y B): A crea menú; B `GET /menus/current`
→ 404; B `PATCH /menus/{idA}/slots/…` → 404 (no 403, para no revelar existencia).

**Límites:** 11 llamadas a `/menus/generate` en un minuto → la 11ª devuelve 429 con `retry_after`.

**Validación:** `PUT /preferences` con `people: 9`, `days: 6`, `allergens` sin confirmar,
`other_restrictions` de 201 caracteres → 422 con detalle.

## E2E (Playwright, `initData` simulado)

| Flujo | Pasos | Comprobación |
|---|---|---|
| F1 primer uso | abrir → Empezar → marcar alergia huevo → confirmar → Guardar → Generar menú → Ver lista | menú visible sin huevo; lista con ≥ 1 categoría; ≤ 8 toques |
| F2 cambiar plato | menú → jueves → ⋯ cena → Cambiar → alternativa 1 | tarjeta actualizada; banner de lista con delta |
| F3 pedir a Nutri | ⋯ → Pedir alternativa → "vegetariano" → Abrir chat | `openTelegramLink` llamado con URL que contiene `t.me/Nutri_RF_Bot?text=` y el nombre del plato codificado |
| F4 offline | lista → `context.setOffline(true)` → marcar 3 → online | 3 ítems marcados persisten tras recarga; petición `/sync` con 3 cambios |
| F5 cocinar | E → huevos, espinacas, arroz → Dame recetas → primera tarjeta → Añadir al menú → lunes cena | slot lunes cena con la receta |
| Tema oscuro | forzar `colorScheme: dark` | capturas de A–F sin texto ilegible (contraste comprobado con axe) |
| Personas 1 → 4 | lista → + + + | cantidades × 4; "1 docena" → "2 docenas" en huevos |

## Matriz manual antes de publicar

| Comprobación | Android (Telegram) | iOS (Telegram) | Telegram Desktop | Telegram Web |
|---|---|---|---|---|
| Tema claro y oscuro, cambio en caliente | ☐ | ☐ | ☐ | ☐ |
| Pantalla pequeña (360×640) y grande | ☐ | ☐ | — | — |
| Usuario nuevo sin preferencias (F1) | ☐ | ☐ | ☐ | ☐ |
| Usuario vegetariano | ☐ | ☐ | ☐ | — |
| Usuario con alergia (confirmación obligatoria, icono ⚠️ en recetas) | ☐ | ☐ | ☐ | — |
| Cambio de raciones 1 → 4 en lista y en receta | ☐ | ☐ | — | — |
| Lista con ingredientes repetidos entre recetas | ☐ | ☐ | — | — |
| Recetas con ingredientes incompletos (etiquetas) | ☐ | ☐ | — | — |
| Abrir desde perfil del bot, desde Menu Button, desde enlace `?startapp=lista` | ☐ | ☐ | ☐ | ☐ |
| Abrir el enlace `?startapp` compartido en un grupo | ☐ | ☐ | — | — |
| BackButton en cada pantalla; cerrar en Inicio | ☐ | ☐ | ☐ | ☐ |
| Teclado en pantalla no tapa el campo de ingredientes ni el BottomButton | ☐ | ☐ | — | — |
| Deslizar en lista larga no cierra la app (`disableVerticalSwipes`) | ☐ | ☐ | — | — |
| Modo avión: lista y menú desde caché; sincronización al volver | ☐ | ☐ | — | — |
| "Pedir a Nutri": el chat aparece con el texto prerrellenado y la app sigue abierta | ☐ | ☐ | ☐ | ☐ |
| Compartir lista a un grupo y copiar | ☐ | ☐ | ☐ | ☐ |
| Sesión: `initData` de otro usuario no ve mis datos (probar con 2 cuentas) | ☐ | — | ☐ | — |
| Borrar mis datos → al reabrir, usuario nuevo | ☐ | — | ☐ | — |
| Aviso de derivación con texto "embarazada" en restricciones | ☐ | ☐ | — | — |

## Criterios de aceptación de la v1

1. Una persona nueva completa F1 en < 2 minutos sin ayuda.
2. Cero violaciones de restricciones duras en 100 menús generados con perfiles aleatorios (test
   de propiedad con `fast-check`).
3. Ninguna petición sin `initData` válido devuelve datos.
4. La lista de compra funciona en modo avión.
5. Tema oscuro sin defectos visibles en las 6 pantallas.
6. Bundle inicial ≤ 200 kB gz; Lighthouse móvil ≥ 90 en rendimiento y accesibilidad.
