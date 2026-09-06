import {
  EMPTY_STATE,
  type CatalogRows,
  type Profile,
  type StatePatch,
  type Store,
  type UserState,
} from './store.ts';

/** Implementación en memoria para tests y desarrollo local sin base de datos. */
export class MemoryStore implements Store {
  private profiles = new Map<string, Profile & { telegramUserId: bigint }>();
  private states = new Map<string, UserState>();
  readonly events: { profileId: string; screen: string; action: string }[] = [];
  private limits = new Map<string, number>();

  constructor(private readonly catalog: CatalogRows = { recipes: [], ingredients: [] }) {}

  upsertProfile(telegramUserId: bigint, _languageCode?: string): Promise<Profile> {
    for (const p of this.profiles.values()) {
      if (p.telegramUserId === telegramUserId)
        return Promise.resolve({ id: p.id, created_at: p.created_at });
    }
    const profile = {
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      telegramUserId,
    };
    this.profiles.set(profile.id, profile);
    return Promise.resolve({ id: profile.id, created_at: profile.created_at });
  }

  findProfile(telegramUserId: bigint): Promise<Profile | null> {
    for (const p of this.profiles.values()) {
      if (p.telegramUserId === telegramUserId)
        return Promise.resolve({ id: p.id, created_at: p.created_at });
    }
    return Promise.resolve(null);
  }

  readonly aiUsage: { profileId: string; model: string; outcome: string }[] = [];
  recordAiUsage(profileId: string, usage: { model: string; outcome: string }): Promise<void> {
    this.aiUsage.push({ profileId, model: usage.model, outcome: usage.outcome });
    return Promise.resolve();
  }

  getState(profileId: string): Promise<UserState> {
    return Promise.resolve(structuredClone(this.states.get(profileId) ?? EMPTY_STATE));
  }

  putState(profileId: string, patch: StatePatch): Promise<UserState> {
    const current = this.states.get(profileId) ?? EMPTY_STATE;
    const next: UserState = {
      preferences: patch.preferences ?? current.preferences,
      menu: patch.menu === undefined ? current.menu : patch.menu,
      shopping_list:
        patch.shopping_list === undefined ? current.shopping_list : patch.shopping_list,
      pantry: patch.pantry ?? current.pantry,
      favorites: patch.favorites ?? current.favorites,
      updated_at: new Date().toISOString(),
    };
    this.states.set(profileId, structuredClone(next));
    return Promise.resolve(structuredClone(next));
  }

  deleteProfile(profileId: string): Promise<void> {
    this.profiles.delete(profileId);
    this.states.delete(profileId);
    return Promise.resolve();
  }

  addEvent(profileId: string, screen: string, action: string): Promise<void> {
    this.events.push({ profileId, screen, action });
    return Promise.resolve();
  }

  loadCatalog(): Promise<CatalogRows> {
    return Promise.resolve(this.catalog);
  }

  bumpRateLimit(telegramUserId: bigint, bucket: string, windowStart: Date): Promise<number> {
    const key = `${telegramUserId}:${bucket}:${windowStart.toISOString()}`;
    const count = (this.limits.get(key) ?? 0) + 1;
    this.limits.set(key, count);
    return Promise.resolve(count);
  }
}
