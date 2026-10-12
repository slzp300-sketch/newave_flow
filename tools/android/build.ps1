param([ValidateSet('Debug','Release')][string]$Configuration = 'Debug')
$ErrorActionPreference = 'Stop'
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$frontendPath = Join-Path $repoRoot 'frontend'
$localSdk = Join-Path $frontendPath '.verification/android-sdk'
if (!$env:ANDROID_HOME -and (Test-Path -LiteralPath $localSdk)) { $env:ANDROID_HOME = $localSdk }
if (!$env:ANDROID_HOME) { throw 'ANDROID_HOME에 Android SDK 경로를 설정하세요.' }
if (!$env:JAVA_HOME) { throw 'JAVA_HOME에 JDK 21 이상 경로를 설정하세요.' }
$env:GRADLE_USER_HOME = Join-Path $frontendPath '.verification/gradle-home'
Push-Location $frontendPath
try {
    & npm.cmd run android:sync
    if ($LASTEXITCODE -ne 0) { throw '안드로이드 화면 빌드 실패' }
    $buildTask = if ($Configuration -eq 'Release') { 'bundleRelease' } else { 'assembleDebug' }
    & ./android/gradlew.bat -p android $buildTask lintDebug --no-daemon --console=plain
    if ($LASTEXITCODE -ne 0) { throw '안드로이드 빌드 또는 검사 실패' }
    if ($Configuration -eq 'Release') { Write-Output '번들 생성 완료. Play 업로드 전 릴리스 서명 설정과 실기기 검수를 완료해야 합니다.' }
    else { Write-Output 'APK: frontend/android/app/build/outputs/apk/debug/app-debug.apk' }
} finally { Pop-Location }
