param(
    [Parameter(Mandatory)][string]$PostgresBin,
    [ValidateSet(512,1024)][int]$HeapMiB = 512
)
$ErrorActionPreference = 'Stop'
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$backend = Join-Path $repo 'backend'
$output = Join-Path $backend '.verification/loadcheck'
$data = Join-Path $output 'pgdata'
$pg = (Resolve-Path -LiteralPath $PostgresBin).Path
if (!$env:JAVA_HOME) { throw 'Set JAVA_HOME to JDK 21 first.' }
foreach ($name in @('initdb.exe','pg_ctl.exe','createdb.exe','psql.exe')) {
    if (!(Test-Path -LiteralPath (Join-Path $pg $name))) { throw "Missing PostgreSQL tool: $name" }
}
New-Item -ItemType Directory -Force -Path $output | Out-Null
$lockPath = Join-Path $output 'run.lock'
# An exclusive file handle prevents two runs from resetting the same synthetic DB.
$lock = [IO.File]::Open($lockPath,[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
$started = $false
Push-Location $repo
try {
    if (!(Test-Path -LiteralPath $data)) {
        & (Join-Path $pg 'initdb.exe') -D $data -U newaveload -A trust --encoding=UTF8 --locale=C
        if ($LASTEXITCODE) { throw 'Synthetic DB initialization failed.' }
    }
    & (Join-Path $pg 'pg_ctl.exe') -D $data status *> $null
    if ($LASTEXITCODE -ne 0) {
        & (Join-Path $pg 'pg_ctl.exe') -D $data -l (Join-Path $output 'postgres.log') -o '-h 127.0.0.1 -p 55443' -w start
        if ($LASTEXITCODE) { throw 'Synthetic DB start failed.' }
        $started = $true
    }
    $databaseExists = & (Join-Path $pg 'psql.exe') -h 127.0.0.1 -p 55443 -U newaveload -d postgres -Atc "SELECT count(*) FROM pg_database WHERE datname='newave_loadcheck'"
    if ($LASTEXITCODE) { throw 'Cannot inspect the synthetic database.' }
    if ($databaseExists -eq '0') {
        & (Join-Path $pg 'createdb.exe') -h 127.0.0.1 -p 55443 -U newaveload newave_loadcheck
        if ($LASTEXITCODE) { throw 'Cannot create synthetic database.' }
    }
    & (Join-Path $backend 'gradlew.bat') -p $backend -I (Join-Path $PSScriptRoot 'compile.init.gradle') prepareLoadcheck --no-daemon
    if ($LASTEXITCODE) { throw 'Load harness compilation failed.' }
    node (Join-Path $PSScriptRoot 'run.mjs') $HeapMiB
    if ($LASTEXITCODE) { throw 'Load validation failed. Inspect the new results.json.' }
    $runDirectory = Get-ChildItem -LiteralPath $output -Directory -Filter "run-$HeapMiB-*" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    & (Join-Path $pg 'psql.exe') -h 127.0.0.1 -p 55443 -U newaveload -d newave_loadcheck -qAt -f (Join-Path $PSScriptRoot 'verify-database.sql') |
        Set-Content -LiteralPath (Join-Path $runDirectory.FullName 'database-check.json')
    if ($LASTEXITCODE) { throw 'Synthetic DB persistence checks failed.' }
} finally {
    if ($started) { & (Join-Path $pg 'pg_ctl.exe') -D $data -m fast -w stop }
    Pop-Location
    $lock.Dispose()
}
