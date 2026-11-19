@echo off
title ESTRATO - Descenso Cinetico
cd /d "%~dp0"

echo ========================================================
echo       ESTRATO - Descenso Cinetico (Hi-Bit Edition)
echo ========================================================
echo.

:: Verificar si existe la carpeta node_modules
if not exist "node_modules\" (
    echo [!] Dependencias no encontradas. Instalando dependencias...
    call npm install --legacy-peer-deps
    if %errorlevel% neq 0 (
        echo [ERROR] Hubo un problema instalando las dependencias.
        pause
        exit /b %errorlevel%
    )
    echo [OK] Dependencias instaladas correctamente.
    echo.
)

echo [>] Iniciando servidor de desarrollo Vite y abriendo el juego en el navegador...
echo [>] Puerto por defecto: http://localhost:5173/
echo.

:: Ejecutar servidor de desarrollo con apertura automatica en el navegador
call npm run dev -- --open

pause

