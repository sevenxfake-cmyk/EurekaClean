param(
    [string]$AppHost = "127.0.0.1",
    [int]$Port = 8000,
    [switch]$OpenBrowser,
    [switch]$ResetDemoCredentials
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectRoot

$pythonCmd = Get-Command python -ErrorAction SilentlyContinue
if (-not $pythonCmd) {
    Write-Error "No se encontro 'python' en PATH. Instala Python o agrega python.exe al PATH."
    exit 1
}

$env:APP_HOST = $AppHost
$env:APP_PORT = "$Port"

if ($ResetDemoCredentials) {
    Write-Host "Re-sincronizando usuarios seed configurados por entorno..."
    & python "reset_seed_users.py"
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
}

Write-Host "Backend iniciado con PowerShell"
Write-Host "URL: http://$AppHost`:$Port"
Write-Host "Health: http://$AppHost`:$Port/api/health"
Write-Host "Presiona Ctrl + C para detener."

if ($OpenBrowser) {
    Start-Process "http://$AppHost`:$Port/login.html" | Out-Null
}

& python "server.py"
