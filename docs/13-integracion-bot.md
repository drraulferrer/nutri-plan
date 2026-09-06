# 13 · Integración con el bot (Fase 4)

Cómo el agente de Nutri (@Nutri_RF_Bot, sobre Hermes u otra plataforma) lee y cambia el menú del
usuario. Complementa el doc 03 §7. Implementación: `supabase/functions/api/bot-routes.ts`.

## Autenticación

Todas las rutas `/bot/*` exigen la cabecera `X-Bot-Secret: <BOT_SHARED_SECRET>`. Es un secreto
compartido de 32 bytes aleatorios guardado en los secretos de Supabase y en la configuración del
bot. Sin él, o si no está configurado en el servidor, la respuesta es `403` sin detalle.

```bash
openssl rand -hex 32        # genera el secreto
supabase secrets set BOT_SHARED_SECRET=<valor>
```

El identificador de usuario es `telegram_user_id` (el mismo que el bot recibe en cada mensaje).
Si el usuario nunca abrió Nutri Plan, las rutas devuelven `404` con el mensaje "Este usuario aún no
ha abierto Nutri Plan": el bot debe invitarle a abrirla (`https://t.me/Nutri_RF_Bot?startapp`).

## Rutas

Base: `https://<ref>.supabase.co/functions/v1/api`.

| Método y ruta | Cuerpo | Respuesta | Uso |
|---|---|---|---|
| `GET /bot/context/:telegram_user_id` | — | `{ preferences, menu: { week_start, days, ref, notes, plan: [{ day_index, day, meals: { desayuno: {recipe, name, locked}, comida, cena, tentempie? } }] }, shopping: { total, checked, pending: string[] }, pantry: string[], favorites: string[] }` (≈ 2 kB) | Antes de responder a cualquier mensaje que hable del menú, la lista o "lo que tengo". |
| `GET /bot/context/:telegram_user_id/slots/:day/:meal` | — | `{ slot, recipe, alternatives: [{slug, name, time_min, protein_group}] }` | Resolver la referencia `[NP menu:<ref> slot:<day>-<meal>]` de la plantilla M1. |
| `POST /bot/context/:telegram_user_id/slots/:day/:meal` | `{ "recipe_slug": "…" \| null }` | `{ slot, shopping_list_delta: { added, removed, changed } }` | Aplicar el cambio acordado. `null` = comer fuera. Rechaza (422) recetas fuera del catálogo, de otro tipo de comida o que choquen con alergias, estilo o ingredientes que no gustan. |
| `GET /bot/recipes/:slug` | — | `Recipe` completa | Explicar, adaptar o sustituir ingredientes. |

`day` va de 0 (lunes) a 6; `meal` es `desayuno`, `comida`, `cena` o `tentempie`.

## Herramientas para el agente

`bot/tools.json` contiene las definiciones en formato de *function calling* (compatible con
OpenAI/Hermes y trivial de adaptar a otros). Resumen:

| Herramienta | Cuándo la usa el agente |
|---|---|
| `nutri_plan_get_context` | El mensaje menciona menú, semana, lista, compra, despensa o incluye `[NP …]`. |
| `nutri_plan_get_slot` | El mensaje incluye `[NP menu:… slot:d-m]` o el usuario habla de una comida concreta ("la cena del jueves"). |
| `nutri_plan_set_slot` | El usuario ha aceptado una alternativa concreta. Siempre proponer primero, cambiar después. |
| `nutri_plan_get_recipe` | El usuario pregunta por una receta o dice que le falta un ingrediente (`[NP receta:slug]`). |

Instrucción sugerida para el sistema del agente:

> Nutri Plan es la app donde el usuario organiza su menú semanal y su lista de compra. Cuando el
> usuario hable de su menú, de una comida concreta, de la lista o de lo que tiene en casa, consulta
> `nutri_plan_get_context` antes de responder. Si propone cambiar un plato, ofrece 2 opciones del
> catálogo (usa las `alternatives` de `nutri_plan_get_slot` o recetas del catálogo que cumplan sus
> restricciones) y aplica el cambio con `nutri_plan_set_slot` solo cuando el usuario elija. Nunca
> inventes recetas que no estén en el catálogo cuando vayas a cambiar el menú. Confirma al final
> qué cambió en la lista de compra usando `shopping_list_delta`.

## Conversación de prueba (definición de hecho, doc 10)

1. En la app, el usuario pulsa "Pedir alternativa a Nutri" en la cena del jueves → el chat se abre
   con el mensaje M1 y la referencia `[NP menu:ab12cd34 slot:3-cena]`.
2. El agente llama a `nutri_plan_get_slot(telegram_user_id, 3, "cena")`, lee la receta actual y
   las alternativas, y propone dos.
3. El usuario elige una → `nutri_plan_set_slot(telegram_user_id, 3, "cena", "<slug>")`.
4. El agente responde con el cambio y el delta de la lista. Al volver a la app, el menú y la lista
   ya están actualizados (la app recarga el estado del servidor al abrirse).

## Ejemplos con curl

```bash
API=https://<ref>.supabase.co/functions/v1/api
curl -s -H "X-Bot-Secret: $BOT_SHARED_SECRET" $API/bot/context/123456789 | jq .data.menu.plan[3]
curl -s -H "X-Bot-Secret: $BOT_SHARED_SECRET" -H 'Content-Type: application/json' \
  -X POST $API/bot/context/123456789/slots/3/cena -d '{"recipe_slug":"crema-de-calabacin"}'
```

## Privacidad

El bot solo recibe lo que ya ve el usuario en la app: preferencias de cocina, menú, lista y
despensa. Nunca `initData`, ni datos de otros usuarios. Cada llamada queda en los logs de la
función con el identificador hasheado (doc 12).
