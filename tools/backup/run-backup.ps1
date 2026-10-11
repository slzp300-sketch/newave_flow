$ErrorActionPreference = 'Stop'
$backupScript = Join-Path $PSScriptRoot 'backup.cjs'
& 'C:\Program Files\nodejs\node.exe' $backupScript backup
exit $LASTEXITCODE
