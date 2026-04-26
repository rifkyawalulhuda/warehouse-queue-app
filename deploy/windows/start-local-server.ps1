$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir "..\..")

$backendDir = Join-Path $repoRoot "backend"
$frontendDistDir = Join-Path $repoRoot "material-dashboard-shadcn-vue-1.0.0\dist"
$nginxDir = "C:\nginx-1.28.2"
$backendPort = 3000
$frontendPort = 82

Write-Host ""
Write-Host "============================================"
Write-Host " START - Warehouse Queue Local Server"
Write-Host "============================================"
Write-Host "Repo    : $repoRoot"
Write-Host "Backend : $backendDir"
Write-Host "Nginx   : $nginxDir"
Write-Host ""

if (!(Test-Path (Join-Path $backendDir "src\server.js"))) {
  Write-Host "[ERROR] File backend src\server.js tidak ditemukan."
  exit 1
}

if (!(Test-Path (Join-Path $nginxDir "nginx.exe"))) {
  Write-Host "[ERROR] nginx.exe tidak ditemukan di: $nginxDir"
  Write-Host "        Edit variabel `\$nginxDir pada start-local-server.ps1"
  exit 1
}

$nginxTempDirs = @(
  (Join-Path $nginxDir "temp"),
  (Join-Path $nginxDir "temp\client_body_temp"),
  (Join-Path $nginxDir "temp\proxy_temp"),
  (Join-Path $nginxDir "temp\fastcgi_temp"),
  (Join-Path $nginxDir "temp\scgi_temp"),
  (Join-Path $nginxDir "temp\uwsgi_temp")
)

foreach ($tempDir in $nginxTempDirs) {
  if (!(Test-Path $tempDir)) {
    try {
      New-Item -Path $tempDir -ItemType Directory -Force -ErrorAction Stop | Out-Null
      Write-Host "[INFO ] Membuat folder temp Nginx: $tempDir"
    } catch {
      Write-Host "[ERROR] Gagal membuat folder temp Nginx: $tempDir"
      Write-Host "        $($_.Exception.Message)"
      exit 1
    }
  }
}

if (!(Test-Path (Join-Path $frontendDistDir "index.html"))) {
  Write-Host "[WARN ] Frontend dist belum ada: $frontendDistDir"
  Write-Host "        Jalankan: npm run build di folder frontend."
  Write-Host ""
}

$backendConn = Get-NetTCPConnection -State Listen -LocalPort $backendPort -ErrorAction SilentlyContinue | Select-Object -First 1
if ($backendConn) {
  Write-Host "[INFO ] Backend sudah listen di port $backendPort (PID $($backendConn.OwningProcess))."
} else {
  Write-Host "[INFO ] Backend belum aktif, menjalankan backend..."
  Start-Process -FilePath "node" -ArgumentList "src/server.js" -WorkingDirectory $backendDir -WindowStyle Minimized | Out-Null
  Start-Sleep -Seconds 2

  $backendConn = Get-NetTCPConnection -State Listen -LocalPort $backendPort -ErrorAction SilentlyContinue | Select-Object -First 1
  if (!$backendConn) {
    Write-Host "[ERROR] Backend gagal start di port $backendPort."
    exit 1
  }

  Write-Host "[OK   ] Backend started (PID $($backendConn.OwningProcess))."
}

$nginxExe = Join-Path $nginxDir "nginx.exe"
Push-Location $nginxDir
try {
  $nginxSyntax = cmd /c """$nginxExe"" -t 2>&1"
  if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Konfigurasi Nginx tidak valid."
    $nginxSyntax | ForEach-Object { Write-Host "        $_" }
    exit 1
  }

  $nginxRunning = Get-Process -Name "nginx" -ErrorAction SilentlyContinue |
    Where-Object { $_.Path -and ((Resolve-Path $_.Path).Path -eq (Resolve-Path $nginxExe).Path) }
  if ($nginxRunning) {
    cmd /c """$nginxExe"" -s reload" | Out-Null
    if ($LASTEXITCODE -ne 0) {
      Write-Host "[WARN ] Nginx running tapi reload gagal. Cek manual: nginx.exe -s reload"
    } else {
      Write-Host "[OK   ] Nginx reloaded."
    }
  } else {
    Start-Process -FilePath $nginxExe -WorkingDirectory $nginxDir -WindowStyle Hidden | Out-Null
    Start-Sleep -Milliseconds 800
    $nginxNowRunning = Get-Process -Name "nginx" -ErrorAction SilentlyContinue |
      Where-Object { $_.Path -and ((Resolve-Path $_.Path).Path -eq (Resolve-Path $nginxExe).Path) }
    if (!$nginxNowRunning) {
      Write-Host "[ERROR] Gagal start Nginx."
      exit 1
    }
    Write-Host "[OK   ] Nginx started."
  }
} finally {
  Pop-Location
}

Write-Host ""
Write-Host "[OK   ] Semua service siap."
Write-Host "       Akses lokal:   http://localhost:$frontendPort/material-dashboard-shadcn-vue/"
Write-Host "       Akses jaringan http://IP_SERVER:$frontendPort/material-dashboard-shadcn-vue/"
Write-Host ""
exit 0
