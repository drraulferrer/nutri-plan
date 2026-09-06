import type { Menu, Preferences, ShoppingList } from '@nutri-plan/core';

/** Estado tal y como lo guarda el servidor (docs/06 `GET /me/state`). */
export interface RemoteState {
  preferences: Preferences | null;
  menu: Menu | null;
  shopping_list: ShoppingList | null;
  pantry: string[];
  favorites: string[];
  updated_at: string | null;
}

export interface StatePatch {
  preferences?: Preferences;
  menu?: Menu | null;
  shopping_list?: ShoppingList | null;
  pantry?: string[];
  favorites?: string[];
}

export interface SessionResponse {
  profile: { id: string };
  start_param: string | null;
  state: RemoteState;
}

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
    /** Detalle de diagnóstico que devuelve el servidor (p. ej. `bad_hash`), sin datos sensibles. */
    public readonly reason?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
  get isAuth(): boolean {
    return this.status === 401;
  }
}

export interface ApiClient {
  session(): Promise<SessionResponse>;
  getState(): Promise<RemoteState>;
  putState(patch: StatePatch): Promise<RemoteState>;
  generateMenu(body: { week_start?: string; seed?: string; source?: 'reglas' | 'ia' }): Promise<RemoteState>;
  deleteMe(): Promise<void>;
  event(screen: string, action: string): Promise<void>;
}

export interface ClientOptions {
  baseUrl: string | undefined;
  initData: string;
  fetchImpl?: typeof fetch;
  clientVersion?: string;
}

/** Cliente HTTP con `Authorization: tma <initData>` (docs/03 §4). Devuelve null si no hay API o initData. */
export function createApiClient({ baseUrl, initData, fetchImpl, clientVersion = 'dev' }: ClientOptions): ApiClient | null {
  if (!baseUrl || !initData) return null;
  const base = baseUrl.replace(/\/+$/, '');
  const doFetch = fetchImpl ?? ((input, init) => fetch(input, init));

  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await doFetch(`${base}${path}`, {
      method,
      headers: {
        Authorization: `tma ${initData}`,
        'Content-Type': 'application/json',
        'X-Client-Version': clientVersion,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.status === 204) return undefined as T;
    const json = (await res.json().catch(() => null)) as { ok: boolean; data?: T; error?: { code: string; message: string; reason?: string } } | null;
    if (!res.ok || !json?.ok) {
      throw new ApiError(json?.error?.code ?? 'http_error', res.status, json?.error?.message ?? `HTTP ${res.status}`, json?.error?.reason);
    }
    return json.data as T;
  }

  return {
    session: () => request<SessionResponse>('POST', '/me/session'),
    getState: () => request<RemoteState>('GET', '/me/state'),
    putState: (patch) => request<RemoteState>('PUT', '/me/state', patch),
    generateMenu: (body) => request<RemoteState>('POST', '/me/menus/generate', body),
    deleteMe: () => request<void>('DELETE', '/me'),
    event: (screen, action) => request<void>('POST', '/me/events', { screen, action }),
  };
}
