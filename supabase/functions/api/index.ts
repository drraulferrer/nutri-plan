/**
 * Edge Function `api` · esqueleto de la Fase 2 (docs/04, docs/06).
 * Despliegue: `supabase functions deploy api --no-verify-jwt` (la autenticación es verifyInitData).
 */
import { Hono } from 'npm:hono@4';
import { cors } from 'npm:hono@4/cors';
import { AuthError, initDataFromHeader, verifyInitData, type VerifiedUser } from './auth.ts';

type Env = { Variables: { user: VerifiedUser } };

const BOT_TOKEN = Deno.env.get('BOT_TOKEN') ?? '';
const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') ?? 'https://drraulferrer.github.io';

export const app = new Hono<Env>().basePath('/api');

app.use(
  '*',
  cors({
    origin: [ALLOWED_ORIGIN, 'http://localhost:5173'],
    allowHeaders: ['Authorization', 'Content-Type', 'X-Client-Version'],
  }),
);

const fail = (code: string, message: string, status: 401 | 403 | 404 | 422 | 429 | 500) =>
  Response.json({ ok: false, error: { code, message } }, { status });

/** Autenticación en cada petición: `Authorization: tma <initData>` (docs/03 §4). */
app.use('/me/*', async (c, next) => {
  const raw = initDataFromHeader(c.req.header('Authorization'));
  if (!raw || !BOT_TOKEN) return fail('unauthorized', 'Abre Nutri Plan desde Telegram', 401);
  try {
    c.set('user', await verifyInitData(raw, BOT_TOKEN));
  } catch (e) {
    const code = e instanceof AuthError && e.code === 'expired' ? 'expired' : 'unauthorized';
    const message =
      code === 'expired'
        ? 'Sesión caducada · vuelve a abrir Nutri Plan'
        : 'Abre Nutri Plan desde Telegram';
    return fail(code, message, 401);
  }
  await next();
});

app.get('/health', (c) => c.json({ ok: true, data: { service: 'nutri-plan-api', phase: 0 } }));

/** Comprobación de identidad; las rutas de docs/06 se añaden en la Fase 2. */
app.post('/me/session', (c) => {
  const user = c.get('user');
  return c.json({
    ok: true,
    data: {
      telegram_user_id: user.telegramUserId.toString(),
      start_param: user.startParam ?? null,
    },
  });
});

app.notFound(() => fail('not_found', 'Ruta no encontrada', 404));

Deno.serve(app.fetch);
