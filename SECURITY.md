# Seguridad

Si encuentras un problema de seguridad en Nutri Plan, **no abras un issue público**. Escribe a
drraulferrer@gmail.com con el detalle y, si es posible, pasos para reproducirlo. Respondemos en
menos de 7 días.

## Qué protegemos

- La identidad del usuario se verifica en el servidor validando `initData` de Telegram con
  HMAC-SHA256 en cada petición (`supabase/functions/api/auth.ts`).
- Ningún secreto vive en el frontend ni en este repositorio (`.env.example` documenta las claves).
- Las tablas de usuario tienen RLS sin políticas para `anon`: solo la Edge Function accede.

Detalle en `docs/04-arquitectura.md` y `docs/12-privacidad.md`.
