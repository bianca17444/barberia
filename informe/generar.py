# Genera informe/informe.html (y luego el PDF) con la estructura exacta de la consigna:
# Portada · Índice · Introducción · Secciones 1 a 4 · Conclusiones · Referencias · Anexos A a D.
# Todas las imágenes son reales: Figma (exportadas con la API de Figma), la app (simulación en navegador)
# o diagramas armados con los valores del código. Cada figura lleva número, epígrafe y fuente.
import base64, json, pathlib, re, sys
import markdown

R = pathlib.Path(__file__).resolve().parent.parent
PAGINAS = json.loads(sys.argv[1]) if len(sys.argv) > 1 else {}  # {"id-de-seccion": página} para el índice

def md(t):
    t = re.sub(r'(?m)^(?!\s*(?:- |\d+\. |\|))(.+)\n(\s*(?:- |\d+\. ))', r'\1\n\n\2', t)
    return markdown.markdown(t, extensions=['tables'])

def img(p):
    ruta = R / p
    from PIL import Image
    import io
    im = Image.open(ruta)
    # Las capturas de página completa (más altas que una pantalla) se recortan a la primera pantalla (390 × 844)
    # para que en las grillas se vean al mismo tamaño que las demás.
    if 'capturas/' in str(p) and im.height > im.width * 844 / 390 + 4:
        im = im.crop((0, 0, im.width, round(im.width * 844 / 390)))
        b = io.BytesIO(); im.save(b, 'PNG'); datos = b.getvalue()
    else:
        datos = ruta.read_bytes()
    return 'data:image/png;base64,' + base64.b64encode(datos).decode()

n_fig = [0]
n_tab = [0]

def figura(items, texto, fuente, alto=None, ancho=None):
    """items: lista de (ruta, rótulo corto o None)."""
    n_fig[0] += 1
    estilo_alto = f'max-height:{alto}mm;' if alto else ''
    cols = ''.join(
        f'<div class="col" style="{f"width:{ancho}%;" if ancho else ""}"><img src="{img(r)}" style="{estilo_alto}">'
        + (f'<div class="rot">{rot}</div>' if rot else '') + '</div>'
        for r, rot in items)
    return (f'<figure><div class="ims">{cols}</div><figcaption><b>Figura {n_fig[0]}.</b> {texto}'
            f'<span class="fuente">Fuente: {fuente}</span></figcaption></figure>')

def tabla(titulo, html_tabla, fuente=None):
    n_tab[0] += 1
    f = f'<div class="fuente-t">Fuente: {fuente}</div>' if fuente else ''
    return f'<div class="tabla"><div class="tt"><b>Tabla {n_tab[0]}.</b> {titulo}</div>{html_tabla}{f}</div>'

def tmd(texto_md):
    """Tabla escrita en markdown → HTML."""
    return md(texto_md.strip())

diseno = (R / 'DISENO.md').read_text()
acc = (R / 'ACCESIBILIDAD.md').read_text()
bloque = lambda t, ini, fin=None: t.split(ini, 1)[1].split(fin, 1)[0] if fin else t.split(ini, 1)[1]

paleta_oscuro = bloque(diseno, '### Paleta — modo oscuro (predeterminado)\n', '### Paleta — modo claro')
paleta_oscuro = paleta_oscuro.split('\n', 2)[2]  # saca la línea de explicación
paleta_claro = bloque(diseno, '### Paleta — modo claro\n', '\nVerificación:')
tipografia = bloque(diseno, '| Estilo | Tamaño / interlínea | Peso | Uso |', '\n\n- **Tamaño mínimo')
tipografia = '| Estilo | Tamaño / interlínea | Peso | Uso |' + tipografia
estados = bloque(diseno, '| Estado | Ícono | Color | Texto |', '\n\n**Comprobación')
estados = '| Estado | Ícono | Color | Texto |' + estados
hallazgos = bloque(acc, '## Hallazgos y correcciones\n', '\n## Contraste de los tokens')

# Hallazgos nuevos de esta etapa (corregidos y probados en la simulación)
pass  # los hallazgos 20 a 24 ya están en ACCESIBILIDAD.md

SIM = ('simulación de la app en navegador (Chromium, 390 × 844 px) con datos de prueba ficticios. '
       'Es el código real de la app; los íconos se ven como marcadores genéricos.')
FIGMA = 'archivo de Figma del proyecto (exportado con la API de Figma)'
cap = lambda n, m='oscuro': f'diseno/capturas/{n}_{m}.png'
fg = lambda n: f'diseno/figma/{n}.png'
pag = lambda k: PAGINAS.get(k, '')

indice = [
    ('intro', 'Introducción', 0),
    ('s1', '1. Identidad visual y fundamentos del diseño', 0),
    ('s1-1', '1.1 Análisis de identidad y paleta de colores', 1),
    ('s1-2', '1.2 Evolución gráfica (antes y después)', 1),
    ('s1-3', '1.3 Consistencia visual', 1),
    ('s2', '2. Accesibilidad e inclusión ("Rediseñando para todos")', 0),
    ('s2-1', '2.1 Auditoría de accesibilidad', 1),
    ('s2-2', '2.2 Rediseño inclusivo', 1),
    ('s2-3', '2.3 Compatibilidad con tecnologías de asistencia', 1),
    ('s3', '3. Maquetación espacial y computación gráfica (Spatial UI y 3D)', 0),
    ('s3-1', '3.1 Maquetación e interacción', 1),
    ('s3-2', '3.2 Fundamentos de Spatial UI y elementos 3D', 1),
    ('s4', '4. Prototipado final e integración del software', 0),
    ('s4-1', '4.1 Muestras del prototipo final', 1),
    ('s4-2', '4.2 Flujo de usuario (user journey)', 1),
    ('s4-3', '4.3 Verificación', 1),
    ('concl', 'Conclusiones', 0),
    ('refs', 'Referencias', 0),
    ('anexo-a', 'Anexo A. Enlaces al prototipo en Figma', 0),
    ('anexo-b', 'Anexo B. Ficha de auditoría de accesibilidad', 0),
    ('anexo-c', 'Anexo C. Contraste medido por token', 0),
    ('anexo-d', 'Anexo D. Ficha de comprobación en el dispositivo', 0),
]
indice_html = '<ol class="indice">' + ''.join(
    f'<li class="n{nivel}"><span>{t}</span><span class="pts"></span><span class="pg">{pag(k)}</span></li>'
    for k, t, nivel in indice) + '</ol>'

h = lambda k, nivel, t: f'<h{nivel} id="{k}" data-ind="{k}">{t}</h{nivel}>'

FIGMA_URL = 'https://www.figma.com/design/OZ7vjWONDte9iTSzZ6AY2N'
PROTO_URL = 'https://www.figma.com/proto/OZ7vjWONDte9iTSzZ6AY2N?node-id=22-2&starting-point-node-id=22%3A2'

cuerpo = []
add = cuerpo.append

