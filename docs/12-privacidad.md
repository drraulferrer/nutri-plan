# 12 · Privacidad y datos

## Qué se guarda y por qué

| Dato | Finalidad | Base | Retención |
|---|---|---|---|
| `telegram_user_id` | Identificar al usuario entre sesiones | Ejecución del servicio solicitado | Hasta borrado o 12 meses de inactividad |
| `language_code` | Idioma futuro | Idem | Idem |
| Preferencias (personas, días, tiempo, presupuesto, estilos, no gustos) | Planificar | Idem | Idem |
| **Alergias e intolerancias** | Excluir recetas | Idem. Son datos de salud (categoría especial, art. 9 RGPD): se tratan con **consentimiento explícito** (la casilla de confirmación de alergias es también el consentimiento) y se minimizan a la lista cerrada de 14 alérgenos | Idem |
| Texto libre de restricciones | Adaptar organización | Consentimiento (el usuario decide escribirlo). Se avisa bajo el campo: "No escribas aquí datos de salud; para eso habla con Nutri" | Idem |
| `safety_flags` | Mostrar aviso de derivación y no adaptar el menú | Interés legítimo de seguridad | Se borran al vaciar el texto libre |
| Menús, lista, despensa, favoritos | El servicio en sí | Ejecución | 4 semanas de menús; resto hasta borrado |
| Lista de la nevera pegada desde el chat | Llenar la despensa | Ejecución | **No se guarda el texto.** Se analiza en el dispositivo (o, si lo sube el bot, en la función) y solo se conservan los `slug` de ingredientes del catálogo. Lo no reconocido se muestra y se descarta. Las fotos nunca llegan a Nutri Plan: se quedan en el chat con Nutri |
| `events` (pantalla, acción) | Mejorar la app | Interés legítimo; sin contenido | 90 días detalle, agregados indefinidos |

**No se guarda:** nombre, apellidos, usuario de Telegram, foto, teléfono, peso, altura, calorías,
objetivos, diagnósticos, medicación, ubicación, contenido de las conversaciones con Nutri,
`initData` crudo.

## Derechos y controles en la app

- **Borrar mis datos** (Preferencias → pie): borrado físico inmediato de todo lo asociado al
  `telegram_user_id`. Confirmación nativa. Al reabrir, usuario nuevo.
- **Ver mis datos**: la pantalla de Preferencias ya muestra todo lo que se guarda sobre la persona;
  menús y lista son visibles en sus pantallas. Exportación: "Copiar lista" y, en Fase 2,
  `GET /me/export` (JSON) accesible desde Preferencias.
- **Texto informativo** (Preferencias, pie): "Nutri Plan guarda solo tus preferencias de cocina y
  tus menús, asociados a tu identificador de Telegram. No guarda peso, calorías ni datos de salud.
  Puedes borrarlo todo cuando quieras." + enlace a la política de privacidad (página estática en
  el mismo dominio, `/privacidad`).

## Responsable y ubicación

- Responsable del tratamiento: el titular del bot @Nutri_RF_Bot (figura en la política).
- Servidores: Supabase en región UE (Frankfurt o Irlanda). GitHub Pages sirve solo ficheros
  estáticos sin datos personales.
- Encargados: Supabase (base de datos y funciones), GitHub (hosting estático), Anthropic (Fase 3:
  recibe preferencias y catálogo, **no** el identificador de Telegram; se envía un id de sesión
  aleatorio no persistente).
- Telegram recibe lo que el usuario envía por el chat (prerrellenado); eso ya está bajo la
  política de Telegram y del bot.

## Seguridad aplicada (resumen; detalle en doc 04)

- Autenticación criptográfica de origen (`initData` HMAC) en cada petición.
- RLS sin acceso anónimo a tablas de usuario. Secretos solo en servidor.
- Logs sin datos personales (identificador hasheado con sal).
- Borrado en cascada; tarea de purga de inactivos.
- Dependencias auditadas en CI; `gitleaks` para evitar secretos en el repositorio público.

## Repositorio público

- Código con licencia MIT.
- Recetas y textos: licencia a decidir (T-04). Recomendación: **CC BY-NC-SA 4.0** (se pueden
  reutilizar citando la autoría, sin uso comercial). Si se prefiere reservar derechos, `data/`
  puede vivir en un repositorio privado y cargarse en el build.
- Nunca en el repo: `BOT_TOKEN`, claves de Supabase distintas de la pública `anon` (que solo lee
  catálogo), claves de IA, `initData` de ejemplo real (los vectores de prueba usan un token
  ficticio).
- `.env.example` documentado; `SECURITY.md` con contacto para reportar problemas.

## Aviso sobre salud (texto para la app y la política)

> Nutri Plan es una herramienta de organización de comidas. No ofrece consejo médico ni
> nutricional individualizado y no sustituye a un profesional sanitario. Si tienes una situación
> de salud que condiciona tu alimentación (embarazo, diabetes, enfermedad renal, trastorno de la
> conducta alimentaria u otras), consulta con tu médico o dietista-nutricionista antes de seguir
> un menú.
