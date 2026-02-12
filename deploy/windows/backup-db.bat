@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0backup-db.ps1" %*
exit /b %ERRORLEVEL%

