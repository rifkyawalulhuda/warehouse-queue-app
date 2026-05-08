@echo off
setlocal EnableExtensions

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..\..") do set "REPO_ROOT=%%~fI"
set "BACKEND_DIR=%REPO_ROOT%\backend"
set "FRONTEND_DIR=%REPO_ROOT%\material-dashboard-shadcn-vue-1.0.0"
set "BACKEND_PORT=3000"
set "FRONTEND_PORT=5000"
set "FRONTEND_DEFAULT_PORT=5000"
set "FRONTEND_MAX_PORT=5010"

echo.
echo ============================================
echo  START DEV - Warehouse Queue App
echo ============================================
echo Repo     : %REPO_ROOT%
echo Backend  : %BACKEND_DIR%
echo Frontend : %FRONTEND_DIR%
echo.

if not exist "%BACKEND_DIR%\package.json" (
  echo [ERROR] package.json backend tidak ditemukan.
  exit /b 1
)

if not exist "%FRONTEND_DIR%\package.json" (
  echo [ERROR] package.json frontend tidak ditemukan.
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] node tidak ditemukan di PATH.
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm tidak ditemukan di PATH.
  exit /b 1
)

set "BACKEND_IN_USE="
for /f %%P in ('powershell -NoProfile -Command "(Get-NetTCPConnection -State Listen -LocalPort %BACKEND_PORT% -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess)"') do set "BACKEND_IN_USE=%%P"
if defined BACKEND_IN_USE (
  echo [ERROR] Port %BACKEND_PORT% sudah dipakai PID %BACKEND_IN_USE%.
  exit /b 1
)

call :FindFrontendPort
if errorlevel 1 exit /b 1

echo [INFO ] Menjalankan backend dev server...
start "Warehouse Queue Backend Dev" /D "%BACKEND_DIR%" cmd /k "title Warehouse Queue Backend Dev && npm.cmd run dev"

echo [INFO ] Menjalankan frontend dev server...
start "Warehouse Queue Frontend Dev" /D "%FRONTEND_DIR%" cmd /k "title Warehouse Queue Frontend Dev && npm.cmd run dev -- --port %FRONTEND_PORT%"

echo.
echo [OK   ] Dua window baru telah dibuka untuk backend dan frontend.
echo        Backend dev : http://localhost:%BACKEND_PORT%/health
echo        Frontend dev: http://localhost:%FRONTEND_PORT%/material-dashboard-shadcn-vue/
echo.
echo Jika salah satu service gagal start, cek pesan error di window masing-masing.
exit /b 0

:FindFrontendPort
setlocal EnableDelayedExpansion
set "FOUND_PORT="

for /l %%P in (%FRONTEND_DEFAULT_PORT%,1,%FRONTEND_MAX_PORT%) do (
  set "PORT_PID="
  for /f %%I in ('powershell -NoProfile -Command "(Get-NetTCPConnection -State Listen -LocalPort %%P -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess)"') do set "PORT_PID=%%I"

  if not defined PORT_PID (
    set "FOUND_PORT=%%P"
    goto :FrontendPortFound
  )

  if "%%P"=="%FRONTEND_DEFAULT_PORT%" (
    echo [WARN ] Port %%P sudah dipakai PID !PORT_PID!, mencari port frontend lain...
  ) else (
    echo [WARN ] Port %%P sudah dipakai PID !PORT_PID!, lanjut cek port berikutnya...
  )
)

:FrontendPortFound
if not defined FOUND_PORT (
  echo [ERROR] Tidak menemukan port frontend kosong pada rentang %FRONTEND_DEFAULT_PORT%-%FRONTEND_MAX_PORT%.
  endlocal & exit /b 1
)

endlocal & set "FRONTEND_PORT=%FOUND_PORT%"
exit /b 0
