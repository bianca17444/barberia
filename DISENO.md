# BELABARBERÍA — Diseño UX/UI

Documento de trabajo para el *Informe de Análisis Gráfico y UX/UI*. Se completa fase por fase.
Prototipo Figma: archivo del proyecto (página **01 · Identidad visual** y siguientes). Las 10 pantallas originales quedan intactas en la primera página como material del "antes".

---

## Fase 1 — Diagnóstico (19/10/2026)

**Material existente para documentar la evolución** (todo real, nada reconstruido):

| Etapa | Material | Dónde está |
|---|---|---|
| Antes | Web Vite con la estética anterior | `index.html`, `src/` |
| Antes | Primera app móvil (un solo archivo) | `_respaldo_2026-10-16/mobile/App.js` |
| Primer prototipo | 5 pantallas, acentos blancos | Figma, página 1, fila superior |
| Rediseño | Las mismas 5 pantallas con acento champán | Figma, página 1, fila inferior |
| Versión accesible | Paleta corregida con WCAG | Figma, página "01 · Identidad visual" + este documento |
| Versión final | App móvil actual + prototipo completo | `mobile/` + Figma (fases siguientes) |

> Las capturas del "antes" en el celular deben tomarse manualmente si se quieren mostrar en el dispositivo real.

**Hallazgos del Figma original** (medidos con la API de Figma sobre las 5 pantallas rediseñadas):
- Familia: **Inter** (Regular, Medium, Semi Bold, Bold). Se mantiene.
- Colores: fondo `#0D0D0D`, superficies `#1A1A1A` y `#262626`, acento champán `#C5A880`, texto `#F5F5F5`, secundario `#999999`, éxito `#48C784`.
- **61 textos entre 9 y 11 px**: pasos del indicador de avance, pestañas, subtítulos y avisos legales. Son demasiado chicos para leer cómodo y no escalan bien.
- Horarios no disponibles: texto `#262626` sobre `#1A1A1A` = **1,15:1**, prácticamente invisible.
- Sin sombras ni niveles de elevación: todo está al mismo plano.
- Íconos hechos con emoji (🔍 📍 💳), que el lector de pantalla anuncia con su nombre literal.
- Muestra un modelo de varias barberías y un pago con tarjeta y "cargo por servicio" que el software no tiene. Se adapta a lo real: una barbería, pago por transferencia o en el local.

---

## Fase 2 — Identidad visual

### Concepto
Una barbería clásica con atención moderna: **negro cálido** (cuero, madera oscura, ambiente de salón) y **champán** (latón de los sillones, detalles de navaja y espejo). Transmite profesionalismo y calidad sin caer en clichés: nada de rayas de poste, calaveras ni texturas de madera. La precisión se expresa con alineaciones estrictas, una sola familia tipográfica y espacios regulares.

### Decisiones sobre el Figma
| Se mantiene | Se corrige | Motivo |
|---|---|---|
| Negro + champán `#C5A880` | Fondo `#0D0D0D` → `#111111`; texto `#F5F5F5` → `#F2EFEA` | Con blanco casi puro sobre casi negro (17,8:1) aparece halo y deslumbramiento en pantallas OLED y para personas con astigmatismo. Bajando un poco el contraste sigue en 16,5:1 (AAA) y cansa menos. |
| Superficies grises | Cuatro niveles definidos (nivel 0 a 3) | Las superficies comunican profundidad (Spatial UI). Cada nivel es un poco más claro, como en Material Design. |
| Secundario `#999999` | `#B3AEA6` (cálido) | Más contraste en tarjetas (6,9:1 contra 5,3:1) y más coherente con el champán. |
| Verde éxito | `#5FD08F` | Mismo tono, más luminoso: 7,9:1 sobre las superficies. |
| — | Se agregan advertencia, error e info | El Figma no tenía estados de error ni de turno. |
| — | Se agrega **modo claro** | Lo pide la consigna y la app lo tiene. |

### Paleta — modo oscuro (predeterminado)
Contraste = relación de luminancia WCAG, calculada (no estimada) contra `fondo/base` y `fondo/superficie-2`.