# ───────────────────────── Portada e índice
add(f'''<section class="portada">
<div class="marca">BELABARBERÍA</div>
<h1 class="titulo">Informe de Análisis Gráfico y UX/UI del Proyecto de Software</h1>
<p class="sub">App móvil de turnos para barbería · Expo / React Native · API Express · Supabase</p>
<table class="datos">
<tr><th>Alumna</th><td>Bianca Valentina Belabarba</td></tr>
<tr><th>Curso</th><td>6.º año</td></tr>
<tr><th>Espacio curricular</th><td>Construcción de Software</td></tr>
<tr><th>Docente</th><td>Nicolás Marinelli</td></tr>
<tr><th>Institución</th><td>EPET N.º 12</td></tr>
<tr><th>Fecha de entrega</th><td>10 de noviembre de 2026</td></tr>
</table>
<p class="nota-portada">Prototipo en Figma: <a href="{FIGMA_URL}">{FIGMA_URL}</a></p>
</section>''')
add(f'<h2 class="sin-num">Índice</h2>{indice_html}')

# ───────────────────────── Introducción
add(h('intro', 2, 'Introducción'))
add('''<p><b>BELABARBERÍA</b> es una aplicación móvil para pedir turnos en una barbería. El cliente elige servicio, barbero, día y horario libre; el barbero confirma y ve su agenda; el dueño administra servicios, horarios, pagos y estadísticas. También tiene un programa de puntos, una galería de estilos, avisos y un asistente que reserva o cancela turnos con confirmación.</p>
<p>Este informe documenta y justifica cómo evolucionaron el diseño gráfico, la interfaz (UI) y la experiencia de usuario (UX) durante el cursado: desde la réplica inicial en Figma hasta la versión actual del software, pasando por un rediseño accesible.</p>
<p><b>Método.</b> Se siguió el proceso de diseño centrado en el usuario del Certificado de Diseño UX de Google (empatizar, definir, idear, prototipar y probar):</p>
<ol><li>Diagnóstico del Figma original: medición de colores, tamaños y contrastes con la API de Figma.</li>
<li>Definición de la identidad visual y de un sistema de diseño con tokens.</li>
<li>Auditoría con las pautas WCAG 2.2 nivel AA.</li>
<li>Wireframes y user journey.</li>
<li>Prototipo de alta fidelidad en Figma.</li>
<li>Implementación en la app y verificación con pruebas automáticas.</li></ol>
<p class="nota"><b>Sobre las imágenes.</b> Las capturas de la app se tomaron en una simulación en navegador (Chromium, 390 × 844 px) que ejecuta el código real con datos de prueba ficticios ("PRUEBA Corte", "PRUEBA Barbero"). No son capturas del celular. En ellas los íconos aparecen como marcadores genéricos (círculos o cuadrados), porque el navegador no carga la fuente de íconos del teléfono. Las imágenes de Figma se exportaron del archivo del proyecto con la API de Figma. Los diagramas están armados con los valores del código y lo aclaran en su epígrafe.</p>''')

# ───────────────────────── Sección 1
add(h('s1', 2, 'Sección 1. Identidad visual y fundamentos del diseño'))
add(h('s1-1', 3, '1.1 Análisis de identidad y paleta de colores'))
add('''<p><b>Concepto.</b> Una barbería clásica con atención moderna: <b>negro cálido</b> (cuero, madera oscura, ambiente de salón) y <b>champán</b> (el latón de los sillones, la navaja y el espejo). Transmite profesionalismo y calidad sin caer en clichés: no se usan rayas de poste, calaveras ni texturas de madera. La precisión del oficio se expresa con alineaciones estrictas, una sola familia tipográfica y espacios regulares.</p>''')
add(figura([(fg('identidad_oscuro'), 'Modo oscuro (predeterminado)'), (fg('identidad_claro'), 'Modo claro')],
           'Tableros de identidad visual en Figma: paleta con el contraste medido de cada color, escala tipográfica, estados de turno y botones. Cada muestra está enlazada a una variable de las colecciones "BB · Color Oscuro" y "BB · Color Claro".',
           FIGMA + ', página "01 · Identidad visual".', alto=200, ancho=44))
add('<h4>Paleta y justificación del contraste</h4>')
add('<p>El contraste se calculó con la fórmula de luminancia relativa de WCAG (no se estimó a ojo), con el script <i>diseno/contraste.mjs</i>. El texto necesita 4,5:1 o más (criterio 1.4.3) y los bordes de controles, 3:1 o más (1.4.11). Resultado: <b>ninguna combinación queda por debajo del mínimo</b> en los dos modos.</p>')
add(tabla('Paleta del modo oscuro: función, motivo y contraste medido.', tmd(paleta_oscuro), 'DISENO.md y diseno/contraste.mjs.'))
add(tabla('Paleta del modo claro.', tmd(paleta_claro), 'DISENO.md y diseno/contraste.mjs.'))
add('''<h4>Psicología del color aplicada a la interfaz</h4>
<ul>
<li><b>Negro cálido:</b> sobriedad y exclusividad. Hace que fotos y precios resalten. Es cálido y no azulado para que no se sienta frío ni "tecnológico". No es negro puro (<code>#111111</code>), para evitar el halo en pantallas OLED y para que las sombras se sigan viendo.</li>
<li><b>Champán:</b> calidad y tradición. Se reserva para <b>una sola acción principal por pantalla</b> y para lo seleccionado, así guía la mirada (jerarquía por color).</li>
<li><b>Verde, ámbar, rojo y azul:</b> convenciones que el usuario ya conoce (listo, espera, problema, terminado). Reducen la carga cognitiva.</li>
<li><b>Modo claro marfil (<code>#F6F3EE</code>):</b> más cálido y menos encandilante que el blanco puro. Las tarjetas son blancas para "subir" hacia la luz.</li>
</ul>''')

add(h('s1-2', 3, '1.2 Evolución gráfica (antes y después)'))
add('<p>La evolución pasó por cuatro etapas. Todo el material es real y se conserva en el archivo de Figma y en las copias de respaldo del proyecto.</p>')
add(tabla('Etapas de la evolución del diseño.', tmd('''
| Etapa | Qué es | Dónde está |
|---|---|---|
| 1. Réplica inicial | 5 pantallas en Figma con acentos blancos (modelo de varias barberías) | Figma, página 1, fila superior |
| 2. Rediseño | Las mismas 5 pantallas con acento champán | Figma, página 1, fila inferior |
| 3. Primera app | App móvil de un solo archivo ("Barbería Imperial") | Respaldo del 16/10/2026 |
| 4. Versión accesible y actual | Identidad corregida con WCAG, 6 pantallas nuevas en Figma y la app actual | Figma, páginas "01" y "02"; carpeta <i>mobile/</i> |
'''), 'DISENO.md, Fase 1.'))
add(figura([(fg('antes_01_bienvenida'), 'Réplica: bienvenida'), (fg('redis_01_bienvenida'), 'Rediseño: bienvenida'),
            (fg('antes_04_fecha'), 'Réplica: fecha y hora'), (fg('redis_04_fecha'), 'Rediseño: fecha y hora')],
           'Etapas 1 y 2 en Figma. El rediseño reemplaza los acentos blancos por champán, pero mantiene problemas: el horario no disponible (11:00) tiene contraste de 1,15:1 y hay 61 textos de 9 a 11 px.',
           FIGMA + ', página "Barbershop App — Premium Redesign".', alto=78, ancho=23.5))
