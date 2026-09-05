# 07 · Recetario base

El recetario es el activo más importante de la v1: la calidad del menú y de la lista depende de
él, no de la IA. Se escribe **antes** de programar la generación.

## Distribución (55 recetas)

| Bloque | Nº | Criterios |
|---|---|---|
| Comidas de diario | 15 | ≤ 30 min, `meal_types: [comida, cena]`, coste bajo/medio, al menos 5 vegetarianas |
| Batch cooking | 10 | `batch_reuse: true`, `active_time_min` ≤ 40, se conservan 3–4 días o congelan, pensadas para aparecer dos veces (comida + cena de otro día o "aprovechamiento") |
| Cenas sencillas | 10 | ≤ 20 min, `meal_types: [cena]`, ≤ 6 ingredientes, al menos 4 sin horno |
| Vegetarianas | 10 | `styles ⊇ {vegetariano}`, al menos 4 veganas, proteína vegetal identificable (legumbre, tofu, huevo, lácteo) |
| Aprovechamiento | 5 | Reutilizan restos típicos del recetario: arroz cocido, legumbre cocida, verdura asada, pan duro, pollo asado |
| Desayunos | 5 | ≤ 10 min, `meal_types: [desayuno]`, al menos 2 sin lácteos y 1 sin gluten |

Además, para que el planificador funcione bien con restricciones combinadas, hay **mínimos
transversales** (pueden solaparse con los bloques):

- ≥ 12 recetas `sin_gluten` compatibles (o con sustitución declarada).
- ≥ 12 recetas `sin_lactosa` compatibles.
- ≥ 8 recetas veganas.
- ≥ 6 recetas por cada `protein_group`: legumbre, huevo, pollo, pescado, tofu/soja, lácteo.
- ≥ 20 recetas con `cost_level: bajo`.
- Ningún ingrediente principal aparece en más de 8 recetas (evitar menús monótonos).

## Formato: un fichero YAML por receta

`data/recipes/<slug>.yaml`. Validado en CI con el esquema Zod de `packages/core/schemas.ts`.

```yaml
slug: lentejas-con-verduras
name: Lentejas con verduras
description: Guiso de lentejas pardinas con zanahoria, puerro y pimentón. Rinde para dos días.
servings_base: 2
time_min: 40
active_time_min: 15
meal_types: [comida, cena]
tags: [batch, economica, una_olla, sin_horno]
styles: [mediterraneo, vegetariano, vegano, sin_gluten, sin_lactosa]
allergens: []                 # se contrastan con los derivados de los ingredientes
cost_level: bajo
protein_group: legumbre
batch_reuse: true

ingredients:
  - { ingredient: lentejas-pardinas, quantity: 250, unit: g }
  - { ingredient: zanahoria,         quantity: 2,   unit: ud }
  - { ingredient: puerro,            quantity: 1,   unit: ud }
  - { ingredient: pimiento-verde,    quantity: 1,   unit: ud }
  - { ingredient: tomate-triturado,  quantity: 200, unit: g }
  - { ingredient: ajo,               quantity: 2,   unit: diente }
  - { ingredient: pimenton-dulce,    quantity: 1,   unit: cdta }
  - { ingredient: laurel,            quantity: 1,   unit: ud, optional: true }
  - { ingredient: aceite-oliva,      quantity: 2,   unit: cda }
  - { ingredient: sal,               quantity: 1,   unit: pizca }

steps:
  - Pica la zanahoria, el puerro y el pimiento en dados pequeños.
  - Sofríe las verduras con el aceite 5 minutos a fuego medio. Añade el ajo y el pimentón, remueve 30 segundos.
  - Incorpora el tomate, las lentejas lavadas, el laurel y 750 ml de agua. Sal al gusto.
  - Cocina a fuego suave 30 minutos con la olla tapada, hasta que las lentejas estén tiernas. Rectifica de agua si se secan.
  - Deja reposar 5 minutos antes de servir.

substitutions:
  - { ingredient: puerro,           with: cebolla,           note: misma cantidad }
  - { ingredient: lentejas-pardinas, with: garbanzos-cocidos, note: "usa 400 g cocidos y reduce la cocción a 15 min" }
  - { ingredient: pimiento-verde,   with: calabacin }

tip: Haz ración doble y congela la mitad en porciones. Con el resto puedes preparar la ensalada de lentejas del recetario.
pairs_with: [ensalada-de-lentejas]    # recetas de aprovechamiento que usan sus restos
author: Raúl Ferrer
license: CC-BY-NC-SA-4.0
```

