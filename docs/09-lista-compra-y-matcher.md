# 09 · Lista de compra y recetas por ingredientes

Ambos algoritmos viven en `packages/core` y tienen pruebas unitarias con casos de referencia
(doc 11). Son puros: entrada → salida, sin acceso a red ni a fecha.

## A. Escalado de raciones (`core/scaling.ts`)

```
factor = personas / recipe.servings_base
cantidad_escalada = cantidad_base × factor
```

Redondeo de la cantidad **mostrada en la receta** (no de la suma para la compra):

| Unidad | Regla |
|---|---|
| g, ml | a múltiplos de 5 si < 100; de 10 si < 1 000; de 50 si ≥ 1 000 |
| ud (huevos, piezas) | al medio (0,5) para verduras/fruta; al entero superior para huevos y piezas indivisibles (`ingredients.indivisible = true`) |
| cda, cdta, pizca | al medio; "pizca" no se escala por encima de 2 (se muestra "al gusto") |
| diente, manojo, rebanada | al entero superior |

Ejemplo: tortilla para 3 personas (base 2): huevos 4 → 6 ud; espinacas 200 → 300 g; cebolla 0,5 → 1 ud (0,75 → 1 por indivisible).

## B. Agregación de la lista (`core/shopping.ts`)

```
entrada: slots[] (con recipe + servings), catálogo de ingredientes, pantry[] (opcional)
salida:  items[] agrupados por categoría, staples[], have_it[]

1. Para cada slot con receta:
     para cada ingrediente NO opcional:
        qty = cantidad_base × (slot.servings / recipe.servings_base)
        convertir a unidad canónica del ingrediente (g | ml | ud) usando units.ts
        (si la receta usa 'ud' y el ingrediente se compra en g → × grams_per_unit, y viceversa)
        acumular en mapa[ingredient_id] += qty; registrar slot_id en source_slot_ids
   Los ingredientes opcionales se acumulan en un mapa aparte y aparecen en la ficha como
   "opcional" dentro del ítem (no suman a la cantidad de compra salvo que el usuario los active).
2. Para cada ingrediente acumulado:
     needed_qty = total en unidad canónica
     si ingredient.package_size:
        buy_qty  = ceil(needed_qty / package_size) × package_size
        buy_label = n × package_label   ("2 latas de 400 g", "1 docena")
     si no:
        buy_qty  = redondear hacia arriba con la tabla de A (g/ml) o al entero (ud)
        buy_label = "{buy_qty} {unit}"
     is_staple = ingredient.is_staple
     have_it   = ingredient_id ∈ pantry  (RF-28)
3. Agrupar por ingredient.category en el orden fijo: verduras_fruta, proteinas, lacteos,
   despensa, congelados, otros. Dentro de cada grupo, alfabético.
4. staples → sección plegada; have_it → sección plegada "Ya lo tengo".
5. Delta al regenerar un slot: recalcular todo y comparar con la lista anterior por
   ingredient_id → {added[], removed[], changed[]}. Conservar checked/have_it de los que siguen.
```

### Casos de referencia (fixtures de prueba)

| Caso | Entrada | Esperado |
|---|---|---|
| Suma simple | Receta A: tomate 2 ud; Receta B: tomate 3 ud; 2 personas | tomate `needed 5 ud`, `buy 5 ud` (sin envase) |
| Suma con conversión | A: espinacas 200 g; B: espinacas 1 manojo (grams_per_unit 250) | `needed 450 g`, `buy 600 g` (2 bolsas de 300 g) |
| Envase | huevos 4 + 6 (3 personas ⇒ 6 + 9 = 15) | `needed 15 ud`, `buy 18 ud` → "3 medias docenas" o "1 docena + 1 media" según `package_label` (usar el envase mayor definido si existe `package_sizes: [6, 12]`) |
| Opcional | laurel opcional en una receta | no aparece en items; aparece en detalle como opcional |
| Básico | aceite, sal | en `staples`, no en `items` |
| Despensa | usuario tiene arroz | arroz en `have_it`, no en `items` |
| Comer fuera | slot con recipe null | no aporta ingredientes |
| Escalado 1→4 | cualquier menú | todos los `needed_qty` × 2 respecto a 2 personas; envases recalculados |
| Delta | cambiar cena jueves | `removed` contiene solo ingredientes exclusivos de la receta antigua; `checked` de "tomate" se conserva si tomate sigue |

