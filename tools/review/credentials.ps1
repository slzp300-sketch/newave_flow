$ErrorActionPreference = 'Stop'

function Get-NewaveReviewCredentials {
    param([Parameter(Mandatory)][string]$PrivateDirectory)
    $path = [IO.Path]::GetFullPath($PrivateDirectory)
    $sealedPath = Join-Path $path 'review-secrets.dpapi'
    if (!(Test-Path -LiteralPath $sealedPath)) {
        New-Item -ItemType Directory -Force -Path $path | Out-Null
        $acl = New-Object Security.AccessControl.DirectorySecurity
        $acl.SetAccessRuleProtection($true, $false)
        $identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
        foreach ($principal in @($identity, 'SYSTEM')) {
            $acl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule($principal, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')))
        }
        Set-Acl -LiteralPath $path -AclObject $acl
        $secret = @{}
        foreach ($key in @('REVIEW_JWT_SECRET', 'REVIEW_DATABASE_PASSWORD', 'REVIEW_TEACHER_PASSWORD', 'REVIEW_ADMIN_PASSWORD')) {
            $secret[$key] = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
        }
        $bytes = [Text.Encoding]::UTF8.GetBytes(($secret | ConvertTo-Json -Compress))
        $sealed = [Security.Cryptography.ProtectedData]::Protect($bytes, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
        [IO.File]::WriteAllBytes($sealedPath, $sealed)
        $access = "Newave Flow synthetic review accounts`r`nTeacher: play.teacher@review.newaveflow.invalid`r`nPassword: $($secret.REVIEW_TEACHER_PASSWORD)`r`n`r`nAdmin: play.admin@review.newaveflow.invalid`r`nPassword: $($secret.REVIEW_ADMIN_PASSWORD)`r`n`r`nNever commit this file or share it publicly. These accounts cannot access production records."
        [IO.File]::WriteAllText((Join-Path $path 'review-access.txt'), $access, [Text.Encoding]::UTF8)
    }
    $bytes = [Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($sealedPath), $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
    return [Text.Encoding]::UTF8.GetString($bytes) | ConvertFrom-Json -AsHashtable
}
