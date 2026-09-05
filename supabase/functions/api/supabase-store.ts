import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { detectSafetyFlags } from '../_shared/core/safety.ts';
import type { Menu, Preferences, ShoppingList } from '../_shared/core/types.ts';
import { EMPTY_STATE, type CatalogRows, type Profile, type StatePatch, type Store, type UserState } from './store.ts';

interface PreferencesRow {
  people: number;
  days: number;
  include_snacks: boolean;
  cook_time: Preferences['cook_time'];
  budget: Preferences['budget'];
  styles: Preferences['styles'];
  allergens: Preferences['allergens'];
  allergens_confirmed: boolean;
  disliked_ingredients: string[];
  other_restrictions: string | null;
  updated_at: string;
}

function rowToPreferences(row: PreferencesRow): Preferences {
  return {
    people: row.people,
    days: row.days === 5 ? 5 : 7,
    include_snacks: row.include_snacks,
    cook_time: row.cook_time,
    budget: row.budget,
    styles: row.styles,
    allergens: row.allergens,
    allergens_confirmed: row.allergens_confirmed,
    disliked_ingredients: row.disliked_ingredients,
    ...(row.other_restrictions ? { other_restrictions: row.other_restrictions } : {}),
  };
}

function fail(context: string, error: { message: string } | null): never {
  throw new Error(`${context}: ${error?.message ?? 'error desconocido'}`);
}

/** Implementación real sobre PostgreSQL con la clave service_role (solo en la Edge Function). */
export class SupabaseStore implements Store {
  constructor(private readonly db: SupabaseClient) {}

  static fromEnv(): SupabaseStore {
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
    return new SupabaseStore(createClient(url, key, { auth: { persistSession: false } }));
  }

  async upsertProfile(telegramUserId: bigint, languageCode?: string): Promise<Profile> {
    const { data, error } = await this.db
      .from('profiles')
      .upsert(
        { telegram_user_id: telegramUserId.toString(), language_code: languageCode ?? null, last_seen_at: new Date().toISOString(), deleted_at: null },
        { onConflict: 'telegram_user_id' },
      )
      .select('id, created_at')
      .single();
    if (error || !data) fail('upsertProfile', error);
    return data as Profile;
  }

  async getState(profileId: string): Promise<UserState> {
    const [prefs, menu, pantry, favorites] = await Promise.all([
      this.db.from('preferences').select('*').eq('profile_id', profileId).maybeSingle(),
      this.db.from('menus').select('id, data, updated_at').eq('profile_id', profileId).eq('is_current', true).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
      this.db.from('pantry_items').select('ingredient_slug').eq('profile_id', profileId),
      this.db.from('favorites').select('recipe_slug').eq('profile_id', profileId),
    ]);
    if (prefs.error) fail('getState.preferences', prefs.error);
    if (menu.error) fail('getState.menus', menu.error);
    if (pantry.error) fail('getState.pantry', pantry.error);
    if (favorites.error) fail('getState.favorites', favorites.error);

    let shoppingList: ShoppingList | null = null;
    let listUpdated: string | null = null;
    if (menu.data) {
      const list = await this.db.from('shopping_lists').select('data, updated_at').eq('menu_id', menu.data.id).maybeSingle();
      if (list.error) fail('getState.shopping_list', list.error);
      shoppingList = (list.data?.data as ShoppingList | undefined) ?? null;
      listUpdated = list.data?.updated_at ?? null;
    }
    const stamps = [prefs.data?.updated_at, menu.data?.updated_at, listUpdated].filter((s): s is string => Boolean(s)).sort();
    return {
      preferences: prefs.data ? rowToPreferences(prefs.data as PreferencesRow) : null,
      menu: (menu.data?.data as Menu | undefined) ?? null,
      shopping_list: shoppingList,
      pantry: (pantry.data ?? []).map((r) => r.ingredient_slug as string),
      favorites: (favorites.data ?? []).map((r) => r.recipe_slug as string),
      updated_at: stamps[stamps.length - 1] ?? null,
    };
  }

