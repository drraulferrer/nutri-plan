# 03 · Integración con Telegram

Basado en <https://core.telegram.org/bots/webapps> y <https://core.telegram.org/api/links>
(consultados el 2026-09-05).

## 1. SDK

```html
<!-- apps/web/index.html, antes de cualquier script propio -->
<script src="https://telegram.org/js/telegram-web-app.js?63"></script>
```

- El SDK expone `window.Telegram.WebApp`. La app envuelve el objeto en `apps/web/src/tg/` con
  tipos propios y un **modo simulado** para el navegador de desarrollo (cuando `initData` está
  vacío): usuario ficticio, tema claro/oscuro conmutable, botones dibujados en pantalla.
- Al arrancar: `ready()` en cuanto se pinta la primera pantalla; `expand()`;
  `disableVerticalSwipes()` (las listas largas no deben cerrar la app al deslizar);
  `setHeaderColor('secondary_bg_color')`, `setBackgroundColor('bg_color')`,
  `setBottomBarColor('bottom_bar_bg_color')`.
- Comprobar `isVersionAtLeast('7.10')` para SecondaryButton y `bottom_bar_bg_color`; si la
  versión es menor, la acción secundaria pasa a un botón dentro de la página.
- `enableClosingConfirmation()` solo mientras hay cambios sin guardar en Preferencias.

## 2. Modos de lanzamiento que usaremos

| Modo | Cómo se abre | `initData` que aporta | Uso en Nutri Plan |
|---|---|---|---|
| **Main Mini App** | Botón "Abrir app" del perfil del bot; enlace `https://t.me/Nutri_RF_Bot?startapp=<param>` | `user`, `auth_date`, `hash`, `start_param` | **Principal.** Se configura en BotFather (sección 8). |
| **Botón de menú** (junto al campo de texto del chat) | BotFather → Menu Button | `user`, `query_id` | Acceso rápido desde el chat. Misma URL. |
| **Botón inline en un mensaje del bot** | El bot envía un mensaje con `InlineKeyboardButton(web_app=WebAppInfo(url))` | `user`, `query_id` | Nutri responde "Te he preparado un menú, ábrelo aquí" con botón. Permite `answerWebAppQuery`. |
| Botón de teclado (`KeyboardButton.web_app`) | — | permite `sendData()` | **No se usa** (cierra la app al enviar y solo funciona en chat privado). |
| Modo inline / menú de adjuntos | — | — | No en v1. |

`start_param` admitido: `menu`, `lista`, `cocinar`, `receta_<slug>`. Cualquier otro valor se
ignora y se abre Inicio. Ejemplo de enlace que el bot puede enviar:
`https://t.me/Nutri_RF_Bot?startapp=lista`.

## 3. Tema y viewport

- Usar exclusivamente las variables CSS que inyecta Telegram: `--tg-theme-bg-color`,
  `--tg-theme-text-color`, `--tg-theme-hint-color`, `--tg-theme-link-color`,
  `--tg-theme-button-color`, `--tg-theme-button-text-color`, `--tg-theme-secondary-bg-color`,
  `--tg-theme-header-bg-color`, `--tg-theme-accent-text-color`, `--tg-theme-section-bg-color`,
  `--tg-theme-section-header-text-color`, `--tg-theme-subtitle-text-color`,
  `--tg-theme-destructive-text-color`, `--tg-theme-section-separator-color`,
  `--tg-theme-bottom-bar-bg-color`.
- Suscribirse a `themeChanged` y `viewportChanged`; no cachear colores en JS.
- Altura: `var(--tg-viewport-stable-height)` para el contenedor principal; márgenes inferiores
  con `var(--tg-content-safe-area-inset-bottom)` + `var(--tg-safe-area-inset-bottom)` para no
  quedar bajo el BottomButton ni la barra de gestos.
- Definir en `:root` valores de reserva para cada variable (modo desarrollo en navegador) y una
  clase `.dark` que se activa con `colorScheme === 'dark'` para lo poco que no cubra Telegram
  (sombras, imágenes).

## 4. Autenticación: `initData`

### En el cliente

Cada petición al backend lleva la cabecera:

```
Authorization: tma <Telegram.WebApp.initData>
```

`initData` es la cadena cruda (query-string firmada). **Nunca** se usa `initDataUnsafe.user.id`
como identidad; solo sirve para pintar el nombre en Inicio.

### En el servidor (Edge Function)

