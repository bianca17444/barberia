# Barberia Imperial en Expo Go

Esta es la aplicacion nativa de Expo. No usa Vite ni WebView; consulta Supabase directamente.

## QR de Expo Go

1. Configura las variables `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` en `.env`.
2. Ejecuta `npx expo start` desde esta carpeta.
3. Escanea el QR que muestra Expo Go.

## APK

Para generar una APK instalable ejecuta:

`npx eas login`

`npx eas build -p android --profile preview`

Expo Go genera el QR de desarrollo; la APK se genera con EAS Build.
