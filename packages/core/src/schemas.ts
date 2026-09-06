import { z } from 'zod';

export const MEAL_TYPES = ['desayuno', 'comida', 'cena', 'tentempie'] as const;
export const COOK_TIMES = ['15', '30', '45', '60+'] as const;
export const BUDGETS = ['ajustado', 'medio', 'flexible'] as const;
export const COST_LEVELS = ['bajo', 'medio', 'alto'] as const;
export const DIET_STYLES = [
  'mediterraneo',
  'vegetariano',
  'vegano',
  'flexitariano',
  'sin_gluten',
  'sin_lactosa',
] as const;
export const SHOP_CATEGORIES = [
  'verduras_fruta',
  'proteinas',
  'lacteos',
  'despensa',
  'congelados',
  'otros',
] as const;
export const CANONICAL_UNITS = ['g', 'ml', 'ud'] as const;
export const UNITS = [
  ...CANONICAL_UNITS,
  'kg',
  'l',
  'cda',
  'cdta',
  'taza',
  'pizca',
  'manojo',
  'diente',
  'rebanada',
  'lata',
  'bote',
  'brick',
  'paquete',
] as const;
/** Los 14 alérgenos de declaración obligatoria en la UE (Reglamento 1169/2011). */
export const ALLERGENS = [
  'gluten',
  'crustaceos',
  'huevos',
  'pescado',
  'cacahuetes',
  'soja',
  'lacteos',
  'frutos_cascara',
  'apio',
  'mostaza',
  'sesamo',
  'sulfitos',
  'altramuces',
  'moluscos',
] as const;
export const PROTEIN_GROUPS = [
  'legumbre',
  'huevo',
  'pollo',
  'pescado',
  'tofu',
  'lacteo',
  'carne_roja',
  'ninguno',
] as const;

const slug = z
  .string()
  .min(2)
  .max(60)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug en minúsculas con guiones');

export const IngredientSchema = z.object({
  slug,
  name: z.string().min(1).max(60),
  aliases: z.array(z.string().min(1)).default([]),
  category: z.enum(SHOP_CATEGORIES),
  default_unit: z.enum(CANONICAL_UNITS),
  grams_per_unit: z.number().positive().optional(),
  package_size: z.number().positive().optional(),
  package_label: z.string().min(1).optional(),
  is_staple: z.boolean().default(false),
  is_perishable: z.boolean().default(true),
  indivisible: z.boolean().default(false),
  allergens: z.array(z.enum(ALLERGENS)).default([]),
});

export const RecipeIngredientSchema = z.object({
  ingredient: slug,
  quantity: z.number().positive(),
  unit: z.enum(UNITS),
  optional: z.boolean().default(false),
  note: z.string().max(80).optional(),
});

export const SubstitutionSchema = z.object({
  ingredient: slug,
  with: slug,
  note: z.string().max(120).optional(),
});

export const RecipeSchema = z.object({
  slug,
  name: z.string().min(3).max(40),
  description: z.string().max(200).optional(),
  servings_base: z.number().int().positive().default(2),
  time_min: z.number().int().positive().max(240),
  active_time_min: z.number().int().positive().optional(),
  meal_types: z.array(z.enum(MEAL_TYPES)).min(1),
  tags: z.array(z.string().min(1)).default([]),
  styles: z.array(z.enum(DIET_STYLES)).default([]),
  allergens: z.array(z.enum(ALLERGENS)).default([]),
  cost_level: z.enum(COST_LEVELS).default('medio'),
  protein_group: z.enum(PROTEIN_GROUPS),
  batch_reuse: z.boolean().default(false),
  ingredients: z.array(RecipeIngredientSchema).min(1),
  steps: z.array(z.string().min(1)).min(1).max(8),
  substitutions: z.array(SubstitutionSchema).default([]),
  tip: z.string().max(240).optional(),
  pairs_with: z.array(slug).default([]),
  author: z.string().optional(),
  license: z.string().optional(),
});

export const PreferencesSchema = z.object({
  people: z.number().int().min(1).max(8).default(2),
  days: z.union([z.literal(5), z.literal(7)]).default(7),
  include_snacks: z.boolean().default(false),
  cook_time: z.enum(COOK_TIMES).default('30'),
  budget: z.enum(BUDGETS).default('medio'),
  styles: z.array(z.enum(DIET_STYLES)).default(['mediterraneo']),
  allergens: z.array(z.enum(ALLERGENS)).default([]),
  allergens_confirmed: z.boolean().default(false),
  disliked_ingredients: z.array(slug).default([]),
  other_restrictions: z.string().max(200).optional(),
  use_ai: z.boolean().optional(),
});

/** Documentos de estado que viajan entre app y servidor (docs/06). */
export const MenuSlotSchema = z.object({
  day_index: z.number().int().min(0).max(6),
  meal: z.enum(MEAL_TYPES),
  recipe_slug: slug.nullable(),
  servings: z.number().int().min(1).max(8),
  alternatives: z.array(slug).max(4),
  is_locked: z.boolean(),
});

export const PlannerWarningSchema = z.object({
  day_index: z.number().int().min(-1).max(6),
  meal: z.enum(MEAL_TYPES),
  type: z.enum(['time', 'budget', 'variety', 'no_candidates', 'ia_fallback', 'ia_repaired']),
  detail: z.string().max(120),
});

export const MenuSchema = z.object({
  week_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  days: z.union([z.literal(5), z.literal(7)]),
  people: z.number().int().min(1).max(8),
  seed: z.string().max(64),
  slots: z.array(MenuSlotSchema).max(28),
  warnings: z.array(PlannerWarningSchema).max(64),
  notes: z.string().max(240).optional(),
});

export const ShoppingItemSchema = z.object({
  ingredient: slug,
  name: z.string().max(60),
  category: z.enum(SHOP_CATEGORIES),
  needed_qty: z.number().nonnegative(),
  unit: z.enum(CANONICAL_UNITS),
  buy_qty: z.number().nonnegative(),
  buy_label: z.string().max(60),
  source_slots: z.array(z.string().max(20)).max(28),
  is_staple: z.boolean(),
  checked: z.boolean(),
  have_it: z.boolean(),
});

export const ShoppingListSchema = z.object({
  people: z.number().int().min(1).max(8),
  items: z.array(ShoppingItemSchema).max(300),
});

export const StatePatchSchema = z.object({
  preferences: PreferencesSchema.optional(),
  menu: MenuSchema.nullable().optional(),
  shopping_list: ShoppingListSchema.nullable().optional(),
  pantry: z.array(slug).max(200).optional(),
  favorites: z.array(slug).max(200).optional(),
});

export type IngredientInput = z.input<typeof IngredientSchema>;
export type RecipeInput = z.input<typeof RecipeSchema>;
export type PreferencesInput = z.input<typeof PreferencesSchema>;
