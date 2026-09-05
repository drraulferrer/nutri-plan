import type { Catalog, Ingredient, Preferences, Recipe, RecipeIngredient } from '../src/types';

export function ing(o: Partial<Ingredient> & Pick<Ingredient, 'slug' | 'name' | 'category'>): Ingredient {
  return {
    aliases: [],
    default_unit: 'g',
    is_staple: false,
    is_perishable: true,
    indivisible: false,
    allergens: [],
    ...o,
  };
}

const line = (ingredient: string, quantity: number, unit: RecipeIngredient['unit'], optional = false): RecipeIngredient => ({
  ingredient,
  quantity,
  unit,
  optional,
});

export function recipe(o: Partial<Recipe> & Pick<Recipe, 'slug' | 'meal_types' | 'protein_group'>): Recipe {
  return {
    name: o.slug,
    servings_base: 2,
    time_min: 25,
    tags: [],
    styles: ['mediterraneo'],
    allergens: [],
    cost_level: 'medio',
    batch_reuse: false,
    ingredients: [line('aceite-oliva', 1, 'cda'), line('sal', 1, 'pizca')],
    steps: ['Cocina.'],
    substitutions: [],
    pairs_with: [],
    ...o,
  };
}

export const INGREDIENTS: Ingredient[] = [
  ing({ slug: 'tomate', name: 'Tomate', category: 'verduras_fruta', default_unit: 'ud', grams_per_unit: 150, aliases: ['tomates'] }),
  ing({ slug: 'espinacas', name: 'Espinacas', category: 'verduras_fruta', package_size: 300, package_label: 'bolsa de 300 g', aliases: ['espinaca'] }),
  ing({ slug: 'cebolla', name: 'Cebolla', category: 'verduras_fruta', default_unit: 'ud', grams_per_unit: 150 }),
  ing({ slug: 'puerro', name: 'Puerro', category: 'verduras_fruta', default_unit: 'ud', grams_per_unit: 100 }),
  ing({ slug: 'calabacin', name: 'Calabacín', category: 'verduras_fruta', default_unit: 'ud', grams_per_unit: 250, aliases: ['zucchini'] }),
  ing({ slug: 'zanahoria', name: 'Zanahoria', category: 'verduras_fruta', default_unit: 'ud', grams_per_unit: 80 }),
  ing({ slug: 'patata', name: 'Patata', category: 'verduras_fruta', default_unit: 'g', package_size: 1000, package_label: 'bolsa de 1 kg' }),
  ing({ slug: 'platano', name: 'Plátano', category: 'verduras_fruta', default_unit: 'ud', indivisible: true }),
  ing({ slug: 'aguacate', name: 'Aguacate', category: 'verduras_fruta', default_unit: 'ud', indivisible: true }),
  ing({ slug: 'huevos', name: 'Huevos', category: 'proteinas', default_unit: 'ud', package_size: 6, package_label: 'media docena', indivisible: true, allergens: ['huevos'] }),
  ing({ slug: 'pollo', name: 'Pechuga de pollo', category: 'proteinas', package_size: 500, package_label: 'bandeja de 500 g' }),
  ing({ slug: 'ternera', name: 'Ternera para guisar', category: 'proteinas', package_size: 500, package_label: 'bandeja de 500 g' }),
  ing({ slug: 'atun', name: 'Atún en conserva', category: 'proteinas', package_size: 80, package_label: 'lata de 80 g', is_perishable: false, allergens: ['pescado'] }),
  ing({ slug: 'merluza', name: 'Merluza', category: 'congelados', package_size: 400, package_label: 'bolsa de 400 g', allergens: ['pescado'] }),
  ing({ slug: 'lentejas', name: 'Lentejas pardinas', category: 'despensa', package_size: 500, package_label: 'paquete de 500 g', is_perishable: false }),
  ing({ slug: 'garbanzos-cocidos', name: 'Garbanzos cocidos', category: 'despensa', package_size: 400, package_label: 'bote de 400 g', is_perishable: false }),
  ing({ slug: 'tofu', name: 'Tofu', category: 'proteinas', package_size: 250, package_label: 'bloque de 250 g', allergens: ['soja'] }),
  ing({ slug: 'yogur', name: 'Yogur natural', category: 'lacteos', default_unit: 'ud', package_size: 4, package_label: 'pack de 4', indivisible: true, allergens: ['lacteos'] }),
  ing({ slug: 'leche', name: 'Leche', category: 'lacteos', default_unit: 'ml', package_size: 1000, package_label: 'brick de 1 l', allergens: ['lacteos'] }),
  ing({ slug: 'queso', name: 'Queso curado', category: 'lacteos', package_size: 250, package_label: 'cuña de 250 g', allergens: ['lacteos'] }),
  ing({ slug: 'arroz', name: 'Arroz', category: 'despensa', package_size: 1000, package_label: 'paquete de 1 kg', is_perishable: false }),
  ing({ slug: 'pasta', name: 'Pasta', category: 'despensa', package_size: 500, package_label: 'paquete de 500 g', is_perishable: false, allergens: ['gluten'] }),
  ing({ slug: 'pan', name: 'Pan', category: 'otros', default_unit: 'ud', allergens: ['gluten'] }),
  ing({ slug: 'avena', name: 'Copos de avena', category: 'despensa', package_size: 500, package_label: 'paquete de 500 g', is_perishable: false, allergens: ['gluten'] }),
  ing({ slug: 'maiz', name: 'Maíz en conserva', category: 'despensa', package_size: 150, package_label: 'lata de 150 g', is_perishable: false }),
  ing({ slug: 'aceite-oliva', name: 'Aceite de oliva', category: 'despensa', default_unit: 'ml', package_size: 1000, package_label: 'botella de 1 l', is_staple: true, is_perishable: false }),
  ing({ slug: 'sal', name: 'Sal', category: 'despensa', is_staple: true, is_perishable: false }),
  ing({ slug: 'ajo', name: 'Ajo', category: 'despensa', default_unit: 'ud', grams_per_unit: 5, is_staple: true, is_perishable: false }),
];

