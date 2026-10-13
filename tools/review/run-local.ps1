param([Parameter(Mandatory)][string]$PrivateDirectory, [switch]$SyntheticTestCredentials)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'credentials.ps1')
if (!$env:JAVA_HOME) { throw 'JAVA_HOME에 JDK 경로를 설정하세요.' }
$reviewRepoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$credentials = Get-NewaveReviewCredentials -PrivateDirectory $PrivateDirectory
if ($SyntheticTestCredentials) {
    # Local UI testing only; never changes the private deployment credentials.
    $credentials['REVIEW_TEACHER_PASSWORD'] = 'SyntheticReviewPassword!2026'
    $credentials['REVIEW_ADMIN_PASSWORD'] = 'SyntheticReviewPassword!2026'
}
$bundle = Get-ChildItem -LiteralPath (Join-Path $reviewRepoRoot 'backend/build/libs') -Filter '*-review.jar' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (!$bundle) { throw '먼저 backend bootReviewJar를 빌드하세요.' }
$runtime = Join-Path $reviewRepoRoot 'backend/.verification/review-runtime'
New-Item -ItemType Directory -Force -Path $runtime | Out-Null
$jar = Join-Path $runtime 'review-app.jar'
Copy-Item -LiteralPath $bundle.FullName -Destination $jar
$java = Join-Path $env:JAVA_HOME 'bin/java.exe'
# Never inherit an operator's production connections or OAuth keys.
$keys = @('PGHOST','PGPORT','PGDATABASE','PGUSER','PGPASSWORD','JWT_SECRET','KAKAO_REST_API_KEY','KAKAO_CLIENT_SECRET','KAKAO_ADMIN_KEY','BOOTSTRAP_ADMIN_PASSWORD','SPRING_PROFILES_ACTIVE','SPRING_DATASOURCE_URL','SPRING_DATASOURCE_USERNAME','SPRING_DATASOURCE_PASSWORD','REVIEW_API_URL','REVIEW_DATA_DIR') + @($credentials.Keys)
$previous = @{}
try {
    foreach ($key in $keys) {
        $previous[$key] = [Environment]::GetEnvironmentVariable($key, 'Process')
        Remove-Item -LiteralPath "Env:$key" -ErrorAction SilentlyContinue
    }
    foreach ($key in $credentials.Keys) { [Environment]::SetEnvironmentVariable($key, $credentials[$key], 'Process') }
    $env:REVIEW_DATA_DIR = (Join-Path $runtime 'data').Replace('\', '/')
    $arguments = @('-Xmx256m', '-jar', ('"' + $jar + '"'), '--spring.profiles.active=review', '--server.port=8081', '--server.address=127.0.0.1', '--logging.level.root=WARN')
    $process = Start-Process -FilePath $java -ArgumentList $arguments -WorkingDirectory $runtime -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtime 'review.log') -RedirectStandardError (Join-Path $runtime 'review.error.log')
} finally {
    foreach ($key in $previous.Keys) {
        if ($null -eq $previous[$key]) { Remove-Item -LiteralPath "Env:$key" -ErrorAction SilentlyContinue }
        else { [Environment]::SetEnvironmentVariable($key, $previous[$key], 'Process') }
    }
}
$process.Id | Set-Content -LiteralPath (Join-Path $runtime 'review.pid')
Write-Output "Review server starting on localhost:8081 (PID $($process.Id)); credentials stay in the private directory."