add(figura([(fg('antes_02_explorar'), 'Réplica: explorar'), (fg('redis_02_explorar'), 'Rediseño: explorar'),
            (fg('antes_05_confirmar'), 'Réplica: confirmar'), (fg('redis_05_confirmar'), 'Rediseño: confirmar')],
           'Etapas 1 y 2: pantallas de explorar y confirmar. Muestran un modelo de varias barberías y pago con tarjeta y "cargo por servicio" que el software no tiene. Los íconos son emoji, que el lector de pantalla anuncia con su nombre literal.',
           FIGMA + ', página "Barbershop App — Premium Redesign".', alto=78, ancho=23.5))
add(figura([(cap('antes_app_01_inicio', '').replace('_.png', '.png'), 'Inicio'), (cap('antes_app_02_servicios', '').replace('_.png', '.png'), 'Servicios'), (cap('antes_app_04_turnos', '').replace('_.png', '.png'), 'Mis turnos')],
           'Etapa 3: primera app móvil ("Barbería Imperial"). Funcionaba y tenía estados básicos de carga y de error, pero las tarjetas estaban todas al mismo plano (solo un borde lateral), las pestañas eran texto de 11 px sin íconos, no había modo claro y ningún control tenía nombre accesible.',
           'código del respaldo del 16/10/2026 (<i>_respaldo_2026-10-16/mobile/App.js</i>), ejecutado en la ' + SIM, alto=95, ancho=30))
add(figura([(fg('antes_04_fecha'), '1. Réplica'), (fg('redis_04_fecha'), '2. Rediseño'), (fg('accesible_reservar'), '3. Figma accesible'), (cap('05_reservar_dia_hora'), '4. App actual')],
           'La misma tarea, "elegir día y hora", en las cuatro etapas. En la versión accesible: los días "lleno" y "cerrado" se dicen con texto; el horario ocupado se ve tachado y se puede pedir aviso si se libera; hay mañana y tarde separadas; los botones miden 44 px o más.',
           FIGMA + ' (1 a 3) y ' + SIM + ' (4).', alto=78, ancho=23.5))
add(tabla('Qué cambió entre el diseño original y la versión actual, y por qué.', tmd('''
| Aspecto | Antes (Figma original) | Después (app actual) | Motivo |
|---|---|---|---|
| Acento | Blanco, luego champán `#C5A880` | Champán con regla de una acción principal por pantalla | Jerarquía y coherencia de marca |
| Fondo y texto | `#0D0D0D` con `#F5F5F5` (17,8:1) | `#111111` con `#F2EFEA` (16,5:1) | Menos halo y deslumbramiento, sigue en AAA |
| Profundidad | Todo al mismo plano, sin sombras | 4 niveles de elevación (sección 3.2) | Orden visual y foco |
| Tamaño de texto | 61 textos de 9 a 11 px | Mínimo 12 px, escala de 13 estilos | Legibilidad (WCAG 1.4.4) |
| Horario ocupado | 1,15:1, casi invisible | Tachado, con borde punteado y aviso "Avisarme si se libera" | Contraste (1.4.3) y no perder al cliente |
| Íconos | Emoji (🔍 📍 💳) | Íconos vectoriales con nombre accesible | Lectores de pantalla (1.1.1) |
| Modelo de negocio | Varias barberías y pago con tarjeta | Una barbería; pago por transferencia o en el local | Coincidir con el software real |
| Modos de color | Solo oscuro | Automático, claro y oscuro | Preferencias y condiciones de luz |
| Estados de turno | No existían | Ícono + palabra + color | No depender del color (1.4.1) |
'''), 'DISENO.md (Fases 1 a 3) y medición en Figma.'))

add(h('s1-3', 3, '1.3 Consistencia visual'))
add('<p><b>Tipografía: Inter, una sola familia.</b> Ya estaba en el Figma original, se diseñó para pantallas, tiene números tabulares (precios y horarios quedan alineados) y distingue bien entre I, l y 1. La jerarquía sale del tamaño y del peso, no de mezclar fuentes. Los textos respetan el tamaño de letra que la persona eligió en su celular.</p>')
add(tabla('Escala tipográfica (13 estilos, guardados en Figma como "BB/…").', tmd(tipografia), 'DISENO.md, Fase 2.'))
add(figura([(fg('componentes'), None)],
           'Componentes locales en Figma, ligados a las variables de color y a los estilos de texto: botón primario y secundario, horario (libre, elegido y ocupado), tarjeta de estilo, dato numérico y barra inferior.',
           FIGMA + ', página "02 · Pantallas nuevas", marco "Componentes BB".', ancho=100))
add(tabla('Componentes de la interfaz y reglas de uso en la app.', tmd('''
| Pieza | Decisión |
|---|---|
| Botones | Primario (champán, uno por pantalla), secundario (borde), peligro (rojo con ícono). Alto de 52 px; los chicos, de 44 px. Estado de carga dentro del botón |
| Tarjetas | Radio de 16 px, borde sutil y elevación de nivel 1 |
| Campos | Etiqueta siempre visible, borde de 3:1 o más y error debajo del campo con sugerencia |
| Chips y segmentos | 44 px de alto; lo seleccionado se rellena de champán y se anuncia como "seleccionado" |
| Estados de turno | Ícono + palabra + color (ver la tabla siguiente) |
| Espaciado | Base de 4 px (8, 12, 16, 20, 24) y margen lateral de 20 px |
| Radios | 12 en campos, 14 en botones, 16 en tarjetas, 22 en chips y 24 en hojas |
| Retroalimentación | Avisos breves (toast), estados vacíos con una acción, errores con "Reintentar" |
'''), 'DISENO.md, Fase 3, y <i>mobile/src/ui.js</i>.'))
add(tabla('Estados de turno: nunca solo con color.', tmd(estados), 'DISENO.md, Fase 2.'))
add('<p>Con deuteranopía simulada (Machado et al., 2009), "Confirmado" (verde) y "Cancelado" (rojo) se perciben casi iguales (<code>#BFB693</code> y <code>#C2B57E</code>). Por eso cada estado lleva siempre ícono y palabra.</p>')
add('<h4>Decisiones fundamentadas en el Certificado de UX de Google</h4>')
add('<p>El certificado propone que una buena experiencia sea <b>usable, equitativa, agradable y útil</b>, y que se diseñe con el proceso de <i>design thinking</i>. La tabla vincula esos principios con decisiones concretas del proyecto.</p>')
add(tabla('Principios del Certificado de UX de Google y cómo se aplicaron.', tmd('''
| Principio | Qué pide | Cómo se aplicó en BELABARBERÍA |
|---|---|---|
| Usable | Que la tarea sea clara y fácil | Reserva en 4 pasos con indicador de avance y resumen editable; "Reservar de nuevo" salta directo a día y hora |
| Equitativa | Que sirva a personas con distintas capacidades | WCAG 2.2 AA: contraste medido, objetivos táctiles grandes, nombres accesibles, modo claro y oscuro, biometría opcional |
| Agradable | Que la experiencia genere confianza y placer | Identidad negro y champán, microinteracciones breves (corazón de favoritos, avisos que aparecen y se van), puntos y logros |
| Útil | Que resuelva un problema real | Ver solo horarios libres, lista de espera, recordatorio y cuenta regresiva, asistente que reserva y cancela |
| Diseño centrado en el usuario | Partir de necesidades reales | Puntos de dolor del user journey resueltos con funciones concretas (sección 4.2) |
| Jerarquía visual | Tamaño, color y espacio guían la mirada | Una acción en champán por pantalla; el próximo turno es lo más grande y destacado del Inicio (sección 3.1) |
| Consistencia | Mismos componentes y patrones en toda la app | Sistema de tokens y componentes compartidos en Figma y en el código |
| Prototipar y probar | Iterar antes de construir | Wireframes, prototipo interactivo en Figma y pruebas automáticas sobre la app |
'''), 'Google, Certificado de Diseño de Experiencia de Usuario (UX); elaboración propia.'))

