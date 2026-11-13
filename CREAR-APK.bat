@echo off
chcp 65001 >nul
title BELABARBERIA - Crear el APK
cd /d "%~dp0mobile"
echo.
echo === 1 de 3: Cuenta de Expo ===
call npx --yes eas-cli@latest whoami >nul 2>&1
if errorlevel 1 (
  echo Inicia sesion con tu cuenta de Expo, la misma de expo.dev.
  call npx --yes eas-cli@latest login
)
echo.
echo === 2 de 3: Crear el APK en los servidores de Expo ===
echo Tarda entre 10 y 25 minutos. No cierres esta ventana.
echo Si pregunta "Generate a new Android Keystore?", escribi Y y apreta Enter.
call npx --yes eas-cli@latest build -p android --profile preview --non-interactive
if errorlevel 1 (
  echo.
  echo No se pudo crear el APK. Mandale a Claude una captura de esta ventana.
  pause
  exit /b 1
)
echo.
echo === 3 de 3: Bajar el APK para la pagina web ===
call node "%~dp0scripts\bajar-apk.cjs"
echo.
pause
