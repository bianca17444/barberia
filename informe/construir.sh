#!/bin/bash
# Genera el PDF en dos pasadas: la primera para saber en qué página cae cada sección y la segunda con el índice numerado.
set -e
cd "$(dirname "$0")/.."
python3 informe/generar.py > /dev/null
node /home/claude/work/uitest/pdf.js "$PWD/informe/informe.html" "$PWD/informe/Informe_UX_UI_BELABARBERIA.pdf"
PAGS=$(python3 - <<'PY'
import subprocess, json, re
titulos = {
 'intro': 'Introducción', 's1': 'Sección 1. Identidad visual', 's1-1': '1.1 Análisis de identidad', 's1-2': '1.2 Evolución gráfica', 's1-3': '1.3 Consistencia visual',
 's2': 'Sección 2. Accesibilidad e inclusión', 's2-1': '2.1 Auditoría de accesibilidad', 's2-2': '2.2 Rediseño inclusivo', 's2-3': '2.3 Compatibilidad con tecnologías',
 's3': 'Sección 3. Maquetación espacial', 's3-1': '3.1 Maquetación e interacción', 's3-2': '3.2 Fundamentos de Spatial UI',
 's4': 'Sección 4. Prototipado final', 's4-1': '4.1 Muestras del prototipo final', 's4-2': '4.2 Flujo de usuario', 's4-3': '4.3 Verificación',
 'concl': 'Conclusiones', 'refs': 'Referencias', 'anexo-a': 'Anexo A. Enlaces', 'anexo-b': 'Anexo B. Ficha de auditoría', 'anexo-c': 'Anexo C. Contraste', 'anexo-d': 'Anexo D. Ficha de comprobación'}
n = int(re.search(r'Pages:\s+(\d+)', subprocess.run(['pdfinfo', 'informe/Informe_UX_UI_BELABARBERIA.pdf'], capture_output=True, text=True).stdout).group(1))
textos = [subprocess.run(['pdftotext', '-f', str(i), '-l', str(i), '-layout', 'informe/Informe_UX_UI_BELABARBERIA.pdf', '-'], capture_output=True, text=True).stdout for i in range(1, n + 1)]
res = {}
for k, t in titulos.items():
    for i, tx in enumerate(textos[2:], start=3):  # salta portada e índice
        if any(l.strip().startswith(t) for l in tx.splitlines()):
            res[k] = i; break
print(json.dumps(res))
PY
)
echo "$PAGS"
python3 informe/generar.py "$PAGS"
node /home/claude/work/uitest/pdf.js "$PWD/informe/informe.html" "$PWD/informe/Informe_UX_UI_BELABARBERIA.pdf"
pdfinfo informe/Informe_UX_UI_BELABARBERIA.pdf | grep -E "Pages|File size"
