param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('up', 'down', 'status')]
    [string]$Action
)

# pg_ctl.exe khong doc duoc duong dan co dau tieng Viet (ANSI codepage) nen
# phai dung duong dan rut gon (8.3) cho thu muc du lieu.
$fso = New-Object -ComObject Scripting.FileSystemObject
$ShortProfile = $fso.GetFolder($env:USERPROFILE).ShortPath

$PgCtl = Join-Path $env:ProgramFiles "PostgreSQL\18\bin\pg_ctl.exe"
$DataDir = Join-Path $ShortProfile "pgdata-shop"
$LogFile = Join-Path $DataDir "logfile.txt"

switch ($Action) {
    'up'     { & $PgCtl -D $DataDir -l $LogFile start }
    'down'   { & $PgCtl -D $DataDir stop }
    'status' { & $PgCtl -D $DataDir status }
}
