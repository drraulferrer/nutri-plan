# 08 · Generación de menús

Dos motores con la misma entrada y la misma salida. El de reglas es el de la v1 y sigue siendo
la red de seguridad cuando la IA falla o tarda.

## Entrada y salida (común)

```ts
type PlannerInput = {
  preferences: Preferences;          // doc 06
  recipes: Recipe[];                 // catálogo activo ya filtrado por restricciones duras
  favorites: string[];               // recipe ids
  pantry: string[];                  // ingredient ids (para priorizar)
  lockedSlots: MenuSlot[];           // no se tocan
  weekStart: string;                 // YYYY-MM-DD, lunes
  seed: string;                      // reproducible
};
type PlannerOutput = {
  slots: Array<{ dayIndex: number; meal: MealType; recipeId: string | null; alternatives: string[] }>;
  warnings: Array<{ dayIndex: number; meal: MealType; type: 'time'|'budget'|'variety'|'no_candidates'; detail: string }>;
};
```

## Restricciones

**Duras** (nunca se incumplen; se aplican como filtro antes de planificar):
1. `recipe.allergens ∩ prefs.allergens = ∅`.
2. Estilo: si `vegano` ∈ styles → receta con `vegano`; si `vegetariano` → `vegetariano` o
   `vegano`; `sin_gluten` y `sin_lactosa` deben estar en `recipe.styles`. `mediterraneo` y
   `flexitariano` no filtran.
3. Ningún ingrediente **no opcional** de la receta está en `disliked_ingredient_ids`.
4. `meal ∈ recipe.meal_types`.

**Blandas** (se puntúan; si no hay candidato que las cumpla se elige el mejor y se emite `warning`):
- Tiempo: `time_min ≤ cook_time` para comidas y cenas entre semana; fin de semana admite hasta
  `cook_time × 1,5`. Batch cooking se evalúa por `active_time_min`.
- Presupuesto: `ajustado` → `cost_level: bajo`; `medio` → bajo o medio; `flexible` → cualquiera.
- Variedad: mismo `protein_group` como máximo 2 veces en comidas y 2 en cenas por semana; no
  el mismo día en comida y cena.
- Reutilización: preferir recetas que compartan ingredientes **perecederos** con las ya elegidas.
- Desayuno y tentempié comparten repertorio: una receta puede ocupar un hueco de cada uno en días
  distintos (RF-11). Sin esta regla, con siete días quedaban tentempiés vacíos en perfiles vegano
  o sin gluten, porque las mismas recetas sirven para ambas comidas.

## Motor de reglas (Fase 1–2)

Algoritmo voraz con puntuación y semilla, en `core/planner.ts`. Tiempo objetivo < 50 ms para 55
recetas × 21 huecos.

```
1. Filtrar catálogo por restricciones duras → C.
   Si para alguna comida |C_meal| < 3 → warning 'no_candidates' y se relaja solo la variedad.
2. Fijar los slots bloqueados (lockedSlots) y anotar sus ingredientes y protein_group.
3. Orden de relleno: comidas de L→D, luego cenas L→D, luego desayunos, luego tentempiés.
   (Las comidas marcan la semana; las cenas aprovechan.)
4. Para cada hueco vacío, puntuar cada receta r ∈ C_meal no usada:
      score = 3·favorito(r)
            + 2·cumpleTiempo(r) + 1·cumplePresupuesto(r)
            + 1.5·ingredientesPerecederosCompartidos(r, elegidas) (normalizado 0–1)
            + 1·usaDespensa(r, pantry) (0–1)
            − 2·mismoProteinGroupEseDía
            − 1·proteinGroupYaUsadoNVeces (n ≥ 2)
            − 1.5·recetaUsadaLaSemanaAnterior (historial, Fase 2)
            + ruido(seed, r.id) ∈ [0, 0.5)     ← variedad reproducible entre regeneraciones
   Elegir la de mayor puntuación.
5. Batch cooking: si la receta elegida para una comida tiene batch_reuse, con probabilidad 0.6
   (seed) programar su segunda aparición como cena 1–2 días después (o la receta de
   aprovechamiento de `pairs_with` si existe y pasa las duras). Cuenta como no repetida (RF-11).
6. Alternativas: para cada hueco, las 2 siguientes recetas de mayor puntuación con
   protein_group distinto al elegido. Si no hay, se rellena con cualquiera de C_meal.
7. Regenerar:
   - slot: repetir 4–6 solo para ese hueco, excluyendo la receta actual y `exclude_recipe_ids`.
   - día: repetir para los huecos de ese día no bloqueados, manteniendo el resto como contexto.
   - semana: todo salvo bloqueados, con nueva semilla.
8. Devolver slots + warnings.
```

