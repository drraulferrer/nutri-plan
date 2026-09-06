# 01 · Alcance de la v1

## Objetivo

Que una persona que ya habla con Nutri en Telegram pueda, en menos de dos minutos, tener un menú
semanal razonable para su casa, la lista de compra correspondiente y, cualquier día, tres ideas
de receta con lo que tiene en la nevera. Todo desde una pantalla móvil dentro de Telegram, y con
un botón para llevar cualquier duda al chat con Nutri.

## Principios

1. **La app organiza; Nutri personaliza.** La app no da consejo nutricional ni clínico. Lo que
   requiera criterio se lleva al chat.
2. **Nada de alimentos prohibidos.** El lenguaje es de preferencias y alternativas, nunca de
   restricción moral ("evita", "malo", "engorda").
3. **Mínimo dato personal.** Solo lo necesario para planificar (ver doc 12).
4. **Funciona en el supermercado.** La lista de compra se abre y se marca sin conexión.
5. **Cocina real.** Cantidades redondeadas a envases, ingredientes reutilizados durante la
   semana, tiempos honestos.

## Requisitos funcionales

Formato: `RF-xx` · prioridad **M** (imprescindible en v1) / **S** (deseable en v1) / **C** (después).

### Preferencias

| ID | Requisito | Pri |
|---|---|---|
| RF-01 | El usuario indica número de personas (1–8), días a planificar (5 o 7), tiempo habitual para cocinar (15 / 30 / 45 / 60+ min), presupuesto (ajustado / medio / flexible). | M |
| RF-02 | El usuario marca **restricciones y alergias** de una lista cerrada (14 alérgenos UE) y estilos de alimentación (mediterráneo, vegetariano, vegano, sin gluten, sin lactosa, flexitariano). Puede añadir texto libre de "otras restricciones". | M |
| RF-03 | Las alergias se muestran con estilo destacado y exigen **confirmación explícita** ("Confirmo que he revisado mis alergias") antes de generar el primer menú y cada vez que cambien. | M |
| RF-04 | El usuario indica ingredientes que **no le gustan** (chips con autocompletado desde el catálogo de ingredientes). | M |
| RF-05 | Si el texto libre de restricciones menciona embarazo, diabetes, enfermedad renal o trastorno de la conducta alimentaria, la app muestra un aviso de derivación a profesional sanitario y **no** etiqueta el menú como adaptado a esa situación (ver doc 08, "Reglas de seguridad"). | M |
| RF-06 | El usuario activa o desactiva tentempiés. | S |
| RF-07 | Las preferencias se conservan entre sesiones (Fase 1: CloudStorage; Fase 2: base de datos). | M |

### Menú semanal

| ID | Requisito | Pri |
|---|---|---|
| RF-10 | Generar un menú de 5 o 7 días con desayuno, comida y cena (y tentempié si está activo) a partir de las preferencias y del recetario. | M |
| RF-11 | Ningún plato se repite en la semana, salvo recetas de batch cooking marcadas para reutilizarse (máximo 2 apariciones, en días distintos). | M |
| RF-12 | El menú respeta **siempre** alergias, estilo de alimentación e ingredientes que no gustan (restricciones duras). Tiempo y presupuesto son restricciones blandas: se intentan cumplir y se avisa si no se puede. | M |
| RF-13 | Cada plato ofrece hasta 2 **alternativas** de la misma comida con distinta proteína principal ("si no tienes pollo: garbanzos / tofu"). | M |
| RF-14 | Regenerar **una comida**, **un día entero** o **la semana completa**. Al regenerar, los platos marcados como favoritos o "bloqueados" no cambian. | M |
| RF-15 | Ver la receta completa de cualquier plato (ingredientes escalados a las personas, pasos, tiempo, sustituciones, alérgenos). | M |
| RF-16 | Marcar plato como favorito. Los favoritos tienen prioridad en menús futuros. | S |
| RF-17 | El menú actual se guarda y se recupera al volver a abrir la app. Historial de las 4 últimas semanas. | M (actual) / S (historial) |
| RF-18 | Botón "Pedir alternativa a Nutri" en cada plato: abre el chat con un mensaje prerrellenado con día, comida, plato y criterio (ver doc 03). | M |
| RF-19 | Botón "Mejora este menú": abre el chat con un resumen compacto del menú de la semana. | M |

### Lista de compra

