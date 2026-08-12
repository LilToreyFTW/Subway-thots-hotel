$ErrorActionPreference = 'Stop'
$hostRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $hostRoot
New-Item -ItemType Directory -Force -Path (Join-Path $hostRoot 'logs') | Out-Null
$ErrorActionPreference = 'Continue'
& (Join-Path $hostRoot '.venv\Scripts\python.exe') (Join-Path $hostRoot 'Host.py') *>> (Join-Path $hostRoot 'logs\world-host.log')
exit $LASTEXITCODE
