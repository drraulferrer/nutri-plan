import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';
import { buildCatalog } from '../_shared/core/catalog.ts';
import { defaultWeekStart, planMenu } from '../_shared/core/planner.ts';
import { StatePatchSchema } from '../_shared/core/schemas.ts';
import { buildShoppingList } from '../_shared/core/shopping.ts';
import type { Catalog } from '../_shared/core/types.ts';
import { generateWithAi, type AiPlanner } from './ai.ts';
import {
  AuthError,
  initDataFromHeader,
  toHex,
  verifyInitData,
  verifyTelegramSignature,
  type VerifiedUser,
} from './auth.ts';
import { registerBotRoutes } from './bot-routes.ts';
import type { Store } from './store.ts';

export interface ApiEnv {
  botToken: string;
  allowedOrigins: string[];
  /** Planificador con IA (Fase 3); null ⇒ solo reglas. */
  ai?: AiPlanner | null;
  /** Secreto compartido con el backend del bot (Fase 4); vacío ⇒ rutas /bot deshabilitadas. */
  botSecret?: string;
  now?: () => number;
}

export type Vars = { Variables: { user: VerifiedUser; profileId: string } };

const RATE_GENERAL = { bucket: 'general', limit: 60, windowSec: 60 };
const RATE_GENERATE = { bucket: 'generate', limit: 10, windowSec: 60 };

export type ErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'expired'
  | 'not_found'
  | 'validation'
  | 'rate_limited'
  | 'internal'
  | 'no_preferences';
const STATUS: Record<ErrorCode, 401 | 403 | 404 | 422 | 429 | 500> = {
  unauthorized: 401,
  forbidden: 403,
  expired: 401,
  not_found: 404,
  validation: 422,
  rate_limited: 429,
  internal: 500,
  no_preferences: 422,
};

export const fail = (code: ErrorCode, message: string, extra: Record<string, unknown> = {}) =>
  Response.json({ ok: false, error: { code, message, ...extra } }, { status: STATUS[code] });
export const ok = (data: unknown, status = 200) => Response.json({ ok: true, data }, { status });

export async function loadCatalogFromStore(store: Store): Promise<Catalog> {
  const rows = await store.loadCatalog();
  return buildCatalog(
    rows.ingredients,
    rows.recipes.map((data, i) => ({ file: `db[${i}]`, data })),
  ).catalog;
}

const GenerateBody = z.object({
  week_start: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  seed: z.string().max(64).optional(),
  source: z.enum(['reglas', 'ia']).optional(),
});
const EventBody = z.object({
  screen: z.string().min(1).max(40),
  action: z.string().min(1).max(40),
});

function windowStart(now: number, windowSec: number): Date {
  return new Date(Math.floor(now / 1000 / windowSec) * windowSec * 1000);
}