Determinismo: el ruido es `hash(seed + recipeId)`; con la misma semilla el resultado es idéntico
(RNF-08). "Otra opción" en la UI usa `seed + ':' + intento`.

## Generación inteligente (Fase 3)

**Qué aporta la IA que las reglas no dan:** coherencia culinaria (una semana con lógica, no
21 elecciones sueltas), aprovechamiento explicado, y adaptación a `other_restrictions` en texto
libre ("no me gusta cocinar los martes", "comemos fuera los viernes").

**Qué NO hace la IA en v1:** inventar recetas, dar consejo nutricional, cambiar cantidades.

### Flujo

```
POST /menus/generate {source:'ia'}
  → filtrar catálogo por duras (igual que reglas) → lista compacta de candidatos
  → prompt con: preferencias, candidatos (id, nombre, tiempo, coste, protein_group, tags, ingredientes clave),
                reglas duras y blandas, historial de 2 semanas, formato de salida
  → respuesta JSON validada con Zod contra el esquema PlannerOutput
  → si falla la validación (id inexistente, alérgeno, repetido) → un reintento con el error explicado
  → si vuelve a fallar o tarda > 12 s → motor de reglas + warning 'ia_fallback'
  → lista de compra SIEMPRE calculada por core/shopping.ts, nunca por la IA
```

### Prompt de sistema (resumen del contenido obligatorio)

- Rol: "planificador de menús caseros para una app que acompaña a un asistente de nutrición.
  No eres el asistente: no des consejos de salud".
- Devuelve solo JSON con el esquema indicado; `recipeId` debe pertenecer a la lista.
- Reglas duras (listadas) son inviolables. Blandas: priorizar en este orden: tiempo, presupuesto,
  reutilizar ingredientes perecederos, variedad de proteína, favoritos.
- Lenguaje neutro: sin alimentos "prohibidos", "malos", ni referencias a peso o calorías en
  `notes`.
- `notes` (opcional, ≤ 240 caracteres): una frase de organización de la semana ("El lunes haces
  doble de lentejas para la cena del miércoles"). Nada más.
- Modelo: el más capaz disponible con salida estructurada; temperatura baja (0.3).
  Coste estimado: ~3 000 tokens de entrada + 800 de salida por menú.

### Reglas de seguridad (aplican a ambos motores)

`core/safety.ts` analiza `other_restrictions` (y, en el futuro, cualquier texto libre) con listas de
términos en español, con acentos y sin ellos, en singular y plural:

| Bandera | Términos (ejemplos) |
|---|---|
| `embarazo` | embarazo, embarazada, gestación, lactancia |
| `diabetes` | diabetes, diabético/a, insulina, glucemia, azúcar en sangre |
| `renal` | renal, riñón, insuficiencia renal, diálisis |
| `tca` | anorexia, bulimia, atracón, atracones, TCA, trastorno alimentario, purga |
| `otro_clinico` | celiaquía*, Crohn, colitis, hipertensión, colesterol, cáncer, quimio |

\* Celiaquía **sí** se atiende como restricción `sin_gluten` estricta (es una restricción de
alimento, no un plan clínico), pero se muestra igualmente el aviso.

Comportamiento cuando hay bandera:
1. En Preferencias aparece bajo el campo el aviso: *"Nutri Plan no elabora planes para
   situaciones de salud como esta. Puedo generar un menú general con tus preferencias, pero
   conviene que lo revises con tu médico o dietista-nutricionista. También puedes hablarlo con
   Nutri."* + botón "Hablar con Nutri" (plantilla M6).
2. Se guarda `safety_flags` en preferencias.
3. `POST /menus/generate` funciona con normalidad, pero la respuesta incluye
   `redirect_notice: true` y la pantalla del menú muestra la nota "Menú general · no adaptado a
   {situación}" de forma persistente.
4. El prompt de la IA recibe la instrucción explícita de **no** adaptar el menú a la situación
   detectada ni mencionarla, y de tratar el texto libre solo en lo organizativo.
5. Nunca se bloquea al usuario ni se le pide más información sobre su salud.

## Lista de compra tras generar

Siempre `core/shopping.ts` (doc 09) sobre los slots resultantes, con `people` de preferencias.
Regenerar un hueco produce un **delta** (`+ ingredientes`, `− ingredientes`) que la UI muestra
en un banner y aplica conservando `checked`/`have_it` de lo que se mantiene.
