# BELABARBERÍA — App móvil (Expo)

La app habla con la API REST publicada (`src/api.js`, `EXPO_PUBLIC_API_URL`). Supabase Auth se usa solo para guardar la sesión en el teléfono y para el ingreso con Google.

## Primera vez

```bash
npm install
npx expo install expo-notifications expo-device @expo/vector-icons expo-image-picker
```

## Abrir en Expo Go

```bash
npx expo start --go --tunnel --clear
```

Escaneá el QR con Expo Go (Android) o con la cámara (iPhone). Usá `--tunnel` para que funcione el ingreso con Google.

## APK

```bash
npx eas login
npx eas build -p android --profile preview
```

## Estructura

```
App.js                    navegación por rol, sesión, Google, enlaces de recuperación
src/api.js                cliente de la API (token Bearer, errores claros, sin conexión)
src/tema.js, paletas.js   tema claro/oscuro/automático guardado en el teléfono
src/notificaciones.js     permiso y registro del token push
src/pantallas/Auth.js     ingresar, crear cuenta, recuperar, nueva contraseña
src/pantallas/Cliente.js  inicio, reservar, mis turnos, reseñas
src/pantallas/Cuenta.js   perfil, tema, notificaciones, cambiar contraseña, salir
src/pantallas/Barbero.js  agenda y ficha del barbero
src/pantallas/Admin.js    panel de administración
```
