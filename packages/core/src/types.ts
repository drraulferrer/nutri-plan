/**
 * Tipos del dominio. Los nombres de campo coinciden con el YAML del recetario y con las
 * columnas de PostgreSQL (snake_case) para evitar capas de mapeo. Ver docs/05 y docs/07.
 */

export type MealType = 'desayuno' | 'comida' | 'cena' | 'tentempie';
export type CookTime = '15' | '30' | '45' | '60+';
export type Budget = 'ajustado' | 'medio' | 'flexible';
export type CostLevel = 'bajo' | 'medio' | 'alto';
export type DietStyle =
  | 'mediterraneo'
  | 'vegetariano'
  | 'vegano'
  | 'flexitariano'
  | 'sin_gluten'
  | 'sin_lactosa';
export type ShopCategory =
  | 'verduras_fruta'
  | 'proteinas'
  | 'lacteos'
  | 'despensa'
  | 'congelados'
  | 'otros';
export type CanonicalUnit = 'g' | 'ml' | 'ud';
export type Unit =
  | CanonicalUnit
  | 'kg'
  | 'l'
  | 'cda'
  | 'cdta'
  | 'taza'
  | 'pizca'
  | 'manojo'
  | 'diente'
  | 'rebanada'
  | 'lata'
  | 'bote'
  | 'brick'
  | 'paquete';
export type Allergen =
  | 'gluten'
  | 'crustaceos'
  | 'huevos'
  | 'pescado'
  | 'cacahuetes'
  | 'soja'
  | 'lacteos'
  | 'frutos_cascara'
  | 'apio'
  | 'mostaza'
  | 'sesamo'
  | 'sulfitos'
  | 'altramuces'
  | 'moluscos';
export type ProteinGroup =
  | 'legumbre'
  | 'huevo'
  | 'pollo'
  | 'pescado'
  | 'tofu'
  | 'lacteo'
  | 'carne_roja'
  | 'ninguno';

export interface Ingredient {
  slug: string;
  name: string;
  aliases: string[];
  category: ShopCategory;
  default_unit: CanonicalUnit;
  grams_per_unit?: number;
  package_size?: number;
  package_label?: string;
  is_staple: boolean;
  is_perishable: boolean;
  indivisible: boolean;
  allergens: Allergen[];
}

export interface RecipeIngredient {
  ingredient: string;
  quantity: number;
  unit: Unit;
  optional: boolean;
  note?: string;
}

export interface Substitution {
  ingredient: string;
  with: string;
  note?: string;
}

export interface Recipe {
  slug: string;
  name: string;
  description?: string;
  servings_base: number;
  time_min: number;
  active_time_min?: number;
  meal_types: MealType[];
  tags: string[];
  styles: DietStyle[];
  allergens: Allergen[];
  cost_level: CostLevel;
  protein_group: ProteinGroup;
  batch_reuse: boolean;
  ingredients: RecipeIngredient[];
  steps: string[];
  substitutions: Substitution[];
  tip?: string;
  pairs_with: string[];
  author?: string;
  license?: string;
}

export interface Preferences {
  people: number;
  days: 5 | 7;
  include_snacks: boolean;
  cook_time: CookTime;
  budget: Budget;
  styles: DietStyle[];
  allergens: Allergen[];
  allergens_confirmed: boolean;
  disliked_ingredients: string[];
  other_restrictions?: string;
  /** Menús con ayuda de la IA cuando el servidor lo permite (Fase 3). */
  use_ai?: boolean;
}

export interface MenuSlot {
  day_index: number;
  meal: MealType;
  recipe_slug: string | null;
  servings: number;
  alternatives: string[];
  is_locked: boolean;
}

export type WarningType = 'time' | 'budget' | 'variety' | 'no_candidates' | 'ia_fallback';

export interface PlannerWarning {
  day_index: number;
  meal: MealType;
  type: WarningType;
  detail: string;
}

export interface Menu {
  week_start: string;
  days: 5 | 7;
  people: number;
  seed: string;
  slots: MenuSlot[];
  warnings: PlannerWarning[];
  /** Frase de organización de la semana cuando el menú lo generó la IA (docs/08). */
  notes?: string;
}

export interface ShoppingItem {
  ingredient: string;
  name: string;
  category: ShopCategory;
  needed_qty: number;
  unit: CanonicalUnit;
  buy_qty: number;
  buy_label: string;
  source_slots: string[];
  is_staple: boolean;
  checked: boolean;
  have_it: boolean;
}

export interface ShoppingList {
  people: number;
  items: ShoppingItem[];
}

export type Catalog = {
  ingredients: ReadonlyMap<string, Ingredient>;
  recipes: ReadonlyMap<string, Recipe>;
};