| Token | HEX | Función / dónde se usa | Por qué | Contraste | WCAG |
|---|---|---|---|---|---|
| fondo/base | `#111111` | Fondo de cada pantalla (nivel 0) | Negro no puro: evita halo y deja ver las sombras | texto: 16,46:1 | AAA |
| fondo/superficie | `#1B1B1B` | Tarjetas, barra inferior (nivel 1) | Separa contenido del fondo sin líneas | texto: 15,02:1 | AAA |
| fondo/superficie-2 | `#262626` | Tarjeta destacada, chips, campos (nivel 2) | Igual al Figma | texto: 13,20:1 | AAA |
| fondo/superficie-3 | `#303030` | Hojas inferiores y modales (nivel 3) | El elemento más cercano al usuario es el más claro | texto: 11,51:1 | AAA |
| marca/primario | `#C5A880` | Relleno del botón principal, día y hora seleccionados | Champán del Figma: calidez, calidad, latón | vs. fondo 8,35:1 | 1.4.11 ✓ |
| marca/sobre-primario | `#111111` | Texto e íconos sobre champán | Texto oscuro sobre claro, máximo contraste | 8,35:1 | AAA |
| marca/acento | `#D4BC98` | Precios, enlaces, pestaña activa | Champán más claro para leerse como texto chico | 8,25–10,29:1 | AAA |
| texto/principal | `#F2EFEA` | Títulos y lectura | Blanco hueso cálido | 13,20–16,46:1 | AAA |
| texto/secundario | `#B3AEA6` | Subtítulos, metadatos | Jerarquía sin perder legibilidad | 6,86–8,56:1 | AA |
| texto/terciario | `#9A958D` | Placeholders, ayudas | El tono más tenue que todavía cumple AA | 5,09–6,35:1 | AA |
| borde/campo | `#7A756D` | Contorno de campos y controles | Se ve dónde escribir | 3,31–4,13:1 | 1.4.11 ✓ (≥ 3:1) |
| borde/divisor | `#333333` | Separadores | Decorativo: no transmite información | — | No aplica |
| estado/exito | `#5FD08F` | Confirmado, pagado, avisos de éxito | Verde = listo | 7,86–9,81:1 | AAA |
| estado/advertencia | `#F0B54A` | Pendiente, pago informado | Ámbar = espera, atención | 8,23–10,26:1 | AAA |
| estado/error | `#FF8A80` | Cancelado, errores de formulario | Rojo suavizado: legible sobre oscuro sin "vibrar" | 6,63–8,27:1 | AA |
| estado/info | `#8CB8F0` | Completado, avisos informativos | Azul = neutro, terminado | 7,37–9,20:1 | AAA |

### Paleta — modo claro
| Token | HEX | Contraste | WCAG | Nota |
|---|---|---|---|---|
| fondo/base | `#F6F3EE` | texto: 16,60:1 | AAA | Marfil: más cálido y menos encandilante que el blanco |
| fondo/superficie | `#FFFFFF` | texto: 18,37:1 | AAA | Las tarjetas "suben" hacia la luz |
| fondo/superficie-2 | `#EDE8E0` | texto: 15,07:1 | AAA | |
| fondo/superficie-3 | `#E3DCD1` | texto: 13,50:1 | AAA | |
| marca/primario | `#C5A880` | con su texto 8,13:1 | AAA | Contra el fondo solo da 2,04:1 → el botón lleva **borde bronce** `#7A5A1F` (5,73:1) para cumplir 1.4.11 |
| marca/sobre-primario | `#161412` | 8,13:1 | AAA | |
| marca/acento | `#7A5A1F` | 5,20–5,73:1 | AA | El champán como texto sobre claro falla (2,04:1); se oscurece a bronce |
| texto/principal | `#161412` | 15,07–16,60:1 | AAA | |
| texto/secundario | `#55504A` | 6,54–7,21:1 | AA | |
| texto/terciario | `#6B655D` | 4,72–5,21:1 | AA | |
| borde/campo | `#7D766C` | 3,68–4,05:1 | 1.4.11 ✓ | |
| borde/divisor | `#DDD6CB` | — | No aplica | Decorativo |
| estado/exito | `#1A6E3E` | 5,15–5,67:1 | AA | |
| estado/advertencia | `#8A5A00` | 4,86–5,36:1 | AA | |
| estado/error | `#B3261E` | 5,36–5,91:1 | AA | |
| estado/info | `#1F5E99` | 5,52–6,08:1 | AA | |

