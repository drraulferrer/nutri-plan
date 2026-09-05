# 05 · Modelo de datos

PostgreSQL (Supabase). Principio: **guardar lo mínimo**. Ningún campo de peso, calorías,
objetivos ni salud.

> **Revisión Fase 2 (2026-09-05).** El esquema aplicado (`supabase/migrations/0001_init.sql`)
> sigue este documento con dos simplificaciones (decisión T-15, doc 00): el menú y la lista se
> guardan como **documentos JSONB** (`menus.data`, `shopping_lists.data`) con la forma exacta de
> `core`, y despensa, favoritos e ingredientes que no gustan usan **slugs** en lugar de UUID. Las
> tablas `menu_slots` y `shopping_items` descritas más abajo no existen todavía; se crearán si
> hace falta analítica por receta. El catálogo sí está normalizado (`recipes`, `ingredients`,
> `recipe_ingredients`, clave `slug`) y además guarda el documento completo en `data`.

## Diagrama

```
profiles 1──1 preferences
   │
   ├──* menus 1──* menu_slots *──1 recipes 1──* recipe_ingredients *──1 ingredients
   │       │
   │       └──1 shopping_lists 1──* shopping_items ──1 ingredients
   ├──* pantry_items ──1 ingredients
   ├──* favorites ──1 recipes
   └──* events
```

## Tipos enumerados

```sql
create type meal_type       as enum ('desayuno','comida','cena','tentempie');
create type cook_time       as enum ('15','30','45','60+');
create type budget_level    as enum ('ajustado','medio','flexible');
create type cost_level      as enum ('bajo','medio','alto');
create type diet_style      as enum ('mediterraneo','vegetariano','vegano','flexitariano','sin_gluten','sin_lactosa');
create type shop_category   as enum ('verduras_fruta','proteinas','lacteos','despensa','congelados','otros');
create type unit_code       as enum ('g','kg','ml','l','ud','cda','cdta','taza','pizca','manojo','diente','rebanada','lata','bote','brick','paquete');
create type allergen        as enum (
  'gluten','crustaceos','huevos','pescado','cacahuetes','soja','lacteos','frutos_cascara',
  'apio','mostaza','sesamo','sulfitos','altramuces','moluscos');            -- 14 UE, Reg. 1169/2011
create type menu_source     as enum ('reglas','ia');
```

## Tablas de usuario

```sql
create table profiles (
  id                uuid primary key default gen_random_uuid(),
  telegram_user_id  bigint not null unique,
  language_code     text,                         -- 'es', para futuro i18n
  created_at        timestamptz not null default now(),
  last_seen_at      timestamptz not null default now(),
  deleted_at        timestamptz                   -- borrado lógico 30 días antes del físico
);

create table preferences (
  profile_id            uuid primary key references profiles(id) on delete cascade,
  people                smallint not null default 2 check (people between 1 and 8),
  days                  smallint not null default 7 check (days in (5,7)),
  include_snacks        boolean  not null default false,
  cook_time             cook_time not null default '30',
  budget                budget_level not null default 'medio',
  styles                diet_style[] not null default '{mediterraneo}',
  allergens             allergen[]  not null default '{}',
  allergens_confirmed_at timestamptz,             -- null ⇒ pendiente de confirmar (RF-03)
  disliked_ingredient_ids uuid[] not null default '{}',
  other_restrictions    text check (char_length(other_restrictions) <= 200),
  safety_flags          text[] not null default '{}',   -- p. ej. {'embarazo'}; ver doc 08
  updated_at            timestamptz not null default now()
);
```

## Catálogo (público en lectura)

