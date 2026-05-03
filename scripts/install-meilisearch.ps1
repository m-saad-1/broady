param(
  [Parameter(Position = 0)]
  [string] $Version = "v1.13.3",
  [switch] $Force
)

$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$OutDir = Join-Path $RepoRoot "vendor/meilisearch"
$AssetName = "meilisearch-windows-amd64.exe"
$DestExe = Join-Path $OutDir "meilisearch.exe"
$Url = "https://github.com/meilisearch/meilisearch/releases/download/$Version/$AssetName"

if ((Test-Path $DestExe) -and -not $Force) {
  Write-Host "Meilisearch already present: $DestExe (use -Force to re-download)."
  exit 0
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$TempExe = Join-Path $OutDir $AssetName

Write-Host "Downloading Meilisearch $Version for Windows amd64 ..."
Invoke-WebRequest -Uri $Url -OutFile $TempExe
Move-Item -LiteralPath $TempExe -Destination $DestExe -Force

Write-Host "Installed: $DestExe"
& $DestExe --version
