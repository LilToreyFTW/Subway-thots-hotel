$ErrorActionPreference = 'Stop'
$botRoot = 'C:\Users\Administrator\Desktop\V2\Sinland-DiscordBOT'
$nodePath = 'C:\Program Files\nodejs\node.exe'

if (-not (Test-Path -LiteralPath $nodePath)) {
    throw "Node.js was not found at $nodePath"
}

if (-not (Test-Path -LiteralPath (Join-Path $botRoot 'index.js'))) {
    throw "Sinland-DiscordBOT was not found at $botRoot"
}

Set-Location -LiteralPath $botRoot
$ErrorActionPreference = 'Continue'
& $nodePath 'index.js' *>> (Join-Path $botRoot 'bot.service.log')
exit $LASTEXITCODE