```ts
// supabase/functions/api/auth.ts — validación HMAC-SHA256 según la documentación oficial
export async function verifyInitData(raw: string, botToken: string, maxAgeSec = 86_400) {
  const params = new URLSearchParams(raw);
  const hash = params.get('hash');
  if (!hash) throw new AuthError('missing_hash');
  params.delete('hash');                            // solo se excluye `hash`; `signature` SÍ entra en el HMAC

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const enc = new TextEncoder();
  const secretKey = await hmac(enc.encode('WebAppData'), enc.encode(botToken));   // HMAC(bot_token, key="WebAppData")
  const expected = toHex(await hmac(secretKey, enc.encode(dataCheckString)));     // HMAC(data_check_string, secret_key)
  if (!timingSafeEqual(expected, hash)) throw new AuthError('bad_hash');

  const authDate = Number(params.get('auth_date'));
  if (!authDate || Date.now() / 1000 - authDate > maxAgeSec) throw new AuthError('expired');

  const user = JSON.parse(params.get('user') ?? 'null');
  if (!user?.id) throw new AuthError('no_user');
  return { telegramUserId: BigInt(user.id), languageCode: user.language_code, startParam: params.get('start_param') };
}
```

Reglas:
- Comparación en tiempo constante.
- `auth_date` con antigüedad máxima **24 h**. Si expira, la app pide al usuario reabrirla
  (Telegram regenera `initData` en cada apertura). Se muestra "Sesión caducada · vuelve a abrir
  Nutri Plan".
- `bot_id` no se necesita para HMAC; sí para la validación Ed25519 con clave pública de Telegram
  (`e7bf03a2…242d` en producción), cuya cadena de comprobación excluye `hash` **y** `signature`.
  El backend la usa solo como diagnóstico (`verifyTelegramSignature`) cuando falla el HMAC.
- Las peticiones sin cabecera o con fallo devuelven `401` con `{ error: 'unauthorized' }` y
  el frontend muestra la pantalla "Abre Nutri Plan desde Telegram".
- El identificador de usuario que se guarda es `telegram_user_id` (bigint). No se guardan
  nombre, apellido, usuario ni foto.

## 5. Puente app → chat de Nutri

**Mecanismo elegido (T-07):** prerrellenar el campo de texto del chat con el bot.

```ts
export function askNutri(message: string) {
  const text = message.length > 3_500 ? message.slice(0, 3_490) + '…' : message;   // margen bajo los 4096 de Telegram
  Telegram.WebApp.openTelegramLink(`https://t.me/Nutri_RF_Bot?text=${encodeURIComponent(text)}`);
}
```

- Desde Bot API 7.0 `openTelegramLink` **no cierra** la Mini App: el usuario ve el chat con el
  texto listo, lo envía (pudiendo editarlo) y vuelve a la app.
- El texto no puede empezar por `@` (Telegram lo interpreta como consulta inline); las
  plantillas empiezan siempre por una palabra.
- El mensaje llega a Nutri como un **mensaje normal del usuario**, así que Nutri responde con
  todo su contexto conversacional. No requiere `query_id`, `sendData` ni backend.
- Alternativa cuando `initDataUnsafe.query_id` existe (apertura desde botón inline o de menú):
  el backend puede llamar a `answerWebAppQuery` para insertar un mensaje **en nombre del
  usuario**. Se reserva para la Fase 4 (por ejemplo, enviar el menú como mensaje formateado).

### Plantillas de mensaje

Todas en español, primera persona, con una referencia corta `[NP …]` al final que Nutri puede
usar para localizar el dato exacto cuando exista el puente bot → app (Fase 4). Sin la Fase 4 la
referencia es inocua.

| ID | Disparador | Plantilla |
|---|---|---|
| **M1** | Pedir alternativa a Nutri (plato) | `Hola Nutri 👋 Quiero cambiar la {comida} del {día} ({plato}) por algo {criterio}. Cocino para {n} persona(s){restricciones}. [NP menu:{menuId} slot:{slotId}]` |
| **M2** | Me falta un ingrediente (receta) | `No tengo {ingrediente} para hacer «{receta}». ¿Qué puedo usar en su lugar? [NP receta:{slug}]` |
| **M3** | Preguntar a Nutri (receta) | `Tengo una duda sobre la receta «{receta}» ({tiempo} min, {raciones} raciones): {pregunta o "¿me la puedes adaptar?"} [NP receta:{slug}]` |
| **M4** | Mejora este menú (semana) | `Este es mi menú de la semana del {fecha}. ¿Qué ajustarías?\n\n{por día: "Lun · D: … · C: … · Ce: …"}\n\nSomos {n}{restricciones}. [NP menu:{menuId}]` |
| **M5** | Cocinar con lo que tengo, sin resultado bueno | `Tengo {ingredientes} y no sé qué hacer para {comida}. ¿Alguna idea en menos de {min} minutos?` |
| **M6** | Aviso de derivación (doc 08) | `He indicado en Nutri Plan que {situación}. ¿Qué debería tener en cuenta y con quién debería consultarlo?` |

`{restricciones}` se rellena como `, {estilo}, sin {alérgenos}` solo si existen. `{criterio}` sale
de la hoja de criterios rápidos (vegetariano · menos de 20 minutos · sin horno · más barato ·
texto libre).

## 6. Compartir y copiar la lista

```ts
const appLink = 'https://t.me/Nutri_RF_Bot?startapp=lista';
Telegram.WebApp.openTelegramLink(
  `https://t.me/share/url?url=${encodeURIComponent(appLink)}&text=${encodeURIComponent(listaTexto)}`
);
```

Plantilla **L1** (texto plano, ≤ 3 500 caracteres; si se supera, se omiten las cantidades exactas
y después los básicos):

```
🛒 Lista de compra · 8–14 sep · 2 personas