```sql
create table ingredients (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,          -- 'espinacas'
  name             text not null,                 -- 'Espinacas'
  aliases          text[] not null default '{}',  -- {'espinaca','spinach'}
  category         shop_category not null,
  default_unit     unit_code not null,            -- unidad en la que se compra
  grams_per_unit   numeric,                       -- para 'ud': 1 tomate ≈ 150 g; permite sumar g + ud
  package_size     numeric,                       -- tamaño de envase habitual en default_unit (docena=12, lata=400 g…)
  package_label    text,                          -- 'docena', 'lata de 400 g', 'bote de 570 g'
  is_staple        boolean not null default false,-- sal, aceite, pimienta… (RF-25)
  allergens        allergen[] not null default '{}',
  is_perishable    boolean not null default true  -- para la regla de reutilización del planificador
);

create table recipes (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,
  name             text not null,
  description      text,                          -- una frase
  servings_base    smallint not null default 2,
  time_min         smallint not null,
  active_time_min  smallint,                      -- tiempo de atención real (batch cooking)
  meal_types       meal_type[] not null,
  tags             text[] not null default '{}',  -- 'rapida','batch','aprovechamiento','economica','sin_horno','una_olla'
  styles           diet_style[] not null default '{}',   -- compatibilidades: {'vegetariano','sin_gluten'}
  allergens        allergen[] not null default '{}',     -- derivado de ingredientes + confirmado por autor
  cost_level       cost_level not null default 'medio',
  protein_group    text,                          -- 'legumbre','huevo','pollo','pescado','tofu','lacteo','carne_roja','ninguno'
  batch_reuse      boolean not null default false,-- puede aparecer 2 veces (RF-11)
  steps            jsonb not null,                -- ["Paso 1…", "Paso 2…"]
  substitutions    jsonb not null default '[]',   -- [{"ingredient":"puerro","with":"cebolla","note":"…"}]
  tip              text,
  author           text,
  license          text,
  is_active        boolean not null default true,
  version          integer not null default 1,
  updated_at       timestamptz not null default now()
);

create table recipe_ingredients (
  recipe_id        uuid references recipes(id) on delete cascade,
  ingredient_id    uuid references ingredients(id),
  quantity         numeric not null,              -- para servings_base
  unit             unit_code not null,
  is_optional      boolean not null default false,
  note             text,                          -- 'cocidas', 'en dados'
  position         smallint not null,
  primary key (recipe_id, ingredient_id)
);
```

## Menús y lista de compra

```sql
create table menus (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references profiles(id) on delete cascade,
  week_start    date not null,                    -- lunes
  days          smallint not null,
  people        smallint not null,
  source        menu_source not null default 'reglas',
  seed          text,                             -- reproducibilidad (RNF-08)
  soft_warnings jsonb not null default '[]',      -- [{"slot_id":…,"type":"time","detail":"45>30"}]
  created_at    timestamptz not null default now(),
  unique (profile_id, week_start)
);

create table menu_slots (
  id            uuid primary key default gen_random_uuid(),
  menu_id       uuid not null references menus(id) on delete cascade,
  day_index     smallint not null check (day_index between 0 and 6),
  meal          meal_type not null,
  recipe_id     uuid references recipes(id),      -- null ⇒ "comer fuera"
  servings      smallint not null,
  alternatives  uuid[] not null default '{}',     -- hasta 2 recipe_id (RF-13)
  is_locked     boolean not null default false,   -- no cambia al regenerar (RF-14)
  unique (menu_id, day_index, meal)
);

create table shopping_lists (
  id            uuid primary key default gen_random_uuid(),
  menu_id       uuid not null unique references menus(id) on delete cascade,
  people        smallint not null,                -- puede diferir de menus.people (RF-24)
  generated_at  timestamptz not null default now()
);

create table shopping_items (
  id              uuid primary key default gen_random_uuid(),
  list_id         uuid not null references shopping_lists(id) on delete cascade,
  ingredient_id   uuid not null references ingredients(id),
  category        shop_category not null,
  needed_qty      numeric not null,               -- exacta, en unit
  unit            unit_code not null,
  buy_qty         numeric not null,               -- redondeada a envase
  buy_label       text not null,                  -- '1 docena', '2 latas'
  source_slot_ids uuid[] not null,                -- en qué platos se usa
  is_staple       boolean not null default false,
  checked         boolean not null default false, -- comprado
  have_it         boolean not null default false, -- "ya lo tengo"
  updated_at      timestamptz not null default now(),
  unique (list_id, ingredient_id)
);
```