const veg: Recipe['styles'] = ['mediterraneo', 'vegetariano'];
const vegan: Recipe['styles'] = ['mediterraneo', 'vegetariano', 'vegano', 'sin_lactosa'];
const veganGf: Recipe['styles'] = ['mediterraneo', 'vegetariano', 'vegano', 'sin_lactosa', 'sin_gluten'];
const gf: Recipe['styles'] = ['mediterraneo', 'sin_gluten', 'sin_lactosa'];

export const RECIPES: Recipe[] = [
  // Desayunos
  recipe({ slug: 'yogur-avena', name: 'Yogur con avena', meal_types: ['desayuno', 'tentempie'], protein_group: 'lacteo', time_min: 5, styles: veg, allergens: ['lacteos', 'gluten'], ingredients: [line('yogur', 2, 'ud'), line('avena', 60, 'g'), line('platano', 1, 'ud')], cost_level: 'bajo' }),
  recipe({ slug: 'tostada-tomate', name: 'Tostada con tomate', meal_types: ['desayuno'], protein_group: 'ninguno', time_min: 5, styles: vegan, allergens: ['gluten'], ingredients: [line('pan', 2, 'ud'), line('tomate', 1, 'ud'), line('aceite-oliva', 1, 'cda')], cost_level: 'bajo' }),
  recipe({ slug: 'porridge-platano', name: 'Porridge de plátano', meal_types: ['desayuno'], protein_group: 'ninguno', time_min: 10, styles: vegan, allergens: ['gluten'], ingredients: [line('avena', 80, 'g'), line('platano', 1, 'ud')], cost_level: 'bajo' }),
  recipe({ slug: 'huevos-revueltos', name: 'Huevos revueltos', meal_types: ['desayuno'], protein_group: 'huevo', time_min: 10, styles: ['mediterraneo', 'vegetariano', 'sin_gluten', 'sin_lactosa'], allergens: ['huevos'], ingredients: [line('huevos', 4, 'ud'), line('aceite-oliva', 1, 'cda')] }),
  recipe({ slug: 'fruta-yogur', name: 'Fruta con yogur', meal_types: ['desayuno', 'tentempie'], protein_group: 'lacteo', time_min: 5, styles: ['mediterraneo', 'vegetariano', 'sin_gluten'], allergens: ['lacteos'], ingredients: [line('yogur', 2, 'ud'), line('platano', 2, 'ud')], cost_level: 'bajo' }),
  recipe({ slug: 'batido-leche', name: 'Batido de plátano', meal_types: ['desayuno'], protein_group: 'lacteo', time_min: 5, styles: ['mediterraneo', 'vegetariano', 'sin_gluten'], allergens: ['lacteos'], ingredients: [line('leche', 400, 'ml'), line('platano', 2, 'ud')] }),
  recipe({ slug: 'tortitas-avena', name: 'Tortitas de avena', meal_types: ['desayuno'], protein_group: 'huevo', time_min: 15, styles: veg, allergens: ['huevos', 'gluten'], ingredients: [line('huevos', 2, 'ud'), line('avena', 100, 'g'), line('platano', 1, 'ud')] }),
  recipe({ slug: 'tostada-aguacate', name: 'Tostada de aguacate', meal_types: ['desayuno'], protein_group: 'ninguno', time_min: 5, styles: vegan, allergens: ['gluten'], ingredients: [line('pan', 2, 'ud'), line('aguacate', 1, 'ud')] }),
  recipe({ slug: 'fruta-sola', name: 'Fruta de temporada', meal_types: ['desayuno', 'tentempie'], protein_group: 'ninguno', time_min: 2, styles: veganGf, ingredients: [line('platano', 2, 'ud')], cost_level: 'bajo' }),
  // Comidas
  recipe({ slug: 'lentejas-verduras', name: 'Lentejas con verduras', meal_types: ['comida', 'cena'], protein_group: 'legumbre', time_min: 40, active_time_min: 15, styles: veganGf, batch_reuse: true, pairs_with: ['ensalada-lentejas'], tags: ['batch'], cost_level: 'bajo', ingredients: [line('lentejas', 250, 'g'), line('zanahoria', 2, 'ud'), line('puerro', 1, 'ud'), line('ajo', 2, 'diente'), line('aceite-oliva', 2, 'cda')] }),
  recipe({ slug: 'arroz-pollo', name: 'Arroz con pollo', meal_types: ['comida'], protein_group: 'pollo', time_min: 35, styles: gf, ingredients: [line('arroz', 200, 'g'), line('pollo', 300, 'g'), line('cebolla', 1, 'ud'), line('tomate', 2, 'ud')] }),
  recipe({ slug: 'garbanzos-espinacas', name: 'Garbanzos con espinacas', meal_types: ['comida', 'cena'], protein_group: 'legumbre', time_min: 20, styles: veganGf, cost_level: 'bajo', ingredients: [line('garbanzos-cocidos', 400, 'g'), line('espinacas', 200, 'g'), line('ajo', 2, 'diente')] }),
  recipe({ slug: 'tofu-salteado', name: 'Tofu salteado', meal_types: ['comida', 'cena'], protein_group: 'tofu', time_min: 20, styles: veganGf, allergens: ['soja'], ingredients: [line('tofu', 250, 'g'), line('calabacin', 1, 'ud'), line('zanahoria', 1, 'ud'), line('arroz', 150, 'g')] }),
  recipe({ slug: 'pollo-plancha', name: 'Pollo a la plancha con ensalada', meal_types: ['comida', 'cena'], protein_group: 'pollo', time_min: 20, styles: gf, ingredients: [line('pollo', 300, 'g'), line('tomate', 2, 'ud')] }),
  recipe({ slug: 'pasta-atun', name: 'Pasta con atún', meal_types: ['comida'], protein_group: 'pescado', time_min: 20, styles: ['mediterraneo', 'sin_lactosa'], allergens: ['gluten', 'pescado'], cost_level: 'bajo', ingredients: [line('pasta', 200, 'g'), line('atun', 2, 'lata'), line('tomate', 2, 'ud')] }),
  recipe({ slug: 'arroz-verduras', name: 'Arroz con verduras', meal_types: ['comida'], protein_group: 'ninguno', time_min: 30, styles: veganGf, cost_level: 'bajo', ingredients: [line('arroz', 200, 'g'), line('calabacin', 1, 'ud'), line('zanahoria', 1, 'ud'), line('cebolla', 1, 'ud')] }),
  recipe({ slug: 'tortilla-patata', name: 'Tortilla de patata', meal_types: ['comida', 'cena'], protein_group: 'huevo', time_min: 40, styles: ['mediterraneo', 'vegetariano', 'sin_gluten', 'sin_lactosa'], allergens: ['huevos'], cost_level: 'bajo', ingredients: [line('huevos', 5, 'ud'), line('patata', 500, 'g'), line('cebolla', 1, 'ud')] }),
  recipe({ slug: 'merluza-horno', name: 'Merluza al horno', meal_types: ['comida', 'cena'], protein_group: 'pescado', time_min: 30, styles: gf, allergens: ['pescado'], cost_level: 'alto', ingredients: [line('merluza', 400, 'g'), line('patata', 400, 'g')] }),
  recipe({ slug: 'guiso-ternera', name: 'Guiso de ternera', meal_types: ['comida'], protein_group: 'carne_roja', time_min: 70, active_time_min: 20, styles: gf, cost_level: 'alto', batch_reuse: true, ingredients: [line('ternera', 500, 'g'), line('patata', 400, 'g'), line('zanahoria', 2, 'ud')] }),
  recipe({ slug: 'ensalada-lentejas', name: 'Ensalada de lentejas', meal_types: ['comida', 'cena'], protein_group: 'legumbre', time_min: 10, styles: veganGf, tags: ['aprovechamiento'], cost_level: 'bajo', ingredients: [line('lentejas', 150, 'g'), line('tomate', 2, 'ud'), line('cebolla', 0.5, 'ud')] }),
  recipe({ slug: 'pasta-queso', name: 'Pasta con queso y calabacín', meal_types: ['comida'], protein_group: 'lacteo', time_min: 25, styles: veg, allergens: ['gluten', 'lacteos'], ingredients: [line('pasta', 200, 'g'), line('queso', 80, 'g'), line('calabacin', 1, 'ud')] }),
  // Cenas
  recipe({ slug: 'tortilla-espinacas', name: 'Tortilla de espinacas', meal_types: ['cena'], protein_group: 'huevo', time_min: 15, styles: ['mediterraneo', 'vegetariano', 'sin_gluten', 'sin_lactosa'], allergens: ['huevos'], cost_level: 'bajo', ingredients: [line('huevos', 4, 'ud'), line('espinacas', 200, 'g'), line('cebolla', 0.5, 'ud', true), line('aceite-oliva', 1, 'cda')], substitutions: [{ ingredient: 'espinacas', with: 'calabacin' }] }),
  recipe({ slug: 'arroz-salteado-huevo', name: 'Arroz salteado con huevo y espinacas', meal_types: ['cena'], protein_group: 'huevo', time_min: 20, styles: ['mediterraneo', 'vegetariano', 'sin_gluten', 'sin_lactosa'], allergens: ['huevos'], cost_level: 'bajo', ingredients: [line('arroz', 200, 'g'), line('huevos', 2, 'ud'), line('espinacas', 150, 'g'), line('tomate', 1, 'ud'), line('aceite-oliva', 1, 'cda')] }),
  recipe({ slug: 'ensalada-arroz-tomate', name: 'Ensalada de arroz y tomate', meal_types: ['cena'], protein_group: 'pescado', time_min: 15, styles: gf, allergens: ['pescado'], ingredients: [line('arroz', 150, 'g'), line('tomate', 2, 'ud'), line('atun', 2, 'lata'), line('maiz', 1, 'lata')] }),
  recipe({ slug: 'crema-puerro', name: 'Crema de puerro y patata', meal_types: ['cena'], protein_group: 'ninguno', time_min: 25, styles: veganGf, cost_level: 'bajo', ingredients: [line('puerro', 2, 'ud'), line('patata', 300, 'g'), line('aceite-oliva', 1, 'cda')], substitutions: [{ ingredient: 'puerro', with: 'cebolla' }] }),
  recipe({ slug: 'crema-calabacin', name: 'Crema de calabacín', meal_types: ['cena'], protein_group: 'ninguno', time_min: 20, styles: veganGf, cost_level: 'bajo', ingredients: [line('calabacin', 2, 'ud'), line('cebolla', 1, 'ud'), line('patata', 200, 'g')] }),
  recipe({ slug: 'tostada-queso', name: 'Tostada de queso y tomate', meal_types: ['cena'], protein_group: 'lacteo', time_min: 10, styles: veg, allergens: ['gluten', 'lacteos'], ingredients: [line('pan', 2, 'ud'), line('queso', 60, 'g'), line('tomate', 1, 'ud')] }),
  recipe({ slug: 'sopa-pollo', name: 'Sopa de pollo', meal_types: ['cena'], protein_group: 'pollo', time_min: 30, styles: gf, ingredients: [line('pollo', 200, 'g'), line('zanahoria', 1, 'ud'), line('puerro', 1, 'ud')] }),
  recipe({ slug: 'revuelto-tofu', name: 'Revuelto de tofu', meal_types: ['cena'], protein_group: 'tofu', time_min: 15, styles: veganGf, allergens: ['soja'], ingredients: [line('tofu', 200, 'g'), line('espinacas', 100, 'g'), line('tomate', 1, 'ud')] }),
  recipe({ slug: 'pisto', name: 'Pisto', meal_types: ['cena'], protein_group: 'ninguno', time_min: 30, styles: veganGf, cost_level: 'bajo', ingredients: [line('calabacin', 1, 'ud'), line('tomate', 3, 'ud'), line('cebolla', 1, 'ud')] }),
  recipe({ slug: 'sandwich-pollo', name: 'Sándwich de pollo', meal_types: ['cena'], protein_group: 'pollo', time_min: 10, styles: ['mediterraneo', 'sin_lactosa'], allergens: ['gluten'], ingredients: [line('pan', 4, 'ud'), line('pollo', 150, 'g'), line('tomate', 1, 'ud')] }),
  recipe({ slug: 'merluza-plancha', name: 'Merluza a la plancha', meal_types: ['cena'], protein_group: 'pescado', time_min: 15, styles: gf, allergens: ['pescado'], ingredients: [line('merluza', 300, 'g'), line('tomate', 2, 'ud')] }),
];

export function makeCatalog(recipes: Recipe[] = RECIPES, ingredients: Ingredient[] = INGREDIENTS): Catalog {
  return {
    ingredients: new Map(ingredients.map((i) => [i.slug, i])),
    recipes: new Map(recipes.map((r) => [r.slug, r])),
  };
}

export const CATALOG = makeCatalog();

export function prefs(o: Partial<Preferences> = {}): Preferences {
  return {
    people: 2,
    days: 7,
    include_snacks: false,
    cook_time: '30',
    budget: 'medio',
    styles: ['mediterraneo'],
    allergens: [],
    allergens_confirmed: true,
    disliked_ingredients: [],
    ...o,
  };
}

/** PRNG determinista para tests de propiedad sin dependencias externas. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