# ───────────────────────── Sección 2
add(h('s2', 2, 'Sección 2. Accesibilidad e inclusión ("Rediseñando para todos")'))
add(h('s2-1', 3, '2.1 Auditoría de accesibilidad'))
add('''<p><b>Alcance:</b> la app móvil en los modos oscuro y claro, y el Figma original. <b>Nivel objetivo:</b> WCAG 2.2 AA.</p>
<p><b>Método:</b></p>
<ol><li>Revisión del código de cada pantalla.</li>
<li>Medición del contraste de cada token con la fórmula de WCAG.</li>
<li>Simulación de daltonismo.</li>
<li>Medición de las áreas de toque sobre la pantalla.</li>
<li>Pruebas automáticas que verifican textos, nombres accesibles y estados.</li></ol>
<p>Se encontraron <b>24 barreras</b> (la ficha completa está en el Anexo B). Estas son las principales de la interfaz original y de las iteraciones anteriores:</p>''')
add(tabla('Barreras principales detectadas (resumen; ficha completa en el Anexo B).', tmd('''
| # | Barrera | Dónde | Criterio WCAG | Severidad |
|---|---|---|---|---|
| 1 | Horario no disponible con contraste 1,15:1 | Figma original | 1.4.3 Contraste mínimo | Alta |
| 2 | 61 textos de 9 a 11 px | Figma original | 1.4.4 Cambio de tamaño del texto | Alta |
| 3 | Estado del turno indicado solo por color | Iteración anterior | 1.4.1 Uso del color | Alta |
| 4 | Íconos con emoji leídos literalmente | Figma original | 1.1.1 Contenido no textual | Media |
| 5 | Botones y chips de menos de 44 px | Figma original y primera app | 2.5.8 Tamaño del objetivo | Media |
| 8 | Champán como texto en modo claro (2,04:1) | Primera versión del modo claro | 1.4.3 Contraste mínimo | Alta |
| 13 | Días cerrados o llenos marcados solo con opacidad | Iteración anterior | 1.4.1 y 1.3.3 | Media |
| 20 | El teclado tapaba la caja del Asistente | Iteración anterior | 2.4.11 Foco no oculto | Alta |
| 22 | Elegir el rol dos veces para ingresar | Iteración anterior | 3.3.7 Entrada redundante | Media |
'''), 'ACCESIBILIDAD.md y Anexo B.'))

add(h('s2-2', 3, '2.2 Rediseño inclusivo'))
add('<p>El rediseño se hizo primero en Figma, con las variables y los estilos accesibles, y después se llevó al código. Las figuras comparan el antes y el después, y miden sobre la pantalla lo que pide la consigna: contraste, áreas de toque y lectura por lector de pantalla.</p>')
add(figura([(fg('redis_04_fecha'), 'Antes (rediseño original)'), (fg('accesible_reservar'), 'Después (Figma accesible)')],
           'Prototipo de Figma adaptado para accesibilidad. A la izquierda, el 11:00 no disponible casi no se ve (1,15:1) y los textos del indicador miden 11 px. A la derecha: el ocupado está tachado y con borde punteado; los días dicen "lleno" o "cerrado" con texto; el indicador de pasos es más grueso; hay instrucciones visibles y los botones miden 44 px o más.',
           FIGMA + ', páginas 1 y "02 · Pantallas nuevas".', alto=110, ancho=36))
add(figura([(fg('accesible_anotado'), None)],
           'Anotaciones de accesibilidad sobre el prototipo en Figma: los números marcan el orden de foco del lector de pantalla y de la navegación secuencial (teclado o switch); los rectángulos punteados, el área de toque de cada control. A la derecha, el nombre que anuncia el lector para cada uno.',
           FIGMA + ', página "02 · Pantallas nuevas", marco "Accesibilidad · anotaciones (rediseño inclusivo)".', ancho=100))
add(figura([(cap('analisis_objetivos_tactiles', '').replace('_.png', '.png'), None)],
           'Áreas de toque medidas en "Reservar · día y hora". Cada rectángulo es el área real de un control, con su tamaño en píxeles: verde si mide 44 × 44 o más, rojo si mide menos. Los 35 controles visibles miden 44 px o más; antes de esta revisión, el enlace "Atrás" medía 36 × 16 (hallazgo 24). WCAG 2.5.8 (nivel AA) exige 24 × 24; la app se propone 44 × 44, como recomiendan Apple (44 pt) y el criterio 2.5.5 (nivel AAA).',
           'medición automática sobre la ' + SIM, alto=150, ancho=46))
add(figura([(cap('05_reservar_dia_hora', 'oscuro'), 'Modo oscuro'), (cap('05_reservar_dia_hora', 'claro'), 'Modo claro')],
           'La misma pantalla en los dos modos. En modo claro, el champán como texto fallaba (2,04:1), así que se oscurece a bronce <code>#7A5A1F</code> (5,73:1) y el botón principal lleva un borde bronce para que su contorno se vea (criterio 1.4.11).',
           SIM, alto=150, ancho=40))

add(h('s2-3', 3, '2.3 Compatibilidad con tecnologías de asistencia'))
add('<p>La interfaz usa las propiedades de accesibilidad nativas de React Native, que leen VoiceOver (iPhone) y TalkBack (Android). Cada control interactivo tiene <b>función</b> (por ejemplo, botón o barra de progreso), <b>nombre</b> que describe la acción y <b>estado</b> (seleccionado, deshabilitado o desplegado).</p>')
add(tabla('Cómo la interfaz facilita la interacción con tecnologías de asistencia (ejemplos tomados del código).', tmd('''
| Necesidad o tecnología | Qué hace la app | Ejemplo real |
|---|---|---|
| Lector de pantalla (VoiceOver, TalkBack) | Nombre accesible, función y estado en cada control | Horario ocupado: "10:00, ocupado. Avisarme si se libera". Campana: "Avisos, 2 sin leer. Abrir el centro de avisos" |
| Lector de pantalla y gráficos | Barras de progreso con valor y resumen textual de cada gráfico | "Progreso hacia Gold", 0 a 100, y el texto "Te faltan 880 puntos para Gold" |
| Mensajes de estado | Regiones vivas que se anuncian sin mover el foco | Avisos breves y propuestas del Asistente con `accessibilityLiveRegion="polite"` |
| Baja visión | Contraste AA o mayor, mínimo de 12 px y texto que respeta el tamaño del sistema | Ninguna combinación debajo de 4,5:1 (Anexo C) |
| Daltonismo | Ícono + palabra + color en estados, calendario y horarios | "Cancelado" con ✕ y palabra, no solo rojo |
| Motricidad reducida o temblor | Objetivos de 44 px o más; confirmación antes de acciones que no se pueden deshacer | Cancelar un turno, canjear puntos o confirmar lo que propone el Asistente |
| Teclado en pantalla | El campo con foco nunca queda tapado (WCAG 2.4.11) | La caja del Asistente sube con el teclado; botón "Ocultar teclado" y tecla "Enviar" |
| Navegación secuencial (gestos, teclado o switch) | Orden de lectura igual al visual (anotado en Figma, figura de anotaciones); las hojas usan `Modal` nativo, que aísla el foco | Al abrir "Estilo Fade", lo que quedó detrás no debería leerse (a comprobar en el dispositivo, Anexo D) |
| Autenticación | Bloqueo con Face ID o huella opcional, con el PIN del teléfono como alternativa | Apagado por defecto (WCAG 3.3.8) |
| Fatiga visual o mucha luz | Modo automático, claro u oscuro | Cuenta → Apariencia |
'''), '<i>mobile/src/</i> y ACCESIBILIDAD.md.'))
add('<p class="nota"><b>Esto debe comprobarse manualmente:</b> la lectura con VoiceOver o TalkBack, la letra del sistema al 200 % y la navegación con teclado físico o switch en un celular real. Las pruebas automáticas verifican nombres, funciones y estados, pero no reemplazan a una persona usando el lector. En el Anexo D hay una ficha para registrar esas comprobaciones.</p>')

