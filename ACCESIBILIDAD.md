# BELABARBERÍA — Auditoría de accesibilidad (WCAG 2.2)

Alcance: app móvil (Expo / React Native), modos oscuro y claro. Nivel objetivo: **AA**.
Método:
1. Revisión del código de cada pantalla.
2. Medición de contraste con la fórmula de luminancia de WCAG (`diseno/contraste.mjs`).
3. Simulación de daltonismo (Machado et al., 2009).
4. 209 pruebas automáticas en una **simulación en navegador** (Chromium 390 × 844, API simulada con datos ficticios) que verifican textos, nombres accesibles y estados.

> **Lo que la simulación no reemplaza.** Las pruebas con lector de pantalla real (TalkBack en Android y VoiceOver en iPhone), con letra del sistema al 200 % y con navegación por teclado o switch **deben comprobarse manualmente en el dispositivo**. Al final del documento hay una lista para hacerlo.

## Hallazgos y correcciones

| # | Elemento | Problema | Impacto | Criterio WCAG | Severidad | Solución aplicada | Resultado |
|---|---|---|---|---|---|---|---|
| 1 | Horarios no disponibles (Figma original) | Texto `#262626` sobre `#1A1A1A`: contraste 1,15:1 | No se distingue qué horario está tomado | 1.4.3 Contraste mínimo | Alta | Los ocupados se muestran **tachados**, con borde punteado, ícono de campana y nombre accesible "10:00, ocupado. Avisarme si se libera". El texto usa `texto/terciario` (5,09:1 o más) | Corregido. Prueba K11 |
| 2 | Textos de 9–11 px (Figma original, 61 casos) | Demasiado chicos | Lectura difícil, más para personas mayores o con baja visión | 1.4.4 Cambio de tamaño del texto | Alta | Escala tipográfica con **mínimo de 12 px**. Los textos respetan el tamaño de letra del sistema | Corregido en la app. *Al 200 % debe comprobarse manualmente* |
| 3 | Estados de turno | Con deuteranopía, Confirmado (verde) y Cancelado (rojo) se ven casi iguales | El estado podía confundirse | 1.4.1 Uso del color | Alta | El componente `Estado` siempre lleva **ícono + palabra + color** | Corregido |
| 4 | Íconos hechos con emoji (Figma original) | El lector anuncia "lupa", "pin", etc. | Ruido y confusión | 1.1.1 Contenido no textual | Media | Íconos vectoriales (Ionicons). Los botones solo-ícono tienen `accessibilityLabel` | Corregido |
| 5 | Botones y chips | Algunos medían menos de 44 px | Toques errados, más con temblor o dedos grandes | 2.5.8 Tamaño del objetivo (mínimo) y 2.5.5 (mejorado) | Media | Botones de 52 px (chicos de 44); chips, segmentos, corazón e interruptor de 44 px. Los enlaces de texto ("Reservar de nuevo", "Eliminar") tienen `minHeight: 44` o `hitSlop` | Corregido |
| 6 | Bordes de campos | Contorno poco visible | No se ve dónde escribir | 1.4.11 Contraste no textual | Media | Token `borde/campo` (3,31–4,13:1) | Corregido |
| 7 | Botón principal en modo claro | Champán sobre marfil: 2,04:1 | El límite del botón no se percibe | 1.4.11 Contraste no textual | Media | Borde bronce `#7A5A1F` (5,73:1) solo en modo claro | Corregido |
| 8 | Champán como texto en modo claro | 2,04:1 | Precios y enlaces ilegibles | 1.4.3 Contraste mínimo | Alta | Token `marca/acento` bronce `#7A5A1F` (5,20–5,73:1) | Corregido |
| 9 | Barra de progreso de puntos y logros | Un gráfico sin texto no le dice nada al lector | El cliente ciego no sabe cuánto le falta | 1.1.1 / 4.1.2 Nombre, función, valor | Media | `accessibilityRole="progressbar"` con nombre ("Progreso hacia Gold") y valor 0–100. Además, texto visible: "Te faltan 880 puntos para Gold" | Corregido. Prueba K17 |
| 10 | Gráficos del dashboard | Las barras son solo visuales | El dato no llega al lector de pantalla | 1.1.1 Contenido no textual | Media | Cada gráfico tiene un resumen textual ("Turnos de los últimos 14 días. 10: 0, 11: 1…"). Valores escritos sobre cada barra. Un solo color con contraste suficiente; "Hoy" marcado con **texto**, no con color | Corregido. Pruebas K27 y K31 |
| 11 | Cuenta regresiva | Cambia sola | Si se anunciara cada segundo, molestaría | 2.2.2 Pausar, detener, ocultar / 4.1.3 Mensajes de estado | Baja | Se actualiza cada 30 s, en minutos. Región `polite` con texto hablado claro ("Faltan 2 horas y 17 minutos") | Corregido |
| 12 | Fotos de la galería | Una imagen sin descripción no dice nada | No se sabe qué estilo muestra | 1.1.1 Contenido no textual | Media | Texto alternativo con estilo, descripción y barbero ("Fade: degradé bajo, trabajo de…") | Corregido |
| 13 | Calendario | Días cerrados o llenos marcados solo con opacidad | Con baja visión no se distinguen | 1.4.1 Uso del color / 1.3.3 Características sensoriales | Media | Debajo del número dice **"cerrado"** o **"lleno"**. El nombre accesible incluye "no atiende", "sin horarios libres" o "N horarios libres" | Corregido. Pruebas K9 y K10 |
| 14 | Errores de formularios | Errores solo en alertas genéricas | No se sabe qué campo corregir | 3.3.1 Identificación de errores / 3.3.3 Sugerencias ante errores | Media | Mensaje debajo del campo, con sugerencia ("Entre 0 y 10.000, o vacío para el cálculo automático"). No se envía hasta corregir | Corregido. Pruebas A4, A12 y K33 |
| 15 | Acciones que gastan puntos o borran | Un toque accidental era irreversible | Pérdida de puntos o de fotos | 3.3.4 Prevención de errores | Media | Confirmación antes de canjear, salir de la lista de espera, eliminar fotos o cancelar turnos | Corregido. Prueba K19 |
| 16 | Bloqueo con Face ID / huella | Algunas personas no pueden usar biometría | Quedar afuera de la cuenta | 3.3.8 Autenticación accesible | Media | Es **opcional** (apagado por defecto), acepta el PIN o patrón del teléfono y permite cerrar sesión desde el bloqueo | Corregido |
| 17 | Modo de color | Pantalla oscura fija | Con astigmatismo o mucha luz, el oscuro cansa | Buenas prácticas (relacionado con 1.4.8) | Baja | Automático / Claro / Oscuro en Cuenta → Apariencia | Corregido |
| 18 | Anuncio de avisos breves (toasts) | Aparecen y desaparecen | El lector puede no leerlos | 4.1.3 Mensajes de estado | Baja | Región viva `polite` en `Avisos`. Los errores importantes se muestran con alerta del sistema | *Debe comprobarse manualmente con TalkBack y VoiceOver* |
| 19 | Orden de lectura en hojas inferiores | El contenido de atrás podría leerse | Desorientación | 1.3.2 Secuencia con significado / 2.4.3 Orden del foco | Media | Las hojas usan `Modal` nativo, que aísla el foco | *Debe comprobarse manualmente* |
| 20 | Caja de texto del Asistente | Al abrir el teclado del celular, tapaba la caja y el botón de enviar; la tecla del teclado no enviaba | No se veía lo que se escribía ni se podía mandar el mensaje | 2.4.11 Foco no oculto (mínimo) | Alta | La caja queda fija sobre el teclado; la barra de pestañas se oculta mientras se escribe; tecla "Enviar"; botón "Ocultar teclado" | Corregido. Pruebas K1–K15 |
| 21 | Campana de avisos | Mostraba un número de avisos sin leer, pero tocarla no llevaba a ningún lado | No se podía revisar ni marcar los avisos | 2.4.4 Propósito de los enlaces / 4.1.2 Nombre, función, valor | Media | Centro de avisos con filtros, grupos por fecha y botón que lleva al turno, los puntos o la agenda. Nombre accesible "Avisos, N sin leer" | Corregido. Pruebas N1–N9 |
| 22 | Ingreso | Se pedía elegir "cliente" o "barbero" antes de ingresar y otra vez dentro del formulario | Pasos repetidos y confusión | 3.3.7 Entrada redundante | Media | Un solo "Ingresar": el servidor decide el rol de la cuenta | Corregido. Pruebas R1–R16 |
| 23 | Acciones del Asistente | Un asistente que reserva o cancela podría hacerlo por un malentendido | Turnos perdidos o no deseados | 3.3.4 Prevención de errores | Alta | Siempre muestra una propuesta y espera "Confirmar" o "No"; el servidor valida que el turno sea propio, el horario esté libre y falten más de 24 h | Corregido. Pruebas A1–A8 |
| 24 | Enlaces de texto ("Atrás", "Cambiar", "Cerrar") | Medían 36 × 16 px de área real | Toque difícil con poca precisión motriz | 2.5.8 Tamaño del objetivo (mínimo) | Baja | Área mínima de 44 × 44 px en todos los enlaces de texto | Corregido. Figura de objetivos táctiles |

## Contraste de los tokens

**Oscuro:**
- Textos: 5,09:1 a 16,46:1.
- Bordes de control: 3,31:1 o más.

**Claro:**
- Textos: 4,72:1 a 18,37:1.
- Bordes de control: 3,68:1 o más.

**Resultado:** **0 combinaciones** por debajo del mínimo, con los valores medidos con `node diseno/contraste.mjs` (ver DISENO.md → Fase 2).

## Lista para la comprobación manual (dispositivo real)
- [ ] Con TalkBack o VoiceOver, reservar un turno completo sin mirar la pantalla.
- [ ] Con letra del sistema al máximo: que no se corten botones, horarios ni tarjetas de puntos.
- [ ] Recorrer Inicio, Reservar y Cuenta solo con gestos de deslizar, y que el orden sea lógico.
- [ ] Que el toast "Turno reservado" se anuncie.
- [ ] Que el bloqueo con Face ID / huella acepte el PIN del teléfono.
- [ ] Que en modo claro, a pleno sol, se lean los horarios tachados.

Registrar en cada punto: fecha, dispositivo, sistema y resultado. Si algo falla, agregarlo a la tabla como hallazgo nuevo.