Verificación: script `diseno/contraste.mjs` (fórmula de luminancia relativa WCAG 2.x). **0 combinaciones de texto por debajo de 4,5:1 y 0 bordes de control por debajo de 3:1**, en los dos modos.

### Estados de turno
| Estado | Ícono | Color | Texto |
|---|---|---|---|
| Pendiente | reloj | advertencia | "Pendiente" |
| Confirmado | ✓ | éxito | "Confirmado" |
| Pago informado | billete | advertencia | "Pago informado" |
| Pagado | ✓ | éxito | "Pagado" |
| Completado | bandera | info | "Completado" |
| Cancelado | ✕ | error | "Cancelado" |

**Comprobación con daltonismo** (simulación Machado et al., 2009, severidad 100 %): con deuteranopía, en modo oscuro "Confirmado" `#5FD08F` se percibe como `#BFB693` y "Cancelado" `#FF8A80` como `#C2B57E`, casi iguales. Con protanopía pasa algo parecido. Conclusión aplicada: **el estado nunca depende solo del color** (WCAG 1.4.1). Siempre va ícono + palabra + color.

### Psicología del color (aplicada, no decorativa)
- **Negro cálido:** sobriedad y exclusividad; hace que fotos y precios resalten. Cálido (no azulado) para no sentirse frío ni "tech".
- **Champán:** calidad y tradición (latón, navaja). Se reserva para **una** acción por pantalla y para la selección, así guía la mirada (jerarquía).
- **Verde / ámbar / rojo / azul:** convenciones aprendidas (listo, espera, problema, terminado). Reducen la carga cognitiva porque el usuario ya las conoce.

### Tipografía — Inter (una sola familia)
Elegida porque ya está en el Figma, se diseñó para pantallas, tiene números tabulares (precios y horarios alineados) y distingue bien I/l/1. Una sola familia da consistencia; la jerarquía sale de tamaño y peso.

| Estilo | Tamaño / interlínea | Peso | Uso |
|---|---|---|---|
| Display | 32 / 38 | Bold | Nombre de la marca en bienvenida |
| Título 1 | 24 / 30 | Bold | Título de pantalla |
| Título 2 | 20 / 26 | Semi Bold | Secciones, títulos de hojas |
| Título 3 | 17 / 22 | Semi Bold | Título de tarjeta (servicio, barbero, turno) |
| Cuerpo | 16 / 24 | Regular | Texto de lectura, valores de campos |
| Cuerpo secundario | 14 / 20 | Regular | Descripciones, metadatos |
| Etiqueta | 13 / 18 | Medium | Etiquetas de campos, chips |
| Botón | 16 / 20 | Semi Bold | Todos los botones |
| Precio | 18 / 24 | Bold, acento | Precios |
| Duración | 14 / 20 | Medium + ícono reloj | "30 min" |
| Estado | 13 / 18 | Semi Bold + ícono | Insignias de estado |
| Error | 14 / 20 | Medium + ícono, color error | Mensajes de error de campos |
| Navegación | 12 / 16 | Semi Bold | Etiquetas de la barra inferior (mínimo absoluto) |

- **Tamaño mínimo: 12 px** (antes había textos de 9–11 px). Los textos respetan el tamaño de letra del sistema del celular (WCAG 1.4.4). *Que nada se corte con la letra al 200 % debe comprobarse manualmente en el dispositivo.*
- En la app, los estilos se aplican en la Fase 3 cargando Inter con `expo-font`.

