// Baja el último APK que terminó de crear EAS y lo deja listo para la página web.
// Uso: node scripts/bajar-apk.js   (lo llama CREAR-APK.bat)
// - Si el APK pesa menos de 95 MB: lo guarda en landing/descargas/belabarberia.apk (se sube con la web).
// - Si pesa más (Vercel gratis acepta hasta 100 MB por publicación): la página enlaza directo al APK de Expo.
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const raiz = path.resolve(__dirname, '..');
const destino = path.join(raiz, 'landing', 'descargas', 'belabarberia.apk');
const config = path.join(raiz, 'landing', 'config.js');
const LIMITE = 95 * 1024 * 1024;

function ultimoBuild() {
  const salida = execSync('npx --yes eas-cli@latest build:list --platform android --status finished --limit 1 --json --non-interactive', {
    cwd: path.join(raiz, 'mobile'), encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit']
  });
  const inicio = salida.indexOf('[');
  const lista = JSON.parse(salida.slice(inicio));
  if (!lista.length) throw new Error('Expo no tiene ningún APK terminado todavía.');
  const b = lista[0];
  const url = b.artifacts && (b.artifacts.applicationArchiveUrl || b.artifacts.buildUrl);
  if (!url) throw new Error('El último build no tiene un archivo para bajar.');
  return { url, version: b.appVersion || '1.0.0' };
}

function escribirConfig(apkUrl, version) {
  const hoy = new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
  fs.writeFileSync(config, `// Datos públicos de la página. Lo actualiza solo scripts/bajar-apk.js al crear el APK.
window.BELABARBERIA = {
  apiUrl: 'https://iznytpilnjbqtctfbvnf.supabase.co/functions/v1/api',
  apkUrl: '${apkUrl}',
  version: '${version}',
  actualizado: '${hoy}'
};
`);
}

(async () => {
  try {
    console.log('Buscando el último APK en Expo…');
    const { url, version } = ultimoBuild();
    console.log('Bajando', url);
    const r = await fetch(url);
    if (!r.ok) throw new Error(`No se pudo bajar el APK (error ${r.status}).`);
    const datos = Buffer.from(await r.arrayBuffer());
    const mb = (datos.length / 1048576).toFixed(1);
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    if (datos.length <= LIMITE) {
      fs.writeFileSync(destino, datos);
      escribirConfig('descargas/belabarberia.apk', version);
      console.log(`\nListo: el APK (${mb} MB) quedó en landing\\descargas\\belabarberia.apk.`);
      console.log('Ahora hacé doble clic en SUBIR-WEB.bat para publicarlo en tu página.');
    } else {
      try { fs.rmSync(destino, { force: true }); } catch { fs.writeFileSync(destino, Buffer.alloc(0)); }
      escribirConfig(url, version);
      console.log(`\nEl APK pesa ${mb} MB: es más de lo que acepta Vercel gratis (100 MB).`);
      console.log('La página va a enlazar directo al APK guardado en Expo. Hacé doble clic en SUBIR-WEB.bat.');
    }
  } catch (e) {
    console.error('\nNo se pudo preparar el APK:', e.message);
    process.exitCode = 1;
  }
})();
