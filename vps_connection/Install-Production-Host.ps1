#Requires -RunAsAdministrator
$ErrorActionPreference = 'Stop'
$hostRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $hostRoot

New-Item -ItemType Directory -Force -Path (Join-Path $hostRoot 'logs'), (Join-Path $hostRoot 'tools') | Out-Null
if (-not (Test-Path -LiteralPath (Join-Path $hostRoot '.env'))) {
    Copy-Item -LiteralPath (Join-Path $hostRoot '.env.example') -Destination (Join-Path $hostRoot '.env')
}
if (-not (Test-Path -LiteralPath (Join-Path $hostRoot '.venv\Scripts\python.exe'))) {
    py -3 -m venv (Join-Path $hostRoot '.venv')
}
& (Join-Path $hostRoot '.venv\Scripts\python.exe') -m pip install --disable-pip-version-check -r (Join-Path $hostRoot 'requirements.txt')

$caddyPath = Join-Path $hostRoot 'tools\caddy.exe'
if (-not (Test-Path -LiteralPath $caddyPath)) {
    Invoke-WebRequest -Uri 'https://caddyserver.com/api/download?os=windows&arch=amd64' -OutFile $caddyPath
}

if (-not (Get-NetFirewallRule -DisplayName 'STH Multiplayer HTTPS 443' -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -DisplayName 'STH Multiplayer HTTPS 443' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 443 -Profile Any | Out-Null
}

$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$startup = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet -RestartCount 100 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -StartWhenAvailable
$worldAction = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$hostRoot\Run-World.ps1`"" -WorkingDirectory $hostRoot
$caddyAction = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$hostRoot\Run-Caddy.ps1`"" -WorkingDirectory $hostRoot
Register-ScheduledTask -TaskName 'STH-Multiplayer-World' -Action $worldAction -Trigger $startup -Principal $principal -Settings $settings -Force | Out-Null
Register-ScheduledTask -TaskName 'STH-Multiplayer-TLS' -Action $caddyAction -Trigger $startup -Principal $principal -Settings $settings -Force | Out-Null
Start-ScheduledTask -TaskName 'STH-Multiplayer-World'
Start-ScheduledTask -TaskName 'STH-Multiplayer-TLS'

Write-Host 'Production multiplayer tasks installed.'
Write-Host 'Secure endpoint: wss://cyan-squirrel-97200.zap.cloud'