VERDURAS Y FRUTA
☐ Espinacas · 400 g
☐ Tomate · 6 ud
PROTEÍNAS
☐ Huevos · 1 docena
…

Hecha con Nutri Plan (@Nutri_RF_Bot)
```

Copiar: `navigator.clipboard.writeText(listaTexto)` con aviso `showAlert('Lista copiada')` si
falla el toast propio. Fase 2+: opción "Compartir como mensaje bonito" con
`savePreparedInlineMessage` (Bot API) + `Telegram.WebApp.shareMessage(id)`.

## 7. Puente bot → app (Fase 4, opcional)

Para que Nutri pueda responder a "cambia la cena del jueves" con conocimiento del menú real:

1. El backend expone `GET /bot/context/{telegram_user_id}` y `POST /bot/menus/{id}/slots/{slot}`
   autenticados con cabecera `X-Bot-Secret` (secreto compartido, rotado desde Supabase). Ver doc 06.
2. El agente del bot (Hermes u otro) recibe dos herramientas: `nutri_plan_get_context` y
   `nutri_plan_apply_change`. Si el mensaje del usuario contiene `[NP …]`, el agente llama a la
   primera antes de responder.
3. El bot puede enviar al usuario un mensaje con botón inline
   `web_app: { url: 'https://<app>/?screen=menu' }` o el enlace `t.me/Nutri_RF_Bot?startapp=menu`.

Depende de que la plataforma del bot permita herramientas HTTP (pregunta abierta 5, doc 00).

## 8. Configuración en BotFather

Cuando la URL HTTPS esté publicada:

1. `@BotFather` → `/mybots` → **@Nutri_RF_Bot** → **Bot Settings** → **Configure Mini App** →
   **Enable Mini App** → pegar la URL (p. ej. `https://drraulferrer.github.io/nutri-plan/`).
2. En el mismo menú: título **Nutri Plan**, descripción corta ("Menú semanal, lista de compra y
   recetas con lo que tienes"), icono 640×360 (vista previa) y, si se quiere, vídeo demo.
3. **Menu Button**: `Bot Settings → Menu Button → Configure menu button` con la misma URL y
   texto "Nutri Plan".
4. Comprobar que `/setdomain` no es necesario (solo aplica a Login Widget).
5. Probar los enlaces: `https://t.me/Nutri_RF_Bot?startapp`, `…?startapp=lista`,
   `…?startapp=menu&mode=compact`.

## 9. Depuración

| Plataforma | Cómo |
|---|---|
| Navegador de escritorio | `npm run dev` → la app arranca en modo simulado (sin `initData`). |
| Telegram Desktop | Ajustes → Avanzado → Experimental → **Enable webview inspecting**; clic derecho en la Mini App → Inspeccionar. |
| Android | Ajustes → pulsar 10 veces en la versión → **Enable WebView Debug**; luego `chrome://inspect` en Chrome de escritorio con el móvil por USB. |
| iOS | Safari → Desarrollo → dispositivo → webview de Telegram (activar Web Inspector en Ajustes → Safari → Avanzado). |
| Servidor de pruebas de Telegram | Solo si se necesita probar pagos; no en v1. |

Para validar `initData` en local: `supabase functions serve api --env-file .env.local`, y copiar
la cadena real desde Telegram Desktop (`Telegram.WebApp.initData` en la consola).