## Despensa, favoritos, eventos

```sql
create table pantry_items (
  profile_id    uuid references profiles(id) on delete cascade,
  ingredient_id uuid references ingredients(id),
  quantity      numeric,                          -- opcional
  unit          unit_code,
  expires_on    date,                             -- opcional
  added_at      timestamptz not null default now(),
  primary key (profile_id, ingredient_id)
);

create table favorites (
  profile_id  uuid references profiles(id) on delete cascade,
  recipe_id   uuid references recipes(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (profile_id, recipe_id)
);

create table events (                            -- solo uso agregado, sin contenido
  id          bigserial primary key,
  profile_id  uuid references profiles(id) on delete set null,
  screen      text not null,
  action      text not null,
  created_at  timestamptz not null default now()
);

create table rate_limits (
  telegram_user_id bigint not null,
  bucket           text not null,                 -- 'general' | 'generate'
  window_start     timestamptz not null,
  count            integer not null default 0,
  primary key (telegram_user_id, bucket, window_start)
);
```

## RLS

```sql
alter table profiles, preferences, menus, menu_slots, shopping_lists, shopping_items,
            pantry_items, favorites, events, rate_limits enable row level security;
-- Sin políticas para anon/authenticated ⇒ solo service_role (Edge Function) accede.

alter table ingredients enable row level security;
alter table recipes enable row level security;
alter table recipe_ingredients enable row level security;
create policy "catalogo publico" on ingredients        for select to anon using (true);
create policy "catalogo publico" on recipes            for select to anon using (is_active);
create policy "catalogo publico" on recipe_ingredients for select to anon using (true);
```

## Índices

```sql
create index on menus (profile_id, week_start desc);
create index on menu_slots (menu_id);
create index on shopping_items (list_id, category);
create index on recipes using gin (meal_types);
create index on recipes using gin (tags);
create index on recipes using gin (allergens);
create index on ingredients using gin (aliases);
create index on events (created_at);
```

## Retención y borrado

- `DELETE /me` → borrado físico inmediato de `profiles` (cascada a todo).
- Tarea programada (pg_cron, semanal): perfiles con `last_seen_at < now() - interval '12 months'`
  → `deleted_at = now()`; 30 días después, borrado físico. `events` se agregan mensualmente a
  una tabla de totales y se purgan los detalles > 90 días.

## Unidades y conversión

Unidades canónicas para sumar: **g**, **ml**, **ud**. Tabla en `core/units.ts`:

| Unidad | Canónica | Factor | Nota |
|---|---|---|---|
| kg | g | 1000 | |
| l | ml | 1000 | |
| cda (cucharada) | ml | 15 | para aceite/salsas; g para sólidos ≈ 15 g |
| cdta (cucharadita) | ml | 5 | |
| taza | ml | 240 | |
| diente (ajo) | ud | 1 | `grams_per_unit` = 5 |
| manojo | ud | 1 | |
| lata / bote / brick / paquete | según `package_size` del ingrediente | | son unidades de compra, no de receta |

Al sumar g + ud del mismo ingrediente se usa `grams_per_unit`; el resultado se expresa en la
`default_unit` del ingrediente. Ver doc 09 para el redondeo a envase.

## Alérgenos: derivación automática

Al importar recetas, `recipes.allergens` = unión de `ingredients.allergens` de sus ingredientes
**no opcionales** ∪ los declarados a mano por el autor. Si el autor declara menos de los derivados,
el import falla con aviso (el autor debe confirmar). Los opcionales aparecen en la ficha como
"puede contener".
