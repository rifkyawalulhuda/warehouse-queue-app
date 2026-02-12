param(
  [string]$OutputPath,
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

Write-Host ""
Write-Host "============================================"
Write-Host " BACKUP DB - Warehouse Queue"
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

$backupDir = Join-Path $scriptDir "backups"
if (!(Test-Path $backupDir)) {
  New-Item -ItemType Directory -Path $backupDir | Out-Null
}

if (-not $OutputPath) {
  $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
  $OutputPath = Join-Path $backupDir "$($cfg.Database)_$timestamp.backup"
}

$OutputPath = [System.IO.Path]::GetFullPath($OutputPath)

Write-Host "[INFO ] Host     : $($cfg.Host)"
Write-Host "[INFO ] Port     : $($cfg.Port)"
Write-Host "[INFO ] Database : $($cfg.Database)"
Write-Host "[INFO ] User     : $($cfg.User)"
Write-Host "[INFO ] Output   : $OutputPath"

$hostModeAvailable = Test-CommandAvailable "pg_dump"
$dockerModeAvailable = Test-DockerContainerRunning -ContainerName $DockerContainer

$effectiveMode = $Mode
if ($effectiveMode -eq "auto") {
  if ($hostModeAvailable) {
    $effectiveMode = "host"
  } elseif ($dockerModeAvailable) {
    $effectiveMode = "docker"
  } else {
    throw "Mode auto gagal: pg_dump tidak ada di host, dan container docker '$DockerContainer' tidak aktif."
  }
}

Write-Host "[INFO ] Mode     : $effectiveMode"

if ($effectiveMode -eq "host") {
  if (-not $hostModeAvailable) {
    throw "Mode host dipilih tapi pg_dump tidak ditemukan di PATH."
  }

  $previousPassword = $env:PGPASSWORD
  try {
    if ($cfg.Password) { $env:PGPASSWORD = $cfg.Password }

    & pg_dump `
      -h $cfg.Host `
      -p $cfg.Port `
      -U $cfg.User `
      -d $cfg.Database `
      -F c `
      -b `
      -v `
      -f $OutputPath

    if ($LASTEXITCODE -ne 0) {
      throw "pg_dump gagal dengan exit code $LASTEXITCODE"
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
  $tmpInContainer = "/tmp/$($cfg.Database)_$timestamp.backup"

  $execArgs = @("exec")
  if ($cfg.Password) {
    $execArgs += @("-e", "PGPASSWORD=$($cfg.Password)")
  }
  $execArgs += @(
    $DockerContainer,
    "pg_dump",
    "-h", "localhost",
    "-p", "5432",
    "-U", $cfg.User,
    "-d", $cfg.Database,
    "-F", "c",
    "-b",
    "-v",
    "-f", $tmpInContainer
  )
  & docker @execArgs
  if ($LASTEXITCODE -ne 0) {
    throw "docker exec pg_dump gagal dengan exit code $LASTEXITCODE"
  }

  & docker cp "$DockerContainer`:$tmpInContainer" $OutputPath
  if ($LASTEXITCODE -ne 0) {
    throw "docker cp backup gagal dengan exit code $LASTEXITCODE"
  }

  & docker exec $DockerContainer rm -f $tmpInContainer | Out-Null
  Write-Host "[INFO ] Backup diambil dari container docker '$DockerContainer'."
} else {
  throw "Mode tidak dikenal: $effectiveMode"
}

Write-Host ""
Write-Host "[OK   ] Backup berhasil dibuat."
Write-Host "        $OutputPath"
Write-Host ""
exit 0