## C. Texto para compartir / copiar (`core/shopping.ts → renderListText`)

Plantilla L1 (doc 03 §6). Se generan dos variantes: `full` (con cantidades exactas entre
paréntesis cuando difieren del envase) y `compact` (solo envases). Si `full` > 3 500 caracteres
se usa `compact`; si aún supera, se omiten `staples`.

## D. Recetas con lo que tengo (`core/matcher.ts`)

```
entrada: available: ingredient_id[] (2–40), recipes filtradas por restricciones duras,
         staples: ingredient_id[], filters {max_time?, style?, meal?}, limit = 3
salida:  results[] ordenados

para cada receta r:
   req      = ingredientes no opcionales de r que NO son staples
   descartar si |req| < 2                  ← una receta de un solo ingrediente real no es una sugerencia útil
   have     = req ∩ available   (comparación por ingredient_id; los alias ya se resolvieron en la UI)
   missing  = req − available
   coverage = |have| / |req|               (0–1)
   cubiertos_por_sustitucion = missing que tienen una sustitución en r.substitutions cuyo `with` ∈ available
   coverage_adj = (|have| + 0.8·|cubiertos_por_sustitucion|) / |req|
   score = 100·coverage_adj
         + 6·|have|                        ← premia usar varios de los ingredientes del usuario
         − 4·|missing − cubiertos_por_sustitucion|
         + 5·(r.time_min ≤ 20)
         + 3·(r.id ∈ favoritos)
         − 100·(filtros no cumplidos)      ← excluye
   descartar si coverage_adj < 0.5 o |missing no cubiertos| > 3

ordenar por score desc, desempatar por time_min asc, devolver limit.

etiqueta:
   missing vacío                          → 'tienes_todo'  · "Tienes todo"
   missing vacío y time_min ≤ 20          → añadir 'rapida' · "Lista en {time_min} minutos"
   |missing| = 1                          → "Falta 1 ingrediente: {nombre}" (+ "(o {sustituto})" si aplica)
   |missing| ≥ 2                          → "Faltan {n} ingredientes"
```

Reglas de la interfaz que alimentan al matcher:
- El campo de texto resuelve alias → `ingredient_id` con búsqueda insensible a acentos y
  mayúsculas sobre `name` + `aliases`. Si el usuario escribe algo que no existe, se ofrece
  "Añadir «{texto}» igualmente" y se envía como `free_text[]`, que el matcher ignora pero se guarda
  en despensa como texto para que Nutri lo vea en el contexto (Fase 4).
- Si ningún resultado supera el umbral, la pantalla muestra "No encuentro nada redondo con esto"
  y el botón "Preguntar a Nutri" (plantilla M5).

### Casos de referencia

| Disponibles | Esperado |
|---|---|
| huevos, espinacas, arroz, tomate | 1º Arroz salteado con huevo y espinacas ("Tienes todo"), 2º Tortilla de espinacas ("Falta 1: cebolla (opcional)" → como cebolla es opcional, "Tienes todo"), 3º Ensalada de arroz y tomate ("Faltan 2") |
| huevos | no busca (mínimo 2) |
| pollo, arroz + usuario vegetariano | ninguna receta con pollo aparece aunque tenga cobertura 1.0 |
| puerro ausente pero cebolla presente en receta con sustitución puerro→cebolla | cuenta como cubierto por sustitución; etiqueta "Tienes todo (usa cebolla en vez de puerro)" |
