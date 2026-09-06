# Nutri Plan

Mini App de Telegram para **@Nutri_RF_Bot**: menú semanal, lista de compra y recetas con lo que
tienes en casa. La app organiza; Nutri, en el chat, personaliza y conversa.

**Estado:** Fases 1–4 codificadas (Mini App, backend Supabase, generación con IA y puente con el bot); despliegue del backend pendiente · especificación v1.0 en
[`docs/`](docs/00-decisiones.md). Recetario: **61 recetas** (58 borradores con la etiqueta `revisar`,
pendientes de revisión por el autor) y 69 ingredientes.

| Función | Resumen |
|---|---|
| **Menú semanal** | 5 o 7 días, desayuno · comida · cena (tentempié opcional). Alternativas por plato. Regenerar comida, día o semana. |
| **Lista de compra** | Generada desde el menú, agrupada por categorías, escalada al número de personas, casillas "ya lo tengo", compartir/copiar. |
| **Cocinar con lo que tengo** | Indicas ingredientes y recibes 3 recetas con lo que falta, tiempo y raciones. |
| **Mi despensa** | Pega la lista que Nutri saca de la foto de tu nevera: se reconoce contra el recetario y se usa al planificar la semana. |
| **Puente con Nutri** | Botones que llevan el contexto al chat del bot para que Nutri ajuste, sustituya o mejore. |

Fuera de la v1: peso, calorías, objetivos, pagos, datos clínicos.

## Estructura

```
apps/web/          Mini App (React + Vite + TypeScript) → GitHub Pages
packages/core/     Lógica pura compartida: tipos, esquemas, escalado, lista, matcher, planificador
supabase/          Migraciones SQL + Edge Function `api` (Deno + Hono) con validación de initData
data/              Recetario en YAML (una receta por fichero) + catálogo de ingredientes
docs/              Especificación completa (13 documentos)
scripts/           Validación del recetario y generación de JSON para la app
```

## Empezar

```bash
npm ci
npm run dev            # http://localhost:5173/nutri-plan/ (modo simulado, sin Telegram)
npm test
npm run recipes:check  # valida data/ y muestra la matriz de cobertura
```

Dentro de Telegram la app se abre desde el perfil del bot o con
`https://t.me/Nutri_RF_Bot?startapp=menu` (también `lista`, `cocinar`).

## Documentación

| Nº | Documento |
|---|---|
| 00 | [Decisiones](docs/00-decisiones.md) |
| 01 | [Alcance v1](docs/01-alcance-v1.md) |
| 02 | [Pantallas y flujos](docs/02-pantallas.md) |
| 03 | [Integración con Telegram](docs/03-integracion-telegram.md) |
| 04 | [Arquitectura](docs/04-arquitectura.md) |
| 05 | [Modelo de datos](docs/05-modelo-datos.md) |
| 06 | [API](docs/06-api.md) |
| 07 | [Recetario base](docs/07-recetario.md) |
| 08 | [Generación de menús](docs/08-generacion-menus.md) |
| 09 | [Lista de compra y matcher](docs/09-lista-compra-y-matcher.md) |
| 10 | [Plan por fases](docs/10-plan-fases.md) |
| 11 | [Pruebas](docs/11-pruebas.md) |
| 12 | [Privacidad y datos](docs/12-privacidad.md) |
| 13 | [Integración con el bot](docs/13-integracion-bot.md) |

## Licencias

Código bajo [MIT](LICENSE). Recetario e ingredientes (`data/`) bajo CC BY-NC-SA 4.0
([detalle](data/LICENSE.md)).

## Fuentes

- Telegram Mini Apps: <https://core.telegram.org/bots/webapps>
- Enlaces profundos de Telegram: <https://core.telegram.org/api/links>
