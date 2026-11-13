@echo off
title BELABARBERIA - App movil (tunel)
cd /d "%~dp0mobile"
echo Iniciando la app con tunel (sirve con datos moviles y para entrar con Google).
call npx expo start --go --tunnel -c --port 8084
pause
