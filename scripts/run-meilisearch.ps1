param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]] $PassthroughArgs
)

$ErrorActionPreference = "Stop"

function Import-DotEnvFile {
  param([string] $Path)
  if (-not (Test-Path -LiteralPath $Path)) {
    return
  }
  Get-Content -LiteralPath $Path | ForEach-Object {
    $line = $_.Trim()
    if ($line -match '^\s*#' -or $line -eq "") {
      return
    }
    $eq = $line.IndexOf("=")
    if ($eq -lt 1) {
      return
    }
    $name = $line.Substring(0, $eq).Trim()
    $value = $line.Substring($eq + 1).Trim()
    if (
      ($value.StartsWith('"') -and $value.EndsWith('"')) -or
      ($value.StartsWith("'") -and $value.EndsWith("'"))
    ) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    [Environment]::SetEnvironmentVariable($name, $value, "Process")
  }
}

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$Exe = Join-Path $RepoRoot "vendor/meilisearch/meilisearch.exe"

if (-not (Test-Path -LiteralPath $Exe)) {
  Write-Error "Missing $Exe. Run: npm run meilisearch:install"
  exit 1
}

$ApiEnv = Join-Path $RepoRoot "apps/api/.env"
Import-DotEnvFile -Path $ApiEnv

if (-not $env:MEILI_MASTER_KEY) {
  Write-Error "MEILI_MASTER_KEY is not set. Add it to apps/api/.env (or export it in this shell) before starting Meilisearch."
  exit 1
}

if (-not $env:MEILI_ENV) {
  $env:MEILI_ENV = "development"
}

& $Exe @PassthroughArgs