# ───────────────────────── Sección 3
add(h('s3', 2, 'Sección 3. Maquetación espacial y computación gráfica (Spatial UI y 3D)'))
add(h('s3-1', 3, '3.1 Maquetación e interacción'))
add('<p><b>Wireframing.</b> Antes de dar color se armaron wireframes de baja fidelidad: solo estructura, orden y jerarquía, sin color ni tipografía final. Así se discutió <i>qué va primero</i> sin distraerse con lo estético.</p>')
add(figura([('diseno/wireframes.png', None)],
           'Wireframes de baja fidelidad: Inicio del cliente, Reservar (día y hora), Cuenta → Mis puntos e Inicio del administrador.',
           'diseno/wireframes.png (fuente editable: diseno/fuentes/wireframes.html).', ancho=100))
add('<p><b>Jerarquía de la información en el espacio.</b> En la pantalla de Inicio, lo más importante para el cliente (¿cuándo es mi turno?) ocupa el primer tercio, con el mayor tamaño y el único fondo champán. Debajo van las acciones frecuentes, los avisos y, al final, el contenido para explorar. El orden visual coincide con el orden en que lo lee el lector de pantalla.</p>')
add(figura([(cap('analisis_jerarquia', '').replace('_.png', '.png'), None)],
           'Jerarquía del Inicio del cliente, en orden de lectura: 1) marca y avisos; 2) saludo; 3) próximo turno, el foco principal (único fondo champán, nivel 2 de elevación); 4) accesos rápidos; 5) avisos recientes; 6) barbero recomendado. Más abajo siguen "Elegí tu estilo" y el catálogo.',
           'zonas medidas automáticamente sobre la ' + SIM, alto=150, ancho=46))
add(tabla('Recursos de maquetación usados y su efecto en la interacción.', tmd('''
| Recurso | Aplicación | Efecto |
|---|---|---|
| Ley de proximidad (Gestalt) | Servicio, precio y duración juntos en la misma tarjeta | Se leen como una unidad |
| Patrón de lectura en F | Título a la izquierda y acción secundaria a la derecha en cada sección ("Ver todos") | Recorrido rápido de arriba hacia abajo |
| Revelación progresiva | La reserva en 4 pasos; detalles en hojas inferiores | Menos carga cognitiva por pantalla |
| Zona del pulgar | Barra de pestañas y acciones principales abajo | Se alcanza con una mano |
| Ley de Hick | Ingreso con un solo botón "Ingresar", sin elegir rol | Menos decisiones, entrada más rápida |
| Retroalimentación inmediata | Estados presionado, seleccionado, cargando y deshabilitado | La persona sabe qué pasó |
'''), 'elaboración propia sobre la app.'))

add(h('s3-2', 3, '3.2 Fundamentos de Spatial UI y elementos 3D'))
add('<p>Una interfaz espacial organiza la información en capas a distintas "alturas" sobre el plano de la pantalla, como si fueran hojas de papel apiladas. La profundidad no es decoración: comunica qué está arriba (y por lo tanto, qué es interactivo o temporal) y qué está detrás. BELABARBERÍA usa un <b>modelo de elevación de 4 niveles</b>, inspirado en Material Design, que está definido una sola vez en el código (función <i>elevacion()</i>) y se usa en todos los componentes.</p>')
add(figura([('diseno/capas_espaciales.png', None)],
           'Vista explotada en perspectiva de las 4 capas de elevación. Cuanto más alta la capa, más grande y difusa es su sombra; las tarjetas se aclaran respecto del fondo y la hoja inferior se separa del contenido con un velo oscuro.',
           'diagrama armado con los valores reales de <i>mobile/src/paletas.js</i> y <i>elevacion()</i> en <i>mobile/src/ui.js</i> (fuente: diseno/fuentes/capas_espaciales.html).', ancho=100))
add(tabla('Niveles de elevación: profundidad, sombra y uso.', tmd('''
| Nivel | Superficie (oscuro / claro) | Sombra: radio · desplazamiento · `elevation` de Android | Dónde se usa |
|---|---|---|---|
| 0 | `#111111` / `#F6F3EE` | Sin sombra | Fondo de cada pantalla |
| 1 | `#1B1B1B` / `#FFFFFF` | 6 · 2 · 2 | Tarjetas, accesos, tickets, datos |
| 2 | Barra `#1B1B1B` / `#FFFFFF`; selección champán `#C5A880` | 12 · 6 · 6 | Barra inferior, día y hora elegidos, próximo turno |
| 3 | Hoja: fondo `#111111` / `#F6F3EE` con velo detrás (65 % / 45 %). Aviso breve: `#303030` / `#E3DCD1` | 20 · 10 · 14 | Hojas inferiores, modales y avisos breves |
'''), '<i>mobile/src/ui.js</i> y <i>mobile/src/paletas.js</i>.'))
add('''<ul>
<li><b>Profundidad por luminosidad.</b> En modo oscuro una sombra negra casi no se ve sobre fondo negro, así que la altura se marca sobre todo aclarando la superficie (tarjetas <code>#1B1B1B</code> sobre fondo <code>#111111</code>; avisos breves <code>#303030</code>), como recomienda Material Design para temas oscuros. La sombra acompaña (opacidad 0,45).</li>
<li><b>Una decisión distinta al Figma.</b> En Figma la hoja inferior usa la superficie 3 (<code>#303030</code>). En la app se usa el fondo base, porque adentro de la hoja hay tarjetas de nivel 1: si la hoja fuera más clara que ellas, las tarjetas parecerían "hundidas". La hoja se separa del contenido con el velo y con la sombra más grande.</li>
<li><b>Sombras en modo claro.</b> Se usa un color de sombra cálido (<code>#3A2E1C</code>) con opacidad 0,12 en lugar de gris neutro, para que no ensucie el marfil.</li>
<li><b>Velo y foco.</b> Cuando se abre una hoja inferior (nivel 3), el contenido de atrás se oscurece con un velo (negro al 65 % en modo oscuro y al 45 % en claro). Así la atención se concentra adelante, y el lector de pantalla tampoco lee lo de atrás porque la hoja es un <code>Modal</code> nativo.</li>
<li><b>Selección que "sube".</b> El día y la hora elegidos pasan del nivel 1 al 2: cambian a champán y ganan sombra. Es una metáfora física de "lo tomé".</li>
<li><b>Microinteracciones con escala y desplazamiento.</b> El corazón de favoritos crece al 125 % y vuelve (250 ms); el interruptor desliza su círculo 18 px; los avisos breves aparecen y desaparecen con opacidad. Son breves y no parpadean (WCAG 2.3.1).</li>
<li><b>Perspectiva y 3D.</b> La app no usa modelos 3D ni transformaciones con perspectiva: en un celular, para una tarea rápida como reservar, el 3D real sumaría peso, consumo de batería y posibles mareos sin mejorar la tarea. La perspectiva se usa solo en el diagrama de la figura anterior, para explicar las capas. Si en el futuro se agregara, debería respetar la preferencia "reducir movimiento" del sistema.</li>
</ul>''')
add(figura([(cap('03_estilo', 'oscuro'), 'Oscuro'), (cap('03_estilo', 'claro'), 'Claro')],
           'Hoja inferior "Estilo Fade" (nivel 3) sobre el Inicio. Se ven el asa para arrastrar, las esquinas superiores redondeadas y, arriba, el Inicio oscurecido por el velo, que concentra la atención en la hoja.',
           SIM, alto=150, ancho=40))

