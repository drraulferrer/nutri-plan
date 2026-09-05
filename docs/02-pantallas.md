# 02 · Pantallas y flujos

Seis pantallas (las cinco del plan original más el **detalle de receta**, necesario para "Ver
receta"). Navegación plana con pila: Inicio → pantalla → detalle. El **BackButton de Telegram**
sustituye a cualquier flecha propia; la app nunca dibuja su propia barra superior.

```
                    ┌──────────────┐
        ┌──────────▶│ B Preferencias│
        │           └──────────────┘
┌───────┴──┐        ┌──────────────┐      ┌──────────────┐
│ A Inicio │───────▶│ C Menú semanal│────▶│ F Receta     │
│          │        └──────┬───────┘      └──────▲───────┘
│          │               │ genera               │
│          │        ┌──────▼───────┐             │
│          │───────▶│ D Lista compra│             │
│          │        └──────────────┘             │
│          │        ┌──────────────┐             │
│          │───────▶│ E Con lo que  │─────────────┘
└──────────┘        │   tengo       │
                    └──────────────┘
```

## Convenciones de interfaz

| Elemento | Uso |
|---|---|
| **BottomButton (MainButton)** | Acción principal de la pantalla: "Generar menú", "Dame recetas", "Guardar". Con `showProgress()` durante llamadas. |
| **SecondaryButton** | Acción secundaria cuando exista (p. ej. "Compartir" junto a "Copiar"). |
| **BackButton** | Visible en toda pantalla que no sea Inicio. |
| **SettingsButton** | Abre Preferencias desde cualquier pantalla (icono ⚙️ nativo en la cabecera de Telegram). |
| **HapticFeedback** | `impactOccurred('light')` al marcar casillas; `notificationOccurred('success')` al generar menú; `('warning')` al confirmar alergias. |
| **Popups nativos** | `showConfirm` para regenerar la semana completa y para borrar datos; `showPopup` para elegir qué regenerar. |
| **Colores** | Solo variables `--tg-theme-*`. Un único acento propio (verde hoja) para etiquetas de éxito y "Tienes todo". Alergias: `--tg-theme-destructive-text-color` + icono ⚠️. |
| **Tipografía** | Fuente del sistema. Tamaños 17 / 15 / 13 px. |
| **Estados vacíos** | Siempre con una acción: "Aún no tienes menú → Planificar mi semana". |
| **Carga** | Esqueletos (skeleton) en tarjetas; nunca spinner a pantalla completa. |
| **Error de red** | Banner superior no bloqueante "Sin conexión · mostrando la última versión guardada". |

## A · Inicio

**Objetivo:** llevar al usuario a una de las tres tareas en un toque.

```
┌──────────────────────────────┐
│ Hola, [nombre] 👋            │  ← nombre desde initData.user.first_name, no se guarda
│ Semana del 8 al 14 sep       │  ← solo si hay menú
├──────────────────────────────┤
│ 🗓  Planificar mi semana      │  ← si hay menú: "Ver mi menú" + subtítulo "Hoy: lentejas · tortilla"
│ 🍳  Cocinar con lo que tengo  │
│ 🛒  Mi lista de compra        │  ← subtítulo "12 de 23 comprados" si existe
│ ⚙️  Mis preferencias          │  ← subtítulo "2 personas · vegetariano · sin gluten"
└──────────────────────────────┘
        pie: "Nutri Plan organiza. Para dudas, pregunta a Nutri en el chat." (enlace)
```

- Sin preferencias guardadas → el primer botón dice "Empezar" y lleva a B con un paso previo
  de bienvenida (3 frases).
- `start_param` (`menu` / `lista` / `cocinar`) salta directamente a C / D / E.

## B · Preferencias

**Objetivo:** formulario corto, editable, que cabe en dos pantallas de scroll.

| Campo | Control | Valores | Por defecto |
|---|---|---|---|
| Personas | Stepper − / + | 1–8 | 2 |
| Días | Segmentado | 5 (L–V) · 7 | 7 |
| Tentempiés | Interruptor | sí / no | no |
| Tiempo para cocinar | Segmentado | 15 · 30 · 45 · 60+ min | 30 |
| Presupuesto | Segmentado | Ajustado · Medio · Flexible | Medio |
| Estilo | Chips multiselección | Mediterráneo · Vegetariano · Vegano · Flexitariano · Sin gluten · Sin lactosa | Mediterráneo |
| **Alergias e intolerancias** | Chips multiselección en sección destacada (borde destructivo, icono ⚠️) | 14 alérgenos UE | ninguno |
| Otras restricciones | Texto libre (máx. 200 caracteres) | — | vacío |
| Ingredientes que no me gustan | Chips con autocompletado del catálogo | — | vacío |

**Reglas:**
- Si hay alérgenos marcados, aparece bajo la sección: casilla **"He revisado mis alergias y son
  correctas"**. Sin marcarla, el BottomButton "Guardar" está deshabilitado. Al cambiar alérgenos
  se desmarca y hay que volver a confirmar.
- Vegano implica vegetariano y sin lácteos/huevos: al marcarlo, la app lo indica ("Incluye sin
  huevo y sin lácteos").
- Si el texto libre dispara las reglas de seguridad (doc 08), se muestra bajo el campo el aviso
  de derivación con enlace "Hablar con Nutri" y el texto se guarda igualmente como nota.
- Pie de la pantalla: "Nutri Plan no guarda peso, calorías ni datos de salud." + enlace
  **"Borrar mis datos"** (confirmación nativa).
- Guardar → `HapticFeedback.notificationOccurred('success')` → volver a Inicio. Si venía de C
  y cambió algo que afecta al menú (personas, alergias, estilo, días), preguntar:
  "¿Regenerar el menú con las nuevas preferencias?" Sí / Solo la lista / No.

## C · Menú semanal

**Objetivo:** ver la semana de un vistazo y actuar sobre un plato en dos toques.

```
┌──────────────────────────────┐
│ ‹ L  M  X  J  V  S  D ›      │  ← selector de día pegajoso; el día actual resaltado
├──────────────────────────────┤
│ LUNES 8                       │
│ ┌ Desayuno ─────────────── ⋯┐│
│ │ Yogur con fruta y avena    ││
│ │ 5 min · 2 raciones          ││
│ └────────────────────────────┘│
│ ┌ Comida ───────────────── ⋯┐│
│ │ Lentejas con verduras       ││
│ │ 35 min · ⭐ favorito · 🔁 batch││
│ │ Alternativas: garbanzos · tofu│
│ └────────────────────────────┘│
│ ┌ Cena ─────────────────── ⋯┐│
│ │ Tortilla con ensalada       ││
│ │ 15 min                      ││
│ └────────────────────────────┘│
└──────────────────────────────┘
 BottomButton: "Ver lista de compra"        SecondaryButton: "Mejora este menú" (→ chat)
```

**Menú ⋯ de cada plato** (hoja inferior):
1. Ver receta → F
2. Cambiar plato (elige entre las 2 alternativas o "otra opción" que regenera la comida)
3. Marcar / quitar favorito
4. Bloquear (no cambia al regenerar)
5. Añadir ingredientes a la lista (si el plato se quitó de la lista)
6. **Pedir alternativa a Nutri** → chat (plantilla M1, doc 03)

**Menú ⋯ de la cabecera del día:** Regenerar este día · Marcar día como "comer fuera" (vacía las
comidas del día y las quita de la lista).

**Menú ⋯ de la semana** (SettingsButton no; icono en la fila de días): Regenerar semana completa
(`showConfirm`) · Cambiar fecha de inicio · Ver semanas anteriores.

**Estados:**
- Sin menú → ilustración ligera + "Aún no hay menú para esta semana" + BottomButton "Generar menú
  (7 días · 2 personas)". Si no hay preferencias, lleva a B primero.
- Generando → esqueletos de 3 tarjetas + BottomButton con progreso. Tiempo objetivo < 1 s
  (reglas) / < 8 s (IA, con texto "Nutri está pensando…").
- Restricción blanda incumplida → aviso en la tarjeta: "Este plato tarda 45 min (tu límite: 30)".

## D · Lista de compra

**Objetivo:** usarse en el supermercado con una mano y sin cobertura.

```
┌──────────────────────────────┐
│ Lista · semana 8–14 sep       │
│ 👥 2 personas  [−] [+]         │  ← recalcula al vuelo
│ 12 de 23 · ████████░░░░        │
├──────────────────────────────┤
│ VERDURAS Y FRUTA (7)          │
│ ☐ Espinacas          400 g    │  ← toque en la fila = comprado (tachado, va al final)
│ ☐ Tomate             6 ud     │     deslizar o mantener = "ya lo tengo" (sale de la lista)
│ ☑ ~~Cebolla~~        3 ud     │
│ PROTEÍNAS (4)                  │
│ ☐ Huevos             12 ud    │     detalle: "necesitas 10 → 1 docena"
│ ☐ Lentejas cocidas   2 botes  │
│ …                              │
│ ▸ BÁSICOS QUE SUELES TENER (5) │  ← plegado: aceite, sal, pimienta, ajo, vinagre
│ ▸ YA LO TENGO (3)              │  ← plegado, recuperable
└──────────────────────────────┘
 BottomButton: "Compartir por Telegram"     SecondaryButton: "Copiar lista"
```

**Reglas:**
- Cada ítem muestra la cantidad de compra (redondeada a envase) y, al tocar el detalle, la
  cantidad exacta y en qué recetas se usa.
- "Ya lo tengo" también guarda el ingrediente en la despensa del usuario (RF-36).
- Compartir usa la plantilla L1 (doc 03), texto plano con categorías y casillas `☐`.
- Sin menú → "Primero genera tu menú" + botón.
- Sin conexión → funciona íntegra desde caché; cambios en cola.

## E · Cocinar con lo que tengo

**Objetivo:** tres ideas útiles en menos de 30 segundos.

```
┌──────────────────────────────┐
│ ¿Qué tienes por casa?          │
│ ┌──────────────────────────┐  │
│ │ escribe un ingrediente…  │  │  ← autocompletado del catálogo (sinónimos)
│ └──────────────────────────┘  │
│ [huevos ×] [espinacas ×] [arroz ×] [tomate ×]
│ Sugerencias: cebolla · ajo · queso · atún    ← frecuentes en el recetario
│ Filtros: [≤ 20 min] [Vegetariano] [Cena]     ← chips conmutables
├──────────────────────────────┤
│ RESULTADOS                     │
│ ┌────────────────────────────┐│
│ │ Arroz salteado con huevo    ││
│ │ y espinacas                 ││
│ │ ✅ Tienes todo · 20 min · 2 rac││
│ └────────────────────────────┘│
│ ┌────────────────────────────┐│
│ │ Tortilla de espinacas       ││
│ │ ⚠️ Falta 1: cebolla (o sin ella)││
│ │ 15 min · 2 rac              ││
│ └────────────────────────────┘│
│ ┌────────────────────────────┐│
│ │ Ensalada de arroz y tomate  ││
│ │ ⚠️ Faltan 2: atún, maíz     ││
│ └────────────────────────────┘│
└──────────────────────────────┘
 BottomButton: "Dame recetas" (antes de buscar) → "Buscar otras 3" (después)
```

**Reglas:**
- Mínimo 2 ingredientes para buscar; con 1 se sugiere añadir otro.
- Los básicos de despensa se consideran disponibles salvo que el usuario los quite en B.
- Cada tarjeta abre F con los ingredientes que faltan resaltados y las sustituciones aplicables.
- Los ingredientes introducidos se guardan como despensa (con fecha) para la próxima apertura.

## F · Detalle de receta

```
┌──────────────────────────────┐
│ Lentejas con verduras          │
│ 35 min · 🔁 batch · 🌱 vegana   │
│ Alérgenos: ninguno             │  ← siempre visible, con ⚠️ si coincide con los del usuario
│ Raciones: [−] 2 [+]             │  ← escala ingredientes al vuelo
├──────────────────────────────┤
│ INGREDIENTES                   │
│ • Lentejas pardinas   250 g    │
│ • Zanahoria           2 ud     │
│ • ⚠️ Puerro (te falta) → sust.: cebolla
│ …                              │
│ PASOS                          │
│ 1. …                           │
│ SUSTITUCIONES                  │
│ Puerro → cebolla · Lentejas → garbanzos cocidos (−20 min)
│ CONSEJO                        │
│ Hace ración doble y congela la mitad.
└──────────────────────────────┘
 BottomButton: "Añadir al menú" (desde E) / "Cambiar este plato" (desde C)
 SecondaryButton: "Preguntar a Nutri"   (plantilla M2/M3)
```

## Flujos clave

**F1 · Primer uso (usuario nuevo):** Inicio (modo bienvenida) → B con valores por defecto →
confirmar alergias si las hay → Guardar → C vacía → "Generar menú" → C con menú → BottomButton
→ D. Objetivo: < 2 minutos, ≤ 8 toques.

**F2 · Cambiar la cena del jueves:** C → jueves → ⋯ cena → "Cambiar plato" → elegir alternativa
→ la lista se actualiza sola (banner "Lista actualizada: +2 ingredientes, −1").

**F3 · Pedir ayuda a Nutri:** C → ⋯ → "Pedir alternativa a Nutri" → hoja con criterios rápidos
(vegetariano · < 20 min · sin horno · más barato · texto libre) → "Abrir chat" →
`openTelegramLink` con plantilla M1 → el usuario ve el texto prerrellenado en el chat y lo
envía. La Mini App permanece abierta detrás.

**F4 · Compra sin cobertura:** D abierta desde caché → marcar comprados → al volver la red,
sincroniza en segundo plano y muestra "Guardado".

**F5 · Cocinar con lo que tengo:** E → chips → "Dame recetas" → tarjeta → F → "Añadir al menú"
(elige día y comida) o "Preguntar a Nutri".