/** Construye la aplicación Hono; `store` se inyecta para poder probarla en memoria. */
export function createApp(store: Store, env: ApiEnv) {
  const now = env.now ?? Date.now;
  const app = new Hono<Vars>().basePath('/api');

  app.use(
    '*',
    cors({
      origin: env.allowedOrigins,
      allowHeaders: ['Authorization', 'Content-Type', 'X-Client-Version', 'X-Bot-Secret'],
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    }),
  );

  app.onError((e) => {
    console.error('[api]', e instanceof Error ? e.message : e);
    return fail('internal', 'Algo ha fallado en el servidor');
  });

  app.get('/health', async (c) => {
    const base: Record<string, unknown> = {
      service: 'nutri-plan-api',
      phase: 4,
      ai: Boolean(env.ai),
      bot: Boolean(env.botSecret),
      // Solo la forma del token (dígitos:35 caracteres), nunca su valor: detecta espacios o comillas al pegarlo.
      bot_token: !env.botToken
        ? 'missing'
        : /^\d{5,12}:[A-Za-z0-9_-]{35}$/.test(env.botToken)
          ? 'ok'
          : 'malformed',
    };
    // ?check=bot: pregunta a Telegram a qué bot pertenece el token (solo el @username, dato público).
    if (c.req.query('check') === 'bot' && env.botToken) {
      try {
        const res = await fetch(`https://api.telegram.org/bot${env.botToken}/getMe`);
        const json = (await res.json()) as {
          ok: boolean;
          result?: { username?: string };
          error_code?: number;
        };
        base['bot_username'] = json.ok
          ? (json.result?.username ?? '?')
          : `telegram error ${json.error_code ?? res.status}`;
      } catch {
        base['bot_username'] = 'unreachable';
      }
    }
    // ?echo=1: huella SHA-256 y longitud de la cabecera Authorization tal como llega (para detectar alteraciones en tránsito).
    if (c.req.query('echo') === '1') {
      const auth = c.req.header('Authorization') ?? '';
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(auth));
      base['auth_header'] = { length: auth.length, sha256: toHex(digest).slice(0, 16) };
    }
    return ok(base);
  });

  app.get('/catalog', async (c) => {
    const rows = await store.loadCatalog();
    c.header('Cache-Control', 'public, max-age=3600');
    return ok(rows);
  });

  // ── Autenticación: Authorization: tma <initData> (docs/03 §4) ──────────
  app.use('/me/*', async (c, next) => {
    const raw = initDataFromHeader(c.req.header('Authorization'));
    if (!raw || !env.botToken) return fail('unauthorized', 'Abre Nutri Plan desde Telegram');
    let user: VerifiedUser;
    try {
      user = await verifyInitData(raw, env.botToken, { now });
    } catch (e) {
      const reason = e instanceof AuthError ? e.code : 'error';
      // Diagnóstico sin datos personales: claves presentes, longitud y antigüedad de auth_date.
      const p = new URLSearchParams(raw);
      const age = Math.round(now() / 1000 - Number(p.get('auth_date') ?? 0));
      const botId = env.botToken.split(':')[0] ?? '';
      const issuedForThisBot = await verifyTelegramSignature(raw, botId);
      console.warn(
        '[auth] initData rechazado:',
        reason,
        JSON.stringify({
          keys: [...p.keys()].sort(),
          length: raw.length,
          age_sec: age,
          bot_id: botId,
          ed25519_for_this_bot: issuedForThisBot,
        }),
      );
      if (reason === 'expired')
        return fail('expired', 'Sesión caducada · vuelve a abrir Nutri Plan', { reason });
      return fail('unauthorized', 'Abre Nutri Plan desde Telegram', { reason });
    }
    const count = await store.bumpRateLimit(
      user.telegramUserId,
      RATE_GENERAL.bucket,
      windowStart(now(), RATE_GENERAL.windowSec),
    );
    if (count > RATE_GENERAL.limit)
      return fail('rate_limited', 'Demasiadas peticiones', { retry_after: RATE_GENERAL.windowSec });
    const profile = await store.upsertProfile(user.telegramUserId, user.languageCode);
    c.set('user', user);
    c.set('profileId', profile.id);
    await next();
  });

  app.post('/me/session', async (c) => {
    const state = await store.getState(c.get('profileId'));
    return ok({
      profile: { id: c.get('profileId') },
      start_param: c.get('user').startParam ?? null,
      state,
    });
  });

  app.get('/me/state', async (c) => ok(await store.getState(c.get('profileId'))));

  app.put('/me/state', async (c) => {
    const parsed = StatePatchSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success)
      return fail('validation', 'Datos no válidos', { details: parsed.error.issues.slice(0, 10) });
    if (
      parsed.data.preferences &&
      parsed.data.preferences.allergens.length > 0 &&
      !parsed.data.preferences.allergens_confirmed
    ) {
      return fail('validation', 'Confirma tus alergias antes de guardar', {
        details: [{ path: ['preferences', 'allergens_confirmed'] }],
      });
    }
    return ok(await store.putState(c.get('profileId'), parsed.data));
  });

  app.post('/me/menus/generate', async (c) => {
    const user = c.get('user');
    const count = await store.bumpRateLimit(
      user.telegramUserId,
      RATE_GENERATE.bucket,
      windowStart(now(), RATE_GENERATE.windowSec),
    );
    if (count > RATE_GENERATE.limit)
      return fail('rate_limited', 'Espera un minuto antes de generar otro menú', {
        retry_after: RATE_GENERATE.windowSec,
      });
    const body = GenerateBody.safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) return fail('validation', 'Datos no válidos');
    const profileId = c.get('profileId');
    const state = await store.getState(profileId);
    if (!state.preferences)
      return fail('no_preferences', 'Guarda tus preferencias antes de generar el menú');

    const catalog = await loadCatalogFromStore(store);
    const input = {
      preferences: state.preferences,
      catalog,
      weekStart: body.data.week_start ?? defaultWeekStart(new Date(now())),
      seed: body.data.seed ?? crypto.randomUUID().slice(0, 8),
      favorites: state.favorites,
      pantry: state.pantry,
      recentRecipes:
        state.menu?.slots.map((s) => s.recipe_slug).filter((s): s is string => Boolean(s)) ?? [],
    };
    const source = body.data.source ?? (state.preferences.use_ai === false ? 'reglas' : 'ia');
    let menu = null;
    let menuSource: 'reglas' | 'ia' = 'reglas';
    if (source === 'ia' && env.ai) {
      const result = await generateWithAi(env.ai, input);
      await store.recordAiUsage(profileId, {
        model: env.ai.model,
        ...result.usage,
        outcome: result.outcome,
      });
      menu = result.menu;
      menuSource = result.outcome === 'fallback' ? 'reglas' : 'ia';
    } else {
      menu = planMenu(input);
    }
    const shoppingList = buildShoppingList({
      slots: menu.slots,
      catalog,
      people: state.preferences.people,
      pantry: state.pantry,
    });
    return ok(
      await store.putState(profileId, {
        menu,
        shopping_list: shoppingList,
        menu_source: menuSource,
      }),
    );
  });

  app.post('/me/events', async (c) => {
    const parsed = EventBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return fail('validation', 'Datos no válidos');
    await store.addEvent(c.get('profileId'), parsed.data.screen, parsed.data.action);
    return new Response(null, { status: 204 });
  });

  app.delete('/me', async (c) => {
    await store.deleteProfile(c.get('profileId'));
    return ok({ deleted: true });
  });

  registerBotRoutes(app, store, { botSecret: env.botSecret ?? '' });

  app.notFound(() => fail('not_found', 'Ruta no encontrada'));
  return app;
}