| ID | Requisito | Pri |
|---|---|---|
| RF-20 | La lista se genera automáticamente desde el menú, sumando ingredientes iguales entre recetas y escalando al número de personas. | M |
| RF-21 | Agrupada por categorías: Verduras y fruta · Proteínas · Lácteos y alternativas · Despensa · Congelados · Otros. | M |
| RF-22 | Cantidades redondeadas a unidades de compra realistas (huevos enteros, latas, bricks, paquetes) con la cantidad exacta necesaria como detalle. | M |
| RF-23 | Casilla "ya lo tengo" por ítem (lo saca de la lista sin borrarlo; recuperable). Casilla "comprado" (tachado). | M |
| RF-24 | Ajustar raciones desde la lista recalcula cantidades sin regenerar el menú. | M |
| RF-25 | Los ingredientes básicos de despensa (sal, aceite, pimienta, agua) aparecen en una sección plegada "Básicos" y no cuentan como "falta". | S |
| RF-26 | Compartir por Telegram (elige chat o grupo) y copiar como texto plano. | M |
| RF-27 | La lista funciona sin conexión: se abre desde caché y las casillas se sincronizan al recuperar la red. | M |
| RF-28 | Los ingredientes que el usuario tiene en su despensa (pantalla E) se descuentan o marcan automáticamente como "ya lo tengo". | S |

### Cocinar con lo que tengo

| ID | Requisito | Pri |
|---|---|---|
| RF-30 | El usuario escribe o selecciona ingredientes (chips con autocompletado y sinónimos: "calabacín" = "zucchini"). | M |
| RF-31 | La app devuelve **3 recetas** ordenadas por cobertura de ingredientes, cada una con: nombre, tiempo, raciones, ingredientes que faltan, sustituciones posibles y etiqueta ("Tienes todo", "Faltan 2 ingredientes", "Lista en 20 minutos"). | M |
| RF-32 | Filtro rápido: solo lo que puedo hacer en ≤ 20 min; solo vegetariano; solo cena. | S |
| RF-33 | Botón "Preguntar a Nutri" con la receta y los ingredientes que faltan prerrellenados. | M |
| RF-34 | Botón "Me falta un ingrediente": mensaje al chat con el ingrediente concreto y la receta. | M |
| RF-35 | Añadir la receta al menú de la semana en un hueco elegido. | S |
| RF-36 | Los ingredientes introducidos se guardan como **despensa** del usuario para la próxima vez. | M |
| RF-37 | El usuario puede **pegar la lista que Nutri obtiene de una foto de su nevera**; la app la analiza contra el catálogo (plurales, sinónimos, cantidades) y añade a la despensa lo reconocido, mostrando aparte lo que no. | M |
| RF-38 | La despensa se tiene en cuenta al **planificar la semana**: el motor prioriza recetas que gasten lo que ya hay en casa. | M |
| RF-39 | El bot puede escribir la despensa directamente tras analizar la foto (`PUT /bot/context/:tg/pantry`, doc 13). | C |

### Puente con Nutri

| ID | Requisito | Pri |
|---|---|---|
| RF-40 | Todos los mensajes al chat se generan desde plantillas (doc 03) y se **prerrellenan**, nunca se envían sin que el usuario pulse enviar en Telegram. | M |
| RF-41 | La app se puede abrir desde el chat con parámetro `startapp` que lleve directamente a menú, lista o recetas (`menu`, `lista`, `cocinar`). | M |
| RF-42 | El bot puede leer el menú, la lista y las preferencias del usuario a través de un endpoint autenticado por secreto compartido (Fase 4). | C |

## Requisitos no funcionales

| ID | Requisito |
|---|---|
| RNF-01 | **Móvil primero.** Diseñado para 360×640 px como mínimo; probado también en Telegram Desktop (ventana estrecha). |
| RNF-02 | **Tema.** Respeta tema claro y oscuro de Telegram en tiempo real (`themeChanged`). Contraste mínimo AA en ambos. |
| RNF-03 | **Rendimiento.** JS inicial ≤ 200 kB comprimido. Primera pantalla útil < 1,5 s en 4G. Sin librerías de UI pesadas. |
| RNF-04 | **Accesibilidad.** Objetivos táctiles ≥ 44 px, textos escalables, etiquetas ARIA en casillas y chips, sin depender solo del color (alergias: icono + texto). |
| RNF-05 | **Seguridad.** `initData` validado en servidor en cada petición. Un usuario nunca ve datos de otro. Secretos solo en el servidor. Cabeceras CSP en el frontend. |
| RNF-06 | **Privacidad.** Sin datos clínicos, sin peso, sin calorías. Borrado completo a petición. Ver doc 12. |
| RNF-07 | **Disponibilidad.** Frontend estático (sin servidor). Si el backend falla, la app sigue mostrando el último menú y lista desde caché con aviso "sin conexión". |
| RNF-08 | **Determinismo.** Misma entrada + misma semilla → mismo menú (para pruebas y para "deshacer"). |
| RNF-09 | **Coste.** Capa gratuita de Supabase y GitHub Pages suficiente para < 500 usuarios activos. |

## Fuera de alcance (v1)

- Seguimiento de peso, calorías, macros u objetivos.
- Pagos, suscripciones, Telegram Stars.
- Planes para situaciones clínicas (embarazo, diabetes, renal, TCA): derivación, no plan.
- Fotos de recetas generadas por IA (se usan iconos o sin imagen).
- Multiusuario en un mismo hogar con cuentas enlazadas (se cubre compartiendo la lista).
- Otros idiomas.
- Notificaciones proactivas desde la app (el bot ya puede escribir al usuario).
