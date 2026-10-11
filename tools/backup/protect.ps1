param([ValidateSet('Protect', 'Unprotect')][string]$Mode)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Security
$inputBuffer = New-Object System.IO.MemoryStream
[Console]::OpenStandardInput().CopyTo($inputBuffer)
$entropy = [Text.Encoding]::UTF8.GetBytes('NewaveFlow/DatabaseBackup/v1')
try {
    if ($Mode -eq 'Protect') {
        $bytes = [Security.Cryptography.ProtectedData]::Protect($inputBuffer.ToArray(), $entropy, [Security.Cryptography.DataProtectionScope]::CurrentUser)
    } else {
        $bytes = [Security.Cryptography.ProtectedData]::Unprotect($inputBuffer.ToArray(), $entropy, [Security.Cryptography.DataProtectionScope]::CurrentUser)
    }
    $stream = [Console]::OpenStandardOutput()
    $stream.Write($bytes, 0, $bytes.Length)
    $stream.Flush()
} finally { $inputBuffer.Dispose() }