### En Figma (creado en esta fase)
- Colecciones de variables **BB · Primitivas** (29 colores), **BB · Color Oscuro** y **BB · Color Claro** (16 tokens semánticos cada una, con descripción y alcance). El plan de Figma permite un solo modo por colección, por eso hay dos colecciones paralelas con los mismos nombres.
- 13 estilos de texto **BB/…** con Inter.
- Página **01 · Identidad visual**: tableros Oscuro y Claro con muestras enlazadas a las variables, contraste medido, escala tipográfica, estados y botones.

---

## Fase 3 — Sistema de diseño (aplicado en la app)

| Pieza | Decisión | Dónde está |
|---|---|---|
| Tokens de color | 2 paletas con los mismos nombres (`bg`, `surface` 1–3, `gold`, `goldFill`, `text`, `muted`, `faint`, `borderInput`, estados) | `mobile/src/paletas.js` · Figma: BB · Color Oscuro / Claro |
| Elevación | 4 niveles: 0 fondo · 1 tarjetas · 2 destacado y selección · 3 hojas, modales y avisos. En oscuro la profundidad la da la superficie más clara; la sombra acompaña | `elevacion()` en `mobile/src/ui.js` |
| Tipografía | Escala de 13 estilos, mínimo 12 px, números tabulares en precios, horarios, puntos y cuenta regresiva | `crearEstilos()` |
| Espaciado | Base de 4 px: 8 · 10 · 12 · 14 · 16 · 20 · 24. Margen lateral de 20 | `content`, `card`, `opcion` |
| Radios | 12 campos · 14 botones · 16 tarjetas · 22 chips · 24 hojas | |
| Objetivos táctiles | Botón 52 px (chico 44), chip, segmento, corazón e interruptor 44 px | |
| Componentes | Boton, Campo, Tarjeta, Chip, Pestanas, Estado, Ticket, Hoja, Seleccionable, Avatar, Corazon, Interruptor, Vacio, ErrorCaja, Avisos. Nuevos: **Progreso**, **CuentaRegresiva**, **Barras**, **Ranking**, **Dato**, **Foto** | `ui.js`, `pantallas/Club.js` |
| Estados de interacción | Presionado (opacidad 0,8), seleccionado (relleno champán + `accessibilityState.selected`), deshabilitado (0,35–0,4 + `disabled`), cargando (spinner en el botón), vacío, error con reintento | |
| Microinteracciones | Corazón de favoritos animado; toast que aparece y se va; hoja inferior que sube | |

Regla de uso del champán: **una acción principal por pantalla** y la selección actual. Los datos de los gráficos usan `gold` (texto/acento) para mantener 3:1 o más en los dos modos.

## Fase 4 — Auditoría de accesibilidad
Ver **ACCESIBILIDAD.md**: 19 hallazgos en el formato Elemento / Problema / Impacto / Criterio WCAG / Severidad / Solución / Resultado, y una lista para la comprobación manual en el dispositivo.

## Fase 5 — Wireframes (baja fidelidad)
`diseno/wireframes.png` (fuente: `diseno/fuentes/wireframes.html`). Cuatro pantallas nuevas o rediseñadas:
- **A.** Inicio del cliente, con cuenta regresiva, recomendado y estilos.
- **B.** Reservar, con días "lleno" y "cerrado" y horarios ocupados tachados.
- **C.** Cuenta, con Mis puntos.
- **D.** Inicio del admin, con indicadores.

Sin color ni tipografía final: solo jerarquía y orden. El resultado de alta fidelidad está en `diseno/capturas/`.

## Fase 6 — User journey
`diseno/user_journey.png` (fuente: `diseno/fuentes/journey.html`).

Tiene 5 etapas: decidir, reservar, esperar la confirmación, ir al turno y después. De cada etapa muestra la acción, lo que piensa la persona, la emoción, el punto de dolor y la solución concreta que ya está en la app.

> Las emociones son **hipótesis de diseño**, no resultados de una investigación con usuarios. Validarlas con 3 a 5 clientes reales debe hacerse manualmente.

## Fase 7 — Funcionalidades nuevas (23/10/2026)