  async putState(profileId: string, patch: StatePatch): Promise<UserState> {
    const now = new Date().toISOString();
    if (patch.preferences) await this.savePreferences(profileId, patch.preferences, now);
    if (patch.menu !== undefined) await this.saveMenu(profileId, patch.menu, now);
    if (patch.shopping_list !== undefined) await this.saveShoppingList(profileId, patch.shopping_list, now);
    if (patch.pantry) await this.replaceSet('pantry_items', 'ingredient_slug', profileId, patch.pantry);
    if (patch.favorites) await this.replaceSet('favorites', 'recipe_slug', profileId, patch.favorites);
    return this.getState(profileId);
  }

  private async savePreferences(profileId: string, p: Preferences, now: string): Promise<void> {
    const { error } = await this.db.from('preferences').upsert({
      profile_id: profileId,
      people: p.people,
      days: p.days,
      include_snacks: p.include_snacks,
      cook_time: p.cook_time,
      budget: p.budget,
      styles: p.styles,
      allergens: p.allergens,
      allergens_confirmed: p.allergens_confirmed,
      disliked_ingredients: p.disliked_ingredients,
      other_restrictions: p.other_restrictions ?? null,
      safety_flags: detectSafetyFlags(p.other_restrictions),
      updated_at: now,
    });
    if (error) fail('savePreferences', error);
  }

  private async saveMenu(profileId: string, menu: Menu | null, now: string): Promise<void> {
    const retire = await this.db.from('menus').update({ is_current: false, updated_at: now }).eq('profile_id', profileId).eq('is_current', true);
    if (retire.error) fail('saveMenu.retire', retire.error);
    if (!menu) return;
    const { error } = await this.db.from('menus').upsert(
      { profile_id: profileId, week_start: menu.week_start, days: menu.days, people: menu.people, seed: menu.seed, data: menu, is_current: true, updated_at: now },
      { onConflict: 'profile_id,week_start' },
    );
    if (error) fail('saveMenu', error);
  }

  private async saveShoppingList(profileId: string, list: ShoppingList | null, now: string): Promise<void> {
    const menu = await this.db.from('menus').select('id').eq('profile_id', profileId).eq('is_current', true).maybeSingle();
    if (menu.error) fail('saveShoppingList.menu', menu.error);
    if (!menu.data) return;
    if (!list) {
      const del = await this.db.from('shopping_lists').delete().eq('menu_id', menu.data.id);
      if (del.error) fail('saveShoppingList.delete', del.error);
      return;
    }
    const { error } = await this.db.from('shopping_lists').upsert({ menu_id: menu.data.id, people: list.people, data: list, updated_at: now });
    if (error) fail('saveShoppingList', error);
  }

  private async replaceSet(table: 'pantry_items' | 'favorites', column: string, profileId: string, slugs: string[]): Promise<void> {
    const del = await this.db.from(table).delete().eq('profile_id', profileId);
    if (del.error) fail(`${table}.delete`, del.error);
    if (slugs.length === 0) return;
    const rows = [...new Set(slugs)].map((s) => ({ profile_id: profileId, [column]: s }));
    const ins = await this.db.from(table).insert(rows);
    if (ins.error) fail(`${table}.insert`, ins.error);
  }

  async deleteProfile(profileId: string): Promise<void> {
    const { error } = await this.db.from('profiles').delete().eq('id', profileId);
    if (error) fail('deleteProfile', error);
  }

  async addEvent(profileId: string, screen: string, action: string): Promise<void> {
    const { error } = await this.db.from('events').insert({ profile_id: profileId, screen, action });
    if (error) fail('addEvent', error);
  }

  async loadCatalog(): Promise<CatalogRows> {
    const [recipes, ingredients] = await Promise.all([
      this.db.from('recipes').select('data').eq('is_active', true),
      this.db.from('ingredients').select('data'),
    ]);
    if (recipes.error) fail('loadCatalog.recipes', recipes.error);
    if (ingredients.error) fail('loadCatalog.ingredients', ingredients.error);
    return { recipes: (recipes.data ?? []).map((r) => r.data), ingredients: (ingredients.data ?? []).map((r) => r.data) };
  }

  async bumpRateLimit(telegramUserId: bigint, bucket: string, windowStart: Date): Promise<number> {
    const { data, error } = await this.db.rpc('bump_rate_limit', {
      p_user: telegramUserId.toString(),
      p_bucket: bucket,
      p_window: windowStart.toISOString(),
    });
    if (error) fail('bumpRateLimit', error);
    return Number(data ?? 0);
  }
}

export { EMPTY_STATE };
