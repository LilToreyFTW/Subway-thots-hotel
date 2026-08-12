$ErrorActionPreference = 'Stop'
$hostRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $hostRoot
New-Item -ItemType Directory -Force -Path (Join-Path $hostRoot 'logs') | Out-Null
$ErrorActionPreference = 'Continue'
& (Join-Path $hostRoot 'tools\caddy.exe') run --config (Join-Path $hostRoot 'Caddyfile') --adapter caddyfile *>> (Join-Path $hostRoot 'logs\caddy.log')
exit $LASTEXITCODE
