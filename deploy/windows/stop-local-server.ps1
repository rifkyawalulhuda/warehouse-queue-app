$ErrorActionPreference = "Stop"

$nginxDir = "C:\Users\rifky\Downloads\nginx-1.28.2"
$backendPort = 3000

Write-Host ""
Write-Host "============================================"
Write-Host " STOP - Warehouse Queue Local Server"
Write-Host "============================================"
Write-Host ""

$backendConn = Get-NetTCPConnection -State Listen -LocalPort $backendPort -ErrorAction SilentlyContinue | Select-Object -First 1
if ($backendConn) {
  Stop-Process -Id $backendConn.OwningProcess -Force -ErrorAction SilentlyContinue
  Start-Sleep -Milliseconds 800
  $checkConn = Get-NetTCPConnection -State Listen -LocalPort $backendPort -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($checkConn) {
    Write-Host "[WARN ] Backend masih listen di port $backendPort (PID $($checkConn.OwningProcess))."
  } else {
    Write-Host "[OK   ] Backend stopped."
  }
} else {
  Write-Host "[INFO ] Backend tidak sedang listen di port $backendPort."
}

$nginxExe = Join-Path $nginxDir "nginx.exe"
if (!(Test-Path $nginxExe)) {
  Write-Host "[WARN ] nginx.exe tidak ditemukan di: $nginxDir"
  Write-Host "       Lewati stop Nginx."
  exit 0
}

$nginxProcesses = Get-Process -Name "nginx" -ErrorAction SilentlyContinue
if ($nginxProcesses) {
  $nginxProcesses | Stop-Process -Force -ErrorAction SilentlyContinue
  Write-Host "[OK   ] Nginx stopped."
} else {
  Write-Host "[INFO ] Nginx tidak sedang berjalan."
}

Write-Host ""
Write-Host "[DONE ] Stop selesai."
Write-Host ""
exit 0

