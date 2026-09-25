const fs = require('fs');
const path = require('path');

// Cargar .env si existe
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const match = line.trim().match(/^([^=]+)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].trim();
    }
  }
}

let printQRCode;
try {
  printQRCode = require('./node_modules/expo/node_modules/@expo/cli/build/src/utils/qr').printQRCode;
} catch (e) {
  try {
    printQRCode = require('@expo/cli/build/src/utils/qr').printQRCode;
  } catch (e2) {
    console.error('No se pudo cargar el generador de QR de Expo');
  }
}

const host = process.env.REACT_NATIVE_PACKAGER_HOSTNAME || '172.16.2.104';
const port = 8081;
const url = `exp://${host}:${port}`;

console.log('\n╔════════════════════════════════════════════════════════╗');
console.log('║       BARBERÍA IMPERIAL - EXPO GO (CÓDIGO QR)          ║');
console.log('╚════════════════════════════════════════════════════════╝');
console.log(`\n› Conectando mediante Wi-Fi a: ${url}\n`);

if (printQRCode) {
  printQRCode(url).print();
}

console.log('\n› Abre la app Expo Go en tu teléfono y escanea el código QR.');
console.log('› Asegúrate de que el teléfono y la PC estén en la misma red Wi-Fi.\n');
