@echo off
setlocal EnableExtensions

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..\..") do set "REPO_ROOT=%%~fI"
set "BACKEND_DIR=%REPO_ROOT%\backend"
set "FRONTEND_DIR=%REPO_ROOT%\material-dashboard-shadcn-vue-1.0.0"

echo.
echo ============================================
echo  STOP DEV - Warehouse Queue App
echo ============================================
echo Repo     : %REPO_ROOT%
echo Backend  : %BACKEND_DIR%
echo Frontend : %FRONTEND_DIR%
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$backendDir = '%BACKEND_DIR%';" ^
  "$frontendDir = '%FRONTEND_DIR%';" ^
  "$processes = Get-CimInstance Win32_Process;" ^
  "$targets = $processes | Where-Object {" ^
  "  ($_.Name -in @('node.exe','cmd.exe')) -and ((" ^
  "    $_.CommandLine -and $_.CommandLine.Contains($backendDir)" ^
  "  ) -or (" ^
  "    $_.CommandLine -and $_.CommandLine.Contains($frontendDir)" ^
  "  ))" ^
  "};" ^
  "$hasBackendTargets = [bool]($targets | Where-Object { $_.CommandLine -and $_.CommandLine.Contains($backendDir) });" ^
  "$hasFrontendTargets = [bool]($targets | Where-Object { $_.CommandLine -and $_.CommandLine.Contains($frontendDir) });" ^
  "if (-not $targets) {" ^
  "  Write-Host '[INFO ] Tidak ada parent process dev server repo ini yang aktif.';" ^
  "  exit 0" ^
  "};" ^
  "$queue = [System.Collections.Generic.Queue[uint32]]::new();" ^
  "$seen = New-Object 'System.Collections.Generic.HashSet[uint32]';" ^
  "foreach ($proc in $targets) { [void]$seen.Add([uint32]$proc.ProcessId); $queue.Enqueue([uint32]$proc.ProcessId) };" ^
  "while ($queue.Count -gt 0) {" ^
  "  $current = $queue.Dequeue();" ^
  "  foreach ($child in ($processes | Where-Object { $_.ParentProcessId -eq $current })) {" ^
  "    if ($seen.Add([uint32]$child.ProcessId)) { $queue.Enqueue([uint32]$child.ProcessId) }" ^
  "  }" ^
  "};" ^
  "if ($hasBackendTargets) {" ^
  "  foreach ($backendPortPid in @(Get-NetTCPConnection -State Listen -LocalPort 3000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique)) {" ^
  "    if ($backendPortPid) { [void]$seen.Add([uint32]$backendPortPid) }" ^
  "  }" ^
  "};" ^
  "if ($hasFrontendTargets) {" ^
  "  foreach ($frontendPortPid in @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -ge 5000 -and $_.LocalPort -le 5010 } | Select-Object -ExpandProperty OwningProcess -Unique)) {" ^
  "    if ($frontendPortPid) { [void]$seen.Add([uint32]$frontendPortPid) }" ^
  "  }" ^
  "};" ^
  "$toStop = $seen | Sort-Object -Descending;" ^
  "foreach ($processId in $toStop) {" ^
  "  try {" ^
  "    $proc = Get-Process -Id $processId -ErrorAction Stop;" ^
  "    Stop-Process -Id $processId -Force -ErrorAction Stop;" ^
  "    Write-Host ('[OK   ] Menghentikan PID ' + $processId + ' (' + $proc.ProcessName + ')')" ^
  "  } catch {" ^
  "    Write-Host ('[WARN ] Gagal menghentikan PID ' + $processId + ': ' + $_.Exception.Message)" ^
  "  }" ^
  "}"

exit /b %ERRORLEVEL%