| Funcionalidad | Problema que resuelve | Decisión de diseño |
|---|---|---|
| Reservar de nuevo | Repetir el mismo corte lleva 4 pasos | Salta directo a día y hora con servicio y barbero precargados. Nunca reserva sola |
| Favoritos | Buscar siempre al mismo barbero | Corazón de 44 px. Los favoritos aparecen primero al reservar |
| Historial | No había un lugar con todo lo hecho | Cuenta → Mi historial, con filtros y total en servicios completados |
| Puntos, niveles y recompensas | No había motivo para volver | Los puntos los da la base al completar un turno (nunca la app). Barra de progreso con "Te faltan X". Canje con confirmación y código BB-XXXXXX que valida el barbero |
| Logros | Reconocer la constancia | 5 logros calculados con turnos reales, con progreso |
| Galería y "Elegí tu estilo" | Difícil explicar el corte que se quiere | Fotos reales del equipo por estilo. Desde el estilo se reserva el servicio o el barbero |
| Barbero recomendado | Indecisión del cliente nuevo | Regla visible: favorito → último barbero → estilo más reservado → especialidad |
| Cuenta regresiva | Ansiedad y olvido | En el próximo turno; se actualiza cada 30 s |
| Calendario mejorado | No se sabía qué días tenían lugar | "lleno" y "cerrado" con texto. Ocupados tachados y visibles |
| Lista de espera | Si estaba ocupado, se perdía al cliente | "Avisarme si se libera". Se avisa al primero y tiene 30 min, después pasa al siguiente |
| Dashboards | El dueño y el barbero no veían números | Tarjetas de datos, barras de 7 o 14 días con resumen accesible y rankings |

## Fase 8 — Pantallas nuevas y prototipo en Figma (27/10/2026)
Página **02 · Pantallas nuevas** del archivo de Figma (`diseno/figma_pantallas_nuevas.png`):
- **Componentes locales** ligados a las variables `BB · Color Oscuro` y a los estilos de texto `BB/…`: Botón primario, Botón secundario, Horario (variantes Libre / Elegido / Ocupado), Tarjeta estilo, Dato y Barra inferior.
- **6 pantallas de 390 × 844:**
  1. Inicio del cliente (cuenta regresiva, recomendado, "Elegí tu estilo").
  2. Hoja "Estilo Fade".
  3. Reservar · día y hora (lleno / cerrado / ocupado tachado).
  4. Cuenta · Mis puntos.
  5. Recompensas.
  6. Inicio del administrador.
- **Prototipo** con 13 conexiones y 2 puntos de inicio ("Cliente" y "Administrador"). Se recorre con **Presentar ▶**.
- **Fotos de referencia:** no se pudieron subir desde aquí (la red bloquea la subida a Figma). Las capas "foto" indican qué archivo de `mobile/assets/estilos/` arrastrar encima. *Esto debe hacerse manualmente.*

## Fase 9 — Mejoras de UX y entrega del informe (30/10 – 02/11/2026)
| Mejora | Problema | Decisión |
|---|---|---|
| Centro de avisos | La campana mostraba un número pero no llevaba a ningún lado | Pantalla de avisos con filtros "Todos / Sin leer", grupos por fecha y botón al turno, los puntos o la agenda |
| Ingreso directo | Se elegía "cliente" o "barbero" dos veces | Un solo "Ingresar"; el rol lo decide el servidor (WCAG 3.3.7) |
| Asistente con acciones | Solo respondía; no hacía | Propone reservar o cancelar con datos reales y espera "Confirmar" (WCAG 3.3.4) |
| Teclado en el Asistente | El teclado tapaba la caja de texto | Caja fija sobre el teclado, tecla "Enviar", "Ocultar teclado" (WCAG 2.4.11) |
| Enlaces de texto | "Atrás", "Cambiar" y "Cerrar" medían 36 × 16 px | Área mínima de 44 × 44 px |
| Figma | Faltaba mostrar la accesibilidad en el prototipo | Marco "Accesibilidad · anotaciones" en la página 02: orden de foco, nombres accesibles y áreas de toque |

Informe final: `informe/Informe_UX_UI_BELABARBERIA.pdf` (se regenera con `informe/construir.sh`).