# ───────────────────────── Sección 4
add(h('s4', 2, 'Sección 4. Prototipado final e integración del software'))
add(h('s4-1', 3, '4.1 Muestras del prototipo final'))
add(f'<p><b>Prototipo interactivo en Figma.</b> Tiene 6 pantallas de 390 × 844 construidas con los componentes, las variables y los estilos de texto del sistema, conectadas con 13 interacciones y 2 puntos de inicio ("Cliente" y "Administrador"). Se recorre con <i>Presentar ▶</i>. Los enlaces están en el Anexo A.</p>')
add(figura([('diseno/figma_pantallas_nuevas.png', None)],
           'Página "02 · Pantallas nuevas" del prototipo en Figma: Inicio del cliente, hoja "Estilo Fade", Reservar día y hora, Cuenta con Mis puntos, Recompensas e Inicio del administrador.',
           FIGMA + '.', ancho=100))
add('<p><b>Software funcional.</b> Estas son pantallas de la app actual, de alta fidelidad, tomadas en la simulación. Incluyen las mejoras más recientes: ingreso directo, centro de avisos y Asistente con acciones confirmadas.</p>')
add(figura([(cap('01_bienvenida'), 'Bienvenida'), (cap('01b_ingreso'), 'Ingreso directo'), (cap('02_inicio_cliente'), 'Inicio del cliente'), (cap('04_reservar_servicio'), 'Reservar: servicio')],
           'Entrada y reserva. El ingreso es uno solo para clientes, barberos y el dueño: la app abre lo que corresponde a cada cuenta.',
           SIM, alto=78, ancho=23.5))
add(figura([(cap('06_reservar_confirmar'), 'Confirmar reserva'), (cap('07_mis_turnos'), 'Mis turnos'), (cap('15_avisos'), 'Centro de avisos'), (cap('17_asistente_propuesta'), 'Asistente')],
           'Después de reservar: resumen editable, turnos con su estado, centro de avisos (se abre con la campana) y Asistente, que propone una reserva y espera "Confirmar reserva" o "No".',
           SIM, alto=78, ancho=23.5))
add(figura([(cap('08_cuenta_puntos'), 'Cuenta: Mis puntos'), (cap('09_recompensas'), 'Recompensas'), (cap('12_dashboard_barbero'), 'Inicio del barbero'), (cap('13_dashboard_admin'), 'Inicio del administrador')],
           'Puntos y recompensas del cliente, y paneles del barbero y del administrador con indicadores y gráficos accesibles.',
           SIM, alto=78, ancho=23.5))
add(figura([(cap('02_inicio_cliente', 'claro'), 'Inicio'), (cap('07_mis_turnos', 'claro'), 'Mis turnos'), (cap('15_avisos', 'claro'), 'Avisos'), (cap('17_asistente_propuesta', 'claro'), 'Asistente')],
           'Las mismas pantallas en modo claro: mismos componentes y jerarquía, con los tokens del modo claro.',
           SIM, alto=78, ancho=23.5))

add(h('s4-2', 3, '4.2 Flujo de usuario (user journey)'))
add('<p>El user journey sigue a una clienta desde que decide cortarse el pelo hasta después del turno. En cada etapa muestra qué hace, qué piensa y siente, cuál es el punto de dolor y qué solución concreta tiene la app.</p>')
add(figura([('diseno/user_journey.png', None)],
           'User journey del cliente en 5 etapas: decidir, reservar, esperar la confirmación, ir al turno y después. Las emociones son hipótesis de diseño, no resultados de una investigación con usuarios.',
           'diseno/user_journey.png (fuente editable: diseno/fuentes/journey.html).', ancho=100))
add(figura([(cap('01_bienvenida'), '1. Entra'), (cap('01b_ingreso'), '2. Ingresa'), (cap('02_inicio_cliente'), '3. Ve su Inicio'),
            (cap('05_reservar_dia_hora'), '4. Elige día y hora'), (cap('06_reservar_confirmar'), '5. Confirma'), (cap('07_mis_turnos'), '6. Sigue su turno')],
           'Recorrido visual de la tarea principal, "reservar un turno", en la app real. Con 6 pantallas y sin volver atrás: el horario ocupado no se puede elegir por error y el resumen permite corregir antes de confirmar.',
           SIM, alto=62, ancho=15.5))
add(tabla('Problemas de la experiencia y cómo los resuelve la interfaz.', tmd('''
| Etapa | Punto de dolor | Solución en la interfaz |
|---|---|---|
| Decidir | "No sé qué corte pedir ni con quién" | "Elegí tu estilo" con fotos reales y barbero recomendado con regla visible |
| Reservar | "Llamo y no atienden; no sé qué horarios hay" | Solo se ven horarios libres; días "lleno" y "cerrado"; lista de espera si está ocupado |
| Reservar (con asistente) | "Prefiero pedirlo escribiendo" | El Asistente propone el turno con datos reales y espera la confirmación |
| Esperar | "¿Me confirmaron?" | Estado con ícono y palabra, aviso en la campana y centro de avisos |
| Ir al turno | "Me olvido" | Recordatorio 2 h antes y cuenta regresiva en el Inicio |
| Después | "No tengo motivo para volver" | Calificación, puntos, niveles, recompensas y "Reservar de nuevo" |
'''), 'DISENO.md (Fases 6 y 7) y diseno/user_journey.png.'))

