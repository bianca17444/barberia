const fs = require('fs');
const os = require('os');
const path = require('path');

for (const envName of ['.env.local', '.env']) {
  const envPath = path.join(__dirname, envName);
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
      const match = line.trim().match(/^([^=]+)=(.*)$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].trim();
      }
    }
  }
}

function getLanHost() {
  const addresses = Object.entries(os.networkInterfaces()).flatMap(([name, networkAddresses]) =>
    (networkAddresses || [])
      .filter(({ family, internal, address }) =>
        family === 'IPv4' && !internal && !address.startsWith('169.254.')
      )
      .map(({ address }) => ({ name, address }))
  );
  const usableAddresses = addresses.filter(({ name }) =>
    !/virtual|vEthernet|vmware|virtualbox|loopback|docker|wsl/i.test(name)
  );
  const wifiAddresses = usableAddresses.filter(({ name }) =>
    /wi-?fi|wireless|wlan|en0/i.test(name)
  );

  return (wifiAddresses[0] || usableAddresses[0])?.address;
}

let printQRCode;
try {
  printQRCode = require('./node_modules/expo/node_modules/@expo/cli/build/src/utils/qr').printQRCode;
} catch {
  try {
    printQRCode = require('@expo/cli/build/src/utils/qr').printQRCode;
  } catch {
    console.error('No se pudo cargar el generador de QR de Expo.');
    process.exitCode = 1;
  }
}

const host = process.env.REACT_NATIVE_PACKAGER_HOSTNAME || getLanHost();
const port = 8081;
if (!host) {
  console.error('No se encontro una direccion IPv4 local. Conecta esta PC a una red Wi-Fi o LAN.');
  process.exit(1);
}
if (!printQRCode) process.exit(1);

const url = `exp://${host}:${port}`;

console.log('\n╔════════════════════════════════════════════════════════╗');
console.log('║          BELABARBERÍA - EXPO GO (CÓDIGO QR)            ║');
console.log('╚════════════════════════════════════════════════════════╝');
console.log(`\n› Conectando mediante Wi-Fi a: ${url}\n`);

printQRCode(url).print();

console.log('\n› Abre la app Expo Go en tu teléfono y escanea el código QR.');
console.log('› Asegúrate de que el teléfono y la PC estén en la misma red Wi-Fi.\n');
