/**
 * Edge Function `api` (docs/04, docs/06, docs/13).
 * Despliegue: `supabase functions deploy api --no-verify-jwt` — la autenticación es `verifyInitData`.
 * Secretos: BOT_TOKEN (obligatorio), ALLOWED_ORIGIN (coma-separado), ANTHROPIC_API_KEY y
 * ANTHROPIC_MODEL (Fase 3, opcionales), BOT_SHARED_SECRET (Fase 4, opcional).
 */
import { ClaudePlanner } from './ai.ts';
import { createApp } from './routes.ts';
import { SupabaseStore } from './supabase-store.ts';

const origins = (Deno.env.get('ALLOWED_ORIGIN') ?? 'https://drraulferrer.github.io')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const app = createApp(SupabaseStore.fromEnv(), {
  botToken: Deno.env.get('BOT_TOKEN') ?? '',
  allowedOrigins: [...origins, 'http://localhost:5173'],
  ai: ClaudePlanner.fromEnv(),
  botSecret: Deno.env.get('BOT_SHARED_SECRET') ?? '',
});

Deno.serve(app.fetch);