add(h('s4-3', 3, '4.3 Verificación'))
add('''<ul>
<li><b>Pruebas automáticas de la interfaz:</b> 209 pruebas sobre la simulación, todas correctas. Revisan textos, nombres accesibles, estados, llamadas a la API, el centro de avisos, el ingreso directo, el Asistente, el ingreso con Google y el teclado.</li>
<li><b>Asistente:</b> 13 pruebas con una base de datos simulada. Verifican que solo proponga turnos propios, en horarios libres y con más de 24 h de anticipación para cancelar. La versión publicada coincide con el código.</li>
<li><b>Base de datos:</b> puntos, canjes, logros, horarios y lista de espera se probaron con transacciones que se revirtieron, así que no quedaron datos de prueba.</li>
<li><b>Contraste:</b> ninguna combinación debajo del mínimo en los dos modos (Anexo C).</li>
<li><b>Esto debe comprobarse manualmente:</b> la app en un celular real con Expo Go, el lector de pantalla, la letra al 200 % y el user journey con 3 a 5 clientes (Anexo D).</li>
</ul>''')

# ───────────────────────── Conclusiones y referencias
add(h('concl', 2, 'Conclusiones'))
add('''<p>El diseño pasó de una réplica visualmente atractiva pero con barreras —contraste de 1,15:1, textos de 9 px, íconos con emoji, todo en un mismo plano— a un sistema coherente y medible:</p>
<ul><li>Tokens de color con contraste verificado.</li>
<li>Una sola familia tipográfica con 13 estilos.</li>
<li>Componentes compartidos entre Figma y el código.</li>
<li>Un modelo de profundidad de 4 niveles.</li></ul>
<p>La accesibilidad no se agregó al final. Fue el criterio para decidir: cada cambio visual tiene un motivo (un criterio WCAG, un principio de UX o un punto de dolor del user journey) y una prueba que lo verifica.</p>
<p>Quedan pendientes las comprobaciones que solo puede hacer una persona: usar la app con VoiceOver o TalkBack en un celular real y validar el user journey con clientes reales.</p>''')
add(h('refs', 2, 'Referencias'))
add('''<ol class="refs">
<li>Apple. (s. f.). <i>Human Interface Guidelines: Accessibility</i>. https://developer.apple.com/design/human-interface-guidelines/accessibility</li>
<li>Google. (s. f.). <i>Certificado de Diseño de Experiencia de Usuario (UX) de Google</i> [Programa de 7 cursos]. Coursera. https://www.coursera.org/professional-certificates/google-ux-design</li>
<li>Google. (s. f.). <i>Material Design 3: Elevation</i>. https://m3.material.io/styles/elevation/overview</li>
<li>Google. (s. f.). <i>Material Design 2: Dark theme</i>. https://m2.material.io/design/color/dark-theme.html</li>
<li>Heller, E. (2004). <i>Psicología del color: cómo actúan los colores sobre los sentimientos y la razón</i>. Gustavo Gili.</li>
<li>Krug, S. (2014). <i>Don't Make Me Think, Revisited: A Common Sense Approach to Web Usability</i> (3.ª ed.). New Riders.</li>
<li>Machado, G. M., Oliveira, M. M. y Fernandes, L. A. F. (2009). A physiologically-based model for simulation of color vision deficiency. <i>IEEE Transactions on Visualization and Computer Graphics, 15</i>(6), 1291–1298.</li>
<li>Meta Platforms. (s. f.). <i>React Native: Accessibility</i>. https://reactnative.dev/docs/accessibility</li>
<li>Nielsen, J. (1994, actualizado en 2024). <i>10 Usability Heuristics for User Interface Design</i>. Nielsen Norman Group. https://www.nngroup.com/articles/ten-usability-heuristics/</li>
<li>Norman, D. (2013). <i>The Design of Everyday Things</i> (ed. revisada y ampliada). Basic Books.</li>
<li>W3C. (2023). <i>Web Content Accessibility Guidelines (WCAG) 2.2</i>. https://www.w3.org/TR/WCAG22/</li>
<li>W3C. (s. f.). <i>Understanding WCAG 2.2</i>. https://www.w3.org/WAI/WCAG22/Understanding/</li>
</ol>''')

# ───────────────────────── Anexos
add(h('anexo-a', 2, 'Anexo A. Enlaces al prototipo en Figma'))
add(f'''<table class="links">
<tr><th>Archivo de diseño</th><td><a href="{FIGMA_URL}">{FIGMA_URL}</a></td></tr>
<tr><th>Prototipo interactivo</th><td><a href="{PROTO_URL}">{PROTO_URL}</a></td></tr>
</table>
<p><b>Contenido del archivo:</b></p>
<ul><li><b>Página "Barbershop App — Premium Redesign":</b> réplica inicial y rediseño (10 pantallas, el "antes").</li>
<li><b>Página "01 · Identidad visual":</b> tableros de los modos oscuro y claro, variables y estilos de texto.</li>
<li><b>Página "02 · Pantallas nuevas":</b> componentes, las 6 pantallas del prototipo final con 13 interacciones y las anotaciones de accesibilidad (orden de foco, nombres accesibles y áreas de toque).</li></ul>
<p><b>Permisos:</b> el enlace tiene que estar configurado en Figma como <i>Compartir → Cualquier persona con el enlace → puede ver</i>. Con ese permiso también se pueden dejar comentarios.</p>''')
add(h('anexo-b', 2, 'Anexo B. Ficha de auditoría de accesibilidad'))
add('<p>Formato de cada hallazgo: elemento, problema, impacto, criterio WCAG 2.2, severidad, solución aplicada y resultado. Las referencias a pruebas (por ejemplo "K11") son pruebas automáticas de la simulación.</p>')
add(tabla('Ficha completa de hallazgos de accesibilidad (24).', tmd(hallazgos).replace('<table>', '<table class="ficha">'), 'ACCESIBILIDAD.md.'))
add(h('anexo-c', 2, 'Anexo C. Contraste medido por token'))
add('<p>Salida del script <i>diseno/contraste.mjs</i> (fórmula de luminancia relativa de WCAG 2.x), ejecutado al generar este informe. Cada valor es la relación de contraste del token contra el fondo y las dos superficies principales de su modo. Mínimos: 4,5:1 para texto y 3:1 para bordes de controles.</p>')
import subprocess
salida = subprocess.run(['node', str(R / 'diseno' / 'contraste.mjs')], capture_output=True, text=True).stdout
NOMBRES = {'text': 'texto/principal', 'muted': 'texto/secundario', 'faint': 'texto/terciario', 'acento': 'marca/acento', 'ok': 'estado/exito',
           'warning': 'estado/advertencia', 'danger': 'estado/error', 'info': 'estado/info', 'borderInput': 'borde/campo'}
filas, modo, extra = [], '', []
for linea in salida.splitlines():
    if linea.startswith('== '): modo = linea[3:].strip(); continue
    m = re.match(r'(\w+)\s+(#[0-9A-F]{6})\s+bg ([\d.]+) \| surface ([\d.]+) \| surface2 ([\d.]+)\s+\(mín ([\d.]+)\) (\w+)', linea)
    if m:
        k, hx, a, b, c, mn, r = m.groups()
        coma = lambda v: v.replace('.', ',')
        filas.append(f'| {modo.capitalize()} | {NOMBRES.get(k, k)} | `{hx}` | {coma(a)}:1 | {coma(b)}:1 | {coma(c)}:1 | {coma(mn)}:1 | {"Cumple" if r == "OK" else "No cumple"} |')
    elif linea.startswith(('texto sobre botón', 'fallas', 'Figma')):
        extra.append(linea)
