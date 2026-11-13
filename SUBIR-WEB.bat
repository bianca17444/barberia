@echo off
chcp 65001 >nul
title BELABARBERIA - Publicar la pagina web
cd /d "%~dp0"
if not exist "landing\descargas\belabarberia.apk" (
  echo.
  echo === Bajando el APK desde Expo ===
  call node "%~dp0scripts\bajar-apk.cjs"
)
cd /d "%~dp0landing"
echo.
echo === Preparando la herramienta de Vercel ===
call npx --yes vercel@latest --version >nul 2>&1
if errorlevel 1 (
  echo Reintentando bajar la herramienta de Vercel...
  call npx --yes vercel@latest --version >nul 2>&1
)
echo.
echo === Cuenta de Vercel ===
call npx --yes vercel@latest whoami >nul 2>&1
if errorlevel 1 (
  echo Abajo aparece un enlace con un codigo.
  echo Abrilo en el navegador y confirmalo ENSEGUIDA: el codigo vence en pocos minutos.
  echo.
  call npx --yes vercel@latest login
  if errorlevel 1 goto error_login
)
echo.
echo === Publicando en belabarberia.vercel.app ===
call npx --yes vercel@latest link --yes --project belabarberia --scope belabarbabianca444-4966s-projects
if errorlevel 1 goto error_publicar
call npx --yes vercel@latest deploy --prod --yes --scope belabarbabianca444-4966s-projects
if errorlevel 1 goto error_publicar
echo.
echo Listo: entra a https://belabarberia.vercel.app para ver la pagina.
pause
exit /b 0

:error_login
echo.
echo No se pudo iniciar sesion en Vercel. Cerra esta ventana y volve a abrir SUBIR-WEB.bat.
pause
exit /b 1

:error_publicar
echo.
echo No se pudo publicar. Mandale a Claude una captura de esta ventana.
pause
exit /b 1
