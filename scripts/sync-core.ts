import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Copia packages/core/src → supabase/functions/_shared/core para que la Edge Function (Deno)
 * ejecute exactamente la misma lógica que el navegador (docs/04 "Lógica compartida").
 * Los imports de core llevan extensión .ts, así que Deno los resuelve sin bundler.
 */
const root = join(import.meta.dirname, '..');
const src = join(root, 'packages', 'core', 'src');
const dest = join(root, 'supabase', 'functions', '_shared', 'core');

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
const files = readdirSync(src).filter((f) => f.endsWith('.ts'));
for (const file of files) {
  const header = '// GENERADO por scripts/sync-core.ts desde packages/core/src — no editar aquí.\n';
  writeFileSync(join(dest, file), header + readFileSync(join(src, file), 'utf8'));
}
console.log(`✓ ${files.length} ficheros de core copiados a supabase/functions/_shared/core`);