tabla_c = '| Modo | Token | HEX | vs. fondo | vs. superficie | vs. superficie 2 | Mínimo | Resultado |\n|---|---|---|---|---|---|---|---|\n' + '\n'.join(filas)
add(tabla('Contraste de cada token de texto y de borde, en los dos modos.', tmd(tabla_c), 'salida de <i>node diseno/contraste.mjs</i>.'))
fallas = next((l for l in extra if l.startswith('fallas')), 'fallas: ?').split(':')[1].strip()
add(f'<p><b>Resultado: {fallas} combinaciones por debajo del mínimo.</b> Texto sobre el botón champán: 8,35:1 en oscuro y 8,13:1 en claro. Como comparación, en el Figma original el horario no disponible (<code>#262626</code> sobre <code>#1A1A1A</code>) daba <b>1,15:1</b>.</p>')
add(h('anexo-d', 2, 'Anexo D. Ficha de comprobación en el dispositivo'))
add('<p>Comprobaciones que no reemplaza la simulación. Se completan a mano en un celular real; las celdas vacías están <b>pendientes</b>, no aprobadas.</p>')
add(tabla('Ficha para la comprobación manual (para completar).', tmd('''
| # | Comprobación | Fecha | Dispositivo y sistema | Resultado (OK / Falla y detalle) |
|---|---|---|---|---|
| 1 | Con VoiceOver o TalkBack, reservar un turno completo sin mirar la pantalla | | | |
| 2 | Con la letra del sistema al máximo, que no se corten botones, horarios ni tarjetas | | | |
| 3 | Recorrer Inicio, Reservar y Cuenta solo con gestos, en un orden lógico | | | |
| 4 | Que el aviso "Turno reservado" se anuncie | | | |
| 5 | Que el bloqueo con Face ID o huella acepte el PIN del teléfono | | | |
| 6 | En modo claro y a pleno sol, que se lean los horarios tachados | | | |
| 7 | En el Asistente, que la caja de texto quede sobre el teclado y la tecla "Enviar" mande el mensaje | | | |
| 8 | Probar el user journey con 3 a 5 clientes y anotar dónde dudan | | | |
''')))

css = '''
@page { size: A4; margin: 18mm 16mm 18mm 16mm; }
html { font-family: Inter, Arial, Helvetica, sans-serif; color: #161412; font-size: 10.3pt; line-height: 1.45; }
body { margin: 0; }
a { color: #7A5A1F; word-break: break-all; }
h2 { font-size: 16pt; border-bottom: 2px solid #C5A880; padding-bottom: 4px; margin: 0 0 10px; break-before: page; break-after: avoid; }
h3 { font-size: 12.8pt; margin: 18px 0 6px; break-after: avoid; color: #2a2520; }
h4 { font-size: 11pt; margin: 14px 0 4px; break-after: avoid; }
p, li { text-align: justify; } ul, ol { padding-left: 20px; } li { margin: 2px 0; }
code { background: #f1ede6; padding: 0 3px; border-radius: 3px; font-size: 8.8pt; }
table { border-collapse: collapse; width: 100%; margin: 4px 0 4px; font-size: 8.3pt; line-height: 1.3; }
th, td { border: 1px solid #cfc7ba; padding: 3px 5px; vertical-align: top; text-align: left; }
th { background: #EDE8E0; } tr { break-inside: avoid; }
.tabla { margin: 10px 0 14px; } .tt { font-size: 9pt; margin-bottom: 3px; break-after: avoid; }
.fuente-t, .fuente { display: block; font-size: 8pt; color: #6B655D; margin-top: 2px; }
figure { margin: 12px 0 14px; break-inside: avoid; }
.ims { display: flex; gap: 1.5%; justify-content: center; align-items: flex-start; }
.col { display: flex; flex-direction: column; align-items: center; }
.col img { width: 100%; border: 1px solid #ddd6cb; border-radius: 6px; object-fit: contain; object-position: top; }
.rot { font-size: 8pt; color: #55504A; margin-top: 3px; text-align: center; }
figcaption { font-size: 8.8pt; color: #3d3833; margin-top: 6px; text-align: justify; }
.nota { font-size: 9pt; color: #3d3833; background: #faf7f2; border-left: 3px solid #C5A880; padding: 6px 10px; }
.portada { height: 255mm; display: flex; flex-direction: column; justify-content: center; }
.marca { color: #7A5A1F; font-weight: 800; letter-spacing: 3px; font-size: 13pt; }
.titulo { font-size: 25pt; line-height: 1.15; margin: 10px 0 8px; }
.sub { color: #55504A; font-size: 11pt; margin: 0 0 26px; text-align: left; }
.datos { width: auto; font-size: 10.5pt; } .datos th { width: 42mm; background: #EDE8E0; } .datos td, .datos th { padding: 6px 10px; }
.nota-portada { margin-top: 26px; font-size: 9pt; color: #55504A; text-align: left; }
.sin-num { break-before: page; }
.indice { list-style: none; padding: 0; margin: 0; }
.indice li { display: flex; align-items: baseline; margin: 5px 0; text-align: left; }
.indice li.n1 { padding-left: 18px; font-size: 9.6pt; } .indice li.n0 { font-weight: 600; margin-top: 9px; }
.indice .pts { flex: 1; border-bottom: 1px dotted #9A958D; margin: 0 6px; } .indice .pg { min-width: 18px; text-align: right; }
.refs { padding-left: 28px; } .refs li { text-align: left; margin: 4px 0; padding-left: 4px; }
.ficha { table-layout: fixed; font-size: 7.8pt; } .ficha th:nth-child(1) { width: 3%; } .ficha th:nth-child(2) { width: 11%; } .ficha th:nth-child(3) { width: 14%; } .ficha th:nth-child(4) { width: 12%; } .ficha th:nth-child(5) { width: 12%; } .ficha th:nth-child(6) { width: 7.5%; } .ficha th:nth-child(7) { width: 27%; } .ficha th:nth-child(8) { width: 13.5%; }
.ficha td { word-wrap: break-word; }
.links th { width: 40mm; background: #EDE8E0; } .links td, .ficha { table-layout: fixed; font-size: 7.8pt; } .ficha th:nth-child(1) { width: 3%; } .ficha th:nth-child(2) { width: 11%; } .ficha th:nth-child(3) { width: 14%; } .ficha th:nth-child(4) { width: 12%; } .ficha th:nth-child(5) { width: 12%; } .ficha th:nth-child(6) { width: 7.5%; } .ficha th:nth-child(7) { width: 27%; } .ficha th:nth-child(8) { width: 13.5%; }
.ficha td { word-wrap: break-word; }
.links th { font-size: 9pt; padding: 5px 8px; }
h3[id^="s1-1"], h3[id^="s2-1"], h3[id^="s3-1"], h3[id^="s4-1"] { margin-top: 6px; }
'''
html = f'<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Informe UX/UI — BELABARBERÍA</title><style>{css}</style></head><body>{"".join(cuerpo)}</body></html>'
(R / 'informe' / 'informe.html').write_text(html)
print(json.dumps({'figuras': n_fig[0], 'tablas': n_tab[0]}))
