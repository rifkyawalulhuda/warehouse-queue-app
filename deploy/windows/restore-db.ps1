param(
  [string]$InputPath,
  [ValidateSet("auto", "host", "docker")]
  [string]$Mode = "auto",
  [string]$DockerContainer = "queue_system"
)

$ErrorActionPreference = "Stop"

function Read-EnvFile {
  param([string]$Path)
  $map = @{}
  if (!(Test-Path $Path)) { return $map }
  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#")) { return }
    $idx = $line.IndexOf("=")
    if ($idx -lt 1) { return }
    $key = $line.Substring(0, $idx).Trim()
    $val = $line.Substring($idx + 1).Trim()
    if (($val.StartsWith('"') -and $val.EndsWith('"')) -or ($val.StartsWith("'") -and $val.EndsWith("'"))) {
      $val = $val.Substring(1, $val.Length - 2)
    }
    $map[$key] = $val
  }
  return $map
}

function Parse-DatabaseUrl {
  param([string]$DatabaseUrl)
  $uri = [Uri]$DatabaseUrl
  $user = $null
  $password = $null

  if ($uri.UserInfo) {
    $parts = $uri.UserInfo.Split(":", 2)
    if ($parts.Count -ge 1) { $user = [Uri]::UnescapeDataString($parts[0]) }
    if ($parts.Count -ge 2) { $password = [Uri]::UnescapeDataString($parts[1]) }
  }

  return [PSCustomObject]@{
    Host = $uri.Host
    Port = $(if ($uri.Port -gt 0) { $uri.Port } else { 5432 })
    User = $user
    Password = $password
    Database = $uri.AbsolutePath.TrimStart("/")
  }
}

function Test-CommandAvailable {
  param([string]$Name)
  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Test-DockerContainerRunning {
  param([string]$ContainerName)
  if (-not (Test-CommandAvailable "docker")) { return $false }
  $names = & docker ps --format "{{.Names}}" 2>$null
  if ($LASTEXITCODE -ne 0) { return $false }
  return ($names -contains $ContainerName)
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir "..\..")
$envFile = Join-Path $repoRoot "backend\.env"
$backupDir = Join-Path $scriptDir "backups"

Write-Host ""
Write-Host "============================================"
Write-Host " RESTORE DB - Warehouse Queue"
Write-Host "============================================"
Write-Host "Repo   : $repoRoot"
Write-Host "Env    : $envFile"
Write-Host ""

$envMap = Read-EnvFile -Path $envFile
$databaseUrl = $envMap["DATABASE_URL"]
if (-not $databaseUrl) {
  throw "DATABASE_URL tidak ditemukan di backend/.env"
}

$cfg = Parse-DatabaseUrl -DatabaseUrl $databaseUrl
if (-not $cfg.Host -or -not $cfg.User -or -not $cfg.Database) {
  throw "DATABASE_URL tidak valid: host/user/database harus terisi."
}

if (-not $InputPath) {
  if (!(Test-Path $backupDir)) {
    throw "Folder backup tidak ditemukan: $backupDir"
  }

  $latest = Get-ChildItem -Path $backupDir -Filter "*.backup" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if (-not $latest) {
    throw "File backup (*.backup) tidak ditemukan di: $backupDir"
  }

  $InputPath = $latest.FullName
}

$InputPath = [System.IO.Path]::GetFullPath($InputPath)
if (!(Test-Path $InputPath)) {
  throw "File backup tidak ditemukan: $InputPath"
}

Write-Host "[INFO ] Host     : $($cfg.Host)"
Write-Host "[INFO ] Port     : $($cfg.Port)"
Write-Host "[INFO ] Database : $($cfg.Database)"
Write-Host "[INFO ] User     : $($cfg.User)"
Write-Host "[INFO ] Input    : $InputPath"
Write-Host ""
Write-Host "[WARN ] Proses restore akan menimpa data database target."

$answer = Read-Host "Lanjut restore? ketik YES untuk lanjut"
if ($answer -ne "YES") {
  Write-Host "[INFO ] Restore dibatalkan."
  exit 0
}

$hostModeAvailable = Test-CommandAvailable "pg_restore"
$dockerModeAvailable = Test-DockerContainerRunning -ContainerName $DockerContainer

$effectiveMode = $Mode
if ($effectiveMode -eq "auto") {
  if ($hostModeAvailable) {
    $effectiveMode = "host"
  } elseif ($dockerModeAvailable) {
    $effectiveMode = "docker"
  } else {
    throw "Mode auto gagal: pg_restore tidak ada di host, dan container docker '$DockerContainer' tidak aktif."
  }
}

Write-Host "[INFO ] Mode     : $effectiveMode"

if ($effectiveMode -eq "host") {
  if (-not $hostModeAvailable) {
    throw "Mode host dipilih tapi pg_restore tidak ditemukan di PATH."
  }

  $previousPassword = $env:PGPASSWORD
  try {
    if ($cfg.Password) { $env:PGPASSWORD = $cfg.Password }

    & pg_restore `
      -h $cfg.Host `
      -p $cfg.Port `
      -U $cfg.User `
      -d $cfg.Database `
      --clean `
      --if-exists `
      -v `
      $InputPath

    if ($LASTEXITCODE -ne 0) {
      throw "pg_restore gagal dengan exit code $LASTEXITCODE"
    }
  } finally {
    $env:PGPASSWORD = $previousPassword
  }
} elseif ($effectiveMode -eq "docker") {
  if (-not (Test-CommandAvailable "docker")) {
    throw "Mode docker dipilih tapi command docker tidak ditemukan."
  }
  if (-not $dockerModeAvailable) {
    throw "Mode docker dipilih tapi container '$DockerContainer' tidak berjalan."
  }

  $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
  $tmpInContainer = "/tmp/restore_$timestamp.backup"

  & docker cp $InputPath "$DockerContainer`:$tmpInContainer"
  if ($LASTEXITCODE -ne 0) {
    throw "docker cp restore file gagal dengan exit code $LASTEXITCODE"
  }

  $execArgs = @("exec")
  if ($cfg.Password) {
    $execArgs += @("-e", "PGPASSWORD=$($cfg.Password)")
  }
  $execArgs += @(
    $DockerContainer,
    "pg_restore",
    "-h", "localhost",
    "-p", "5432",
    "-U", $cfg.User,
    "-d", $cfg.Database,
    "--clean",
    "--if-exists",
    "-v",
    $tmpInContainer
  )
  & docker @execArgs
  $restoreExit = $LASTEXITCODE
  & docker exec $DockerContainer rm -f $tmpInContainer | Out-Null

  if ($restoreExit -ne 0) {
    throw "docker exec pg_restore gagal dengan exit code $restoreExit"
  }

  Write-Host "[INFO ] Restore dilakukan via container docker '$DockerContainer'."
} else {
  throw "Mode tidak dikenal: $effectiveMode"
}

Write-Host ""
Write-Host "[OK   ] Restore berhasil."
Write-Host ""
exit 0
