$ErrorActionPreference = 'Stop'
$ruleName = 'SubwayThotsHotel Online TCP 7076'
$existing = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "$ruleName already exists."
} else {
    New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow -Protocol TCP -LocalPort 7076 -Profile Any
    Write-Host "Opened inbound TCP port 7076 for SubwayThotsHotel Online."
}
Get-NetFirewallRule -DisplayName $ruleName | Format-Table DisplayName, Enabled, Direction, Action