### Reglas del formato

- `ingredient` referencia el `slug` de `data/ingredients.yaml` (catálogo único). Si no existe, el
  import falla: obliga a mantener el catálogo y los sinónimos.
- Cantidades siempre para `servings_base` (2). Sin decimales raros: 0,5 · 1 · 1,5 · 2 …
- `steps`: frases imperativas, una acción por paso, con tiempos y señales ("hasta que dore").
  Máximo 8 pasos.
- `styles` lista solo compatibilidades **sin sustituir**. Si una receta es sin gluten solo cambiando
  un ingrediente, no lleva `sin_gluten` en `styles`; lleva la sustitución.
- `allergens` los declara el autor; el import calcula los derivados de los ingredientes no
  opcionales y falla si el autor declaró menos.
- Lenguaje: sin "light", "sano", "permitido", "pecado". Nada de calorías ni gramos de macros.

## Catálogo de ingredientes (`data/ingredients.yaml`)

```yaml
- slug: espinacas
  name: Espinacas
  aliases: [espinaca, spinach, espinacas frescas]
  category: verduras_fruta
  default_unit: g
  package_size: 300
  package_label: bolsa de 300 g
  is_perishable: true
- slug: huevos
  name: Huevos
  aliases: [huevo]
  category: proteinas
  default_unit: ud
  package_size: 6
  package_label: media docena
  allergens: [huevos]
  is_perishable: true
- slug: aceite-oliva
  name: Aceite de oliva virgen extra
  aliases: [aceite, aove, aceite de oliva]
  category: despensa
  default_unit: ml
  package_size: 1000
  package_label: botella de 1 l
  is_staple: true
  is_perishable: false
```

Objetivo inicial: ~150 ingredientes. Los `is_staple` de partida: sal, pimienta, aceite de oliva,
vinagre, ajo, agua, azúcar, orégano, pimentón, laurel, comino.

## Dos ejemplos más (formato abreviado)

**Cena sencilla**
```yaml
slug: tortilla-de-espinacas
name: Tortilla de espinacas
servings_base: 2 · time_min: 15 · meal_types: [cena] · tags: [rapida, sin_horno, economica]
styles: [mediterraneo, vegetariano, sin_gluten, sin_lactosa] · allergens: [huevos] · protein_group: huevo
ingredients: huevos 4 ud · espinacas 200 g · cebolla 0.5 ud (optional) · aceite-oliva 1 cda · sal 1 pizca
substitutions: espinacas → calabacin (rallado y escurrido) · espinacas → acelgas
tip: Sirve con tomate cortado y un chorrito de aceite.
```

**Desayuno**
```yaml
slug: yogur-con-fruta-y-avena
name: Yogur con fruta y avena
servings_base: 2 · time_min: 5 · meal_types: [desayuno, tentempie] · tags: [rapida, sin_cocinar]
styles: [mediterraneo, vegetariano] · allergens: [lacteos, gluten] · protein_group: lacteo
ingredients: yogur-natural 2 ud · avena-copos 60 g · platano 1 ud · nueces 20 g (optional) · canela 1 pizca (optional)
substitutions: yogur-natural → yogur-soja (sin lácteos) · avena-copos → copos-maiz-sin-gluten · platano → cualquier fruta de temporada
```

## Proceso de redacción

1. Rellenar primero `data/ingredients.yaml` con los ~150 ingredientes (categoría, unidad, envase).
2. Escribir las 55 recetas en YAML. Cada una tarda ~10 minutos si ya se tiene la receta.
3. `npm run recipes:check` → valida esquema, ingredientes existentes, alérgenos, mínimos
   transversales y muestra la matriz de cobertura (por comida × estilo × tiempo).
4. `npm run recipes:seed` → carga en Supabase (Fase 2) o genera `apps/web/public/recipes.json`
   (Fase 1).

## Checklist de revisión por receta

- [ ] Se puede cocinar de verdad en `time_min` con los pasos descritos.
- [ ] Ingredientes fáciles de encontrar en un supermercado español; cantidades coherentes con envases.
- [ ] Al menos una sustitución para el ingrediente más "raro" o más caro.
- [ ] Alérgenos declarados coinciden con los ingredientes.
- [ ] Sin lenguaje moralizante ni claims de salud.
- [ ] Nombre reconocible (no "bowl energético"), ≤ 40 caracteres.
- [ ] Si es batch: indica conservación y con qué receta se aprovecha.
