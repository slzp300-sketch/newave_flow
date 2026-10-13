param(
    [Parameter(Mandatory)][string]$SigningDirectory,
    [Parameter(Mandatory)][string]$AabPath,
    [Parameter(Mandatory)][string]$OutputPath,
    [string]$Alias = 'newaveflowupload'
)
$ErrorActionPreference = 'Stop'
if (!$env:JAVA_HOME) { throw 'JAVA_HOME에 JDK 경로를 설정하세요.' }
$storePath = Join-Path $SigningDirectory 'upload-keystore.p12'
$passwordPath = Join-Path $SigningDirectory 'keystore-password.txt'
foreach ($required in @($AabPath, $storePath, $passwordPath)) {
    if (!(Test-Path -LiteralPath $required -PathType Leaf)) { throw "필요한 파일이 없습니다: $required" }
}
if ([IO.Path]::GetFullPath($AabPath) -eq [IO.Path]::GetFullPath($OutputPath)) { throw '서명 결과는 별도 파일로 저장하세요.' }
$outputDirectory = Split-Path -Parent ([IO.Path]::GetFullPath($OutputPath))
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
$signer = Join-Path $env:JAVA_HOME 'bin/jarsigner.exe'
# AAB uses JAR signing. Passwords are read locally from a file, never argv or logs.
& $signer '-J-Duser.language=en' '-J-Duser.country=US' -keystore $storePath -storetype PKCS12 -storepass:file $passwordPath -digestalg SHA-256 -sigalg SHA256withRSA -signedjar $OutputPath $AabPath $Alias
if ($LASTEXITCODE -ne 0) { throw 'AAB 서명 실패' }
$verification = & $signer '-J-Duser.language=en' '-J-Duser.country=US' -verify $OutputPath 2>&1
if ($LASTEXITCODE -ne 0 -or ($verification -join "`n") -notmatch 'jar verified\.') { throw '서명된 AAB 검증 실패' }
$verification | Set-Content -LiteralPath (Join-Path $outputDirectory 'jarsigner-verification.log')
# The self-signed upload certificate is expected; Google registers its public key.
$certificate = & (Join-Path $env:JAVA_HOME 'bin/keytool.exe') '-J-Duser.language=en' -list -v -keystore $storePath -storepass:file $passwordPath -alias $Alias 2>&1
if ($LASTEXITCODE -ne 0) { throw '업로드 인증서 확인 실패' }
$certificate | Set-Content -LiteralPath (Join-Path $outputDirectory 'upload-certificate-info.txt')
$hash = (Get-FileHash -LiteralPath $OutputPath -Algorithm SHA256).Hash.ToLower()
Write-Output "Verified signed AAB: $OutputPath"
Write-Output "SHA-256: $hash"
