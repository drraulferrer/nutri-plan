-- Nutri Plan · esquema inicial (docs/05-modelo-datos.md)
-- Principio: guardar lo mínimo. Sin peso, calorías, objetivos ni datos clínicos.

create type meal_type     as enum ('desayuno','comida','cena','tentempie');
create type cook_time     as enum ('15','30','45','60+');
create type budget_level  as enum ('ajustado','medio','flexible');
create type cost_level    as enum ('bajo','medio','alto');
create type diet_style    as enum ('mediterraneo','vegetariano','vegano','flexitariano','sin_gluten','sin_lactosa');
create type shop_category as enum ('verduras_fruta','proteinas','lacteos','despensa','congelados','otros');
create type unit_code     as enum ('g','kg','ml','l','ud','cda','cdta','taza','pizca','manojo','diente','rebanada','lata','bote','brick','paquete');
create type allergen      as enum (
  'gluten','crustaceos','huevos','pescado','cacahuetes','soja','lacteos','frutos_cascara',
  'apio','mostaza','sesamo','sulfitos','altramuces','moluscos');   -- 14 UE, Reg. 1169/2011
create type menu_source   as enum ('reglas','ia');

-- ── Usuario ────────────────────────────────────────────────────────────
create table profiles (
  id                uuid primary key default gen_random_uuid(),
  telegram_user_id  bigint not null unique,
  language_code     text,
  created_at        timestamptz not null default now(),
  last_seen_at      timestamptz not null default now(),
  deleted_at        timestamptz
);

create table preferences (
  profile_id              uuid primary key references profiles(id) on delete cascade,
  people                  smallint not null default 2 check (people between 1 and 8),
  days                    smallint not null default 7 check (days in (5,7)),
  include_snacks          boolean  not null default false,
  cook_time               cook_time not null default '30',
  budget                  budget_level not null default 'medio',
  styles                  diet_style[] not null default '{mediterraneo}',
  allergens               allergen[]  not null default '{}',
  allergens_confirmed_at  timestamptz,
  disliked_ingredient_ids uuid[] not null default '{}',
  other_restrictions      text check (char_length(other_restrictions) <= 200),
  safety_flags            text[] not null default '{}',
  updated_at              timestamptz not null default now()
);

-- ── Catálogo (lectura pública) ─────────────────────────────────────────
create table ingredients (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  name            text not null,
  aliases         text[] not null default '{}',
  category        shop_category not null,
  default_unit    unit_code not null,
  grams_per_unit  numeric,
  package_size    numeric,
  package_label   text,
  is_staple       boolean not null default false,
  is_perishable   boolean not null default true,
  indivisible     boolean not null default false,
  allergens       allergen[] not null default '{}'
);

create table recipes (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,
  name             text not null,
  description      text,
  servings_base    smallint not null default 2,
  time_min         smallint not null,
  active_time_min  smallint,
  meal_types       meal_type[] not null,
  tags             text[] not null default '{}',
  styles           diet_style[] not null default '{}',
  allergens        allergen[] not null default '{}',
  cost_level       cost_level not null default 'medio',
  protein_group    text,
  batch_reuse      boolean not null default false,
  steps            jsonb not null,
  substitutions    jsonb not null default '[]',
  tip              text,
  pairs_with       text[] not null default '{}',
  author           text,
  license          text,
  is_active        boolean not null default true,
  version          integer not null default 1,
  updated_at       timestamptz not null default now()
);

create table recipe_ingredients (
  recipe_id      uuid references recipes(id) on delete cascade,
  ingredient_id  uuid references ingredients(id),
  quantity       numeric not null,
  unit           unit_code not null,
  is_optional    boolean not null default false,
  note           text,
  position       smallint not null,
  primary key (recipe_id, ingredient_id)
);

-- ── Menús y lista ──────────────────────────────────────────────────────
create table menus (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references profiles(id) on delete cascade,
  week_start    date not null,
  days          smallint not null,
  people        smallint not null,
  source        menu_source not null default 'reglas',
  seed          text,
  soft_warnings jsonb not null default '[]',
  created_at    timestamptz not null default now(),
  unique (profile_id, week_start)
);

create table menu_slots (
  id            uuid primary key default gen_random_uuid(),
  menu_id       uuid not null references menus(id) on delete cascade,
  day_index     smallint not null check (day_index between 0 and 6),
  meal          meal_type not null,
  recipe_id     uuid references recipes(id),
  servings      smallint not null,
  alternatives  uuid[] not null default '{}',
  is_locked     boolean not null default false,
  unique (menu_id, day_index, meal)
);

create table shopping_lists (
  id            uuid primary key default gen_random_uuid(),
  menu_id       uuid not null unique references menus(id) on delete cascade,
  people        smallint not null,
  generated_at  timestamptz not null default now()
);

create table shopping_items (
  id               uuid primary key default gen_random_uuid(),
  list_id          uuid not null references shopping_lists(id) on delete cascade,
  ingredient_id    uuid not null references ingredients(id),
  category         shop_category not null,
  needed_qty       numeric not null,
  unit             unit_code not null,
  buy_qty          numeric not null,
  buy_label        text not null,
  source_slot_ids  uuid[] not null,
  is_staple        boolean not null default false,
  checked          boolean not null default false,
  have_it          boolean not null default false,
  updated_at       timestamptz not null default now(),
  unique (list_id, ingredient_id)
);

-- ── Despensa, favoritos, eventos, límites ──────────────────────────────
create table pantry_items (
  profile_id     uuid references profiles(id) on delete cascade,
  ingredient_id  uuid references ingredients(id),
  quantity       numeric,
  unit           unit_code,
  expires_on     date,
  added_at       timestamptz not null default now(),
  primary key (profile_id, ingredient_id)
);

create table favorites (
  profile_id  uuid references profiles(id) on delete cascade,
  recipe_id   uuid references recipes(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (profile_id, recipe_id)
);

create table events (
  id          bigserial primary key,
  profile_id  uuid references profiles(id) on delete set null,
  screen      text not null,
  action      text not null,
  created_at  timestamptz not null default now()
);

create table rate_limits (
  telegram_user_id  bigint not null,
  bucket            text not null,
  window_start      timestamptz not null,
  count             integer not null default 0,
  primary key (telegram_user_id, bucket, window_start)
);

-- ── RLS: tablas de usuario sin políticas ⇒ solo service_role (Edge Function) ──
alter table profiles        enable row level security;
alter table preferences     enable row level security;
alter table menus           enable row level security;
alter table menu_slots      enable row level security;
alter table shopping_lists  enable row level security;
alter table shopping_items  enable row level security;
alter table pantry_items    enable row level security;
alter table favorites       enable row level security;
alter table events          enable row level security;
alter table rate_limits     enable row level security;

alter table ingredients        enable row level security;
alter table recipes            enable row level security;
alter table recipe_ingredients enable row level security;
create policy "catalogo publico" on ingredients        for select to anon, authenticated using (true);
create policy "catalogo publico" on recipes            for select to anon, authenticated using (is_active);
create policy "catalogo publico" on recipe_ingredients for select to anon, authenticated using (true);

-- ── Índices ────────────────────────────────────────────────────────────
create index on menus (profile_id, week_start desc);
create index on menu_slots (menu_id);
create index on shopping_items (list_id, category);
create index on recipes using gin (meal_types);
create index on recipes using gin (tags);
create index on recipes using gin (allergens);
create index on ingredients using gin (aliases);
create index on events (created_at);
