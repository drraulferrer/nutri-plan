/**
 * Edge Function `api` (docs/04, docs/06).
 * Despliegue: `supabase functions deploy api --no-verify-jwt` — la autenticación es `verifyInitData`.
 * Secretos: BOT_TOKEN (obligatorio), ALLOWED_ORIGIN (opcional, coma-separado).
 */
import { createApp } from './routes.ts';
import { SupabaseStore } from './supabase-store.ts';

const origins = (Deno.env.get('ALLOWED_ORIGIN') ?? 'https://drraulferrer.github.io')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const app = createApp(SupabaseStore.fromEnv(), {
  botToken: Deno.env.get('BOT_TOKEN') ?? '',
  allowedOrigins: [...origins, 'http://localhost:5173'],
});

Deno.serve(app.fetch);
