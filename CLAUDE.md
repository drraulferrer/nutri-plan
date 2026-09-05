# Nutri Plan — guía para agentes

Mini App de Telegram para @Nutri_RF_Bot. La especificación completa vive en `docs/` y es la
fuente de verdad: léela antes de tocar código (`docs/00-decisiones.md` primero).

## Estructura

- `packages/core` — lógica pura en TypeScript (sin React, sin Deno, sin red): tipos, esquemas Zod,
  unidades, escalado, agregación de la lista, matcher, planificador, seguridad, plantillas.
  Se ejecuta en el navegador y en la Edge Function. Tests con Vitest, cobertura ≥ 80 %.
- `apps/web` — Mini App (React + Vite). Solo variables `--tg-theme-*` para colores. Envoltorio del
  SDK de Telegram en `src/tg/` con modo simulado para el navegador.
- `supabase/` — migraciones SQL (`docs/05-modelo-datos.md`) y Edge Function `api` (Deno + Hono).
  La autenticación es `verifyInitData` en cada petición (`docs/03-integracion-telegram.md` §4).
- `data/` — recetario en YAML, una receta por fichero. `npm run recipes:check` valida.

## Comandos

```bash
npm ci                 # instalar
npm run dev            # Mini App en http://localhost:5173/nutri-plan/ (modo simulado)
npm test               # tests de core y web
npm run recipes:check  # valida data/
npm run build          # genera recipes.json + build de web
```

## Reglas del proyecto

- Restricciones duras (alérgenos, estilo, no gusta) **nunca** se incumplen; hay tests de propiedad.
- Sin peso, calorías, objetivos ni datos clínicos en ningún modelo.
- Lenguaje de la app: sin alimentos "prohibidos" ni consejo médico. Ver `docs/08` reglas de seguridad.
- Inmutabilidad: las funciones de `core` devuelven objetos nuevos.
- Secretos solo en Supabase secrets. `.env.example` documenta las claves.
