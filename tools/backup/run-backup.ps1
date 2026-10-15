param([string]$BackupDirectory)
$ErrorActionPreference = 'Stop'
if($BackupDirectory){$env:NEWAVE_BACKUP_DIRECTORY=(Resolve-Path -LiteralPath $BackupDirectory).Path}
$backupScript = Join-Path $PSScriptRoot 'backup.cjs'
& 'C:\Program Files\nodejs\node.exe' $backupScript backup
exit $LASTEXITCODE
