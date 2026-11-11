param([Parameter(Mandatory)][string]$OutputDirectory)
$ErrorActionPreference = 'Stop'
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$target = [IO.Path]::GetFullPath($OutputDirectory)
if (Test-Path -LiteralPath $target) { throw '빈 새 경로를 지정하세요. 기존 배포 자료는 덮어쓰거나 삭제하지 않습니다.' }
New-Item -ItemType Directory -Path (Join-Path $target 'src/main/resources/META-INF') -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $repo 'backend/src/main/java') -Destination (Join-Path $target 'src/main/java') -Recurse
foreach ($file in @('build.gradle','settings.gradle')) { Copy-Item -LiteralPath (Join-Path $repo "backend/$file") -Destination $target }
Copy-Item -LiteralPath (Join-Path $repo 'backend/Dockerfile.review') -Destination (Join-Path $target 'Dockerfile')
Copy-Item -LiteralPath (Join-Path $repo 'backend/src/main/resources/application.yml') -Destination (Join-Path $target 'src/main/resources/application.yml')
Copy-Item -LiteralPath (Join-Path $repo 'backend/src/main/resources/META-INF/spring.factories') -Destination (Join-Path $target 'src/main/resources/META-INF/spring.factories')
foreach ($directory in @('report-fonts', 'report-templates')) {
  Copy-Item -LiteralPath (Join-Path $repo "backend/src/main/resources/$directory") -Destination (Join-Path $target "src/main/resources/$directory") -Recurse
}
$files = Get-ChildItem -LiteralPath $target -Recurse -File
if ($files | Where-Object { $_.Name -match 'roster_data|^\.env|keystore|\.p12$|\.dpapi$|review-access' }) { throw '배포 자료에 금지된 파일이 있습니다.' }
$manifest = $files | ForEach-Object { @{ path = [IO.Path]::GetRelativePath($target, $_.FullName).Replace('\','/'); sha256 = (Get-FileHash -LiteralPath $_.FullName).Hash.ToLower() } }
$manifest | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath (Join-Path $target 'deployment-manifest.json')
Write-Output "Prepared $($files.Count) source/config files; real roster and credentials absent: $target"
