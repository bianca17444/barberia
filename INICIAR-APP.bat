@echo off
title BELABARBERIA - App movil (Wi-Fi)
cd /d "%~dp0mobile"
echo Iniciando la app. El celular y la compu tienen que estar en el mismo Wi-Fi.
echo Cuando aparezca el QR, escanealo con Expo Go.
call npx expo start --go -c --port 8083
pause
