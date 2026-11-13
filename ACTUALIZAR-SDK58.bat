@echo off
title BELABARBERIA - Actualizar a Expo SDK 58
cd /d "%~dp0mobile"
echo Actualizando la app a Expo SDK 58 (para el Expo Go nuevo). Tarda unos minutos...
echo Copia de seguridad de package.json en _respaldo_sdk57
echo ==== expo install expo@^58 --fix ==== > ..\actualizar-sdk58.log
call npx --yes expo install expo@^58.0.0 --fix >> ..\actualizar-sdk58.log 2>&1
echo ==== expo install --fix ==== >> ..\actualizar-sdk58.log
call npx --yes expo install --fix >> ..\actualizar-sdk58.log 2>&1
echo ==== expo-doctor ==== >> ..\actualizar-sdk58.log
call npx --yes expo-doctor@latest >> ..\actualizar-sdk58.log 2>&1
echo ==== FIN ==== >> ..\actualizar-sdk58.log
echo Listo. Arrancando la app...
call npx expo start --go -c --port 8083
pause
