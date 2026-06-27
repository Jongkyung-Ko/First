# Downloads CC0 lullaby previews from Freesound for the Sound page.
# Catalog: data/freesound-lullabies.json (license: Creative Commons 0 — commercial use OK)
# Optional: set FREESOUND_API_KEY to refresh catalog via API (not required for bundled files).

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
if (-not (Test-Path (Join-Path $root "js\sound.js"))) {
  $root = Split-Path -Parent $PSScriptRoot
}

$catalogPath = Join-Path $root "data\freesound-lullabies.json"
$outDir = Join-Path $root "assets\audio\sfx\lullabies"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

if (-not (Test-Path $catalogPath)) {
  throw "Missing catalog: $catalogPath"
}

$items = Get-Content $catalogPath -Raw -Encoding UTF8 | ConvertFrom-Json
foreach ($item in $items) {
  $dest = Join-Path $outDir $item.file
  Write-Host "GET $($item.previewUrl) -> lullabies\$($item.file)"
  curl.exe -fsSL -o $dest $item.previewUrl
  if (-not (Test-Path $dest) -or (Get-Item $dest).Length -lt 1024) {
    throw "Download failed or too small: $($item.file)"
  }
}

Write-Host "Done. $($items.Count) lullabies in assets/audio/sfx/lullabies/"
