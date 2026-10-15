# Register only after the first backup and full restore have been verified.
param([string]$BackupDirectory)
$ErrorActionPreference = 'Stop'
$taskName = 'NewaveFlow-EncryptedDatabaseBackup'
$workspace = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../..')).Path
$backupFolder = if($BackupDirectory){(Resolve-Path -LiteralPath $BackupDirectory).Path}else{Join-Path $workspace '.backups'}
$receipt = Get-Content -Raw -LiteralPath (Join-Path $backupFolder 'last-success.json') | ConvertFrom-Json
$verified = Get-Content -Raw -LiteralPath (Join-Path $backupFolder 'last-restore-verification.json') | ConvertFrom-Json
if (-not $verified.allTableHashesMatch -or $receipt.sha256 -ne $verified.sha256) { throw 'A verified current backup is required first.' }
if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) { throw 'Task already exists. Inspect it before updating.' }
$identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$shell = Join-Path $env:SystemRoot 'System32/WindowsPowerShell/v1.0/powershell.exe'
$node = (Get-Command node -CommandType Application -ErrorAction Stop).Source
$backupScript = Join-Path $PSScriptRoot 'backup.cjs'
# Invoke Node directly inside a hidden shell. Do not change the PC's script execution policy.
$command = '$env:NEWAVE_BACKUP_DIRECTORY = ''' + $backupFolder.Replace("'", "''") + '''; & ''' + $node.Replace("'", "''") + ''' ''' + $backupScript.Replace("'", "''") + ''' backup; exit $LASTEXITCODE'
$action = New-ScheduledTaskAction -Execute $shell -Argument "-NoProfile -NonInteractive -WindowStyle Hidden -Command `"$command`"" -WorkingDirectory $workspace
$triggers = @((New-ScheduledTaskTrigger -Daily -At '21:00'), (New-ScheduledTaskTrigger -AtLogOn -User $identity))
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 15) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 30) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$principal = New-ScheduledTaskPrincipal -UserId $identity -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $triggers -Settings $settings -Principal $principal -Description 'Newave Flow: daily encrypted local DB backup, catch up at logon, full local restore check every 7 days. Requires this Windows user and internet.' | Select-Object TaskName, State
