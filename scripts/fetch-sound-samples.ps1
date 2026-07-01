# Downloads CC0 / public-domain samples for Sound page (animals + instruments).
# Sources: BigSoundBank (CC0), lavenderdotpet/CC0-Public-Domain-Sounds, VCSL (CC0), OpenGameArt penguin (CC0).

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
if (-not (Test-Path (Join-Path $root "js\sound.js"))) {
  $root = Split-Path -Parent $PSScriptRoot
}

$animalDir = Join-Path $root "assets\audio\sfx\animals"
$instDir = Join-Path $root "assets\audio\sfx\instruments"
New-Item -ItemType Directory -Force -Path $animalDir, $instDir | Out-Null

$bsb = "https://bigsoundbank.com/UPLOAD/mp3/{0:D4}.mp3"
$gh = "https://raw.githubusercontent.com/lavenderdotpet/CC0-Public-Domain-Sounds/main"
$vcsl = "https://raw.githubusercontent.com/sgossner/VCSL/master"
$vcslJs = "https://cdn.jsdelivr.net/gh/sgossner/VCSL@master"

$downloads = @(
  @{ Out = "animals\dog.mp3"; Url = ($bsb -f 2955) },
  @{ Out = "animals\cat.mp3"; Url = ($bsb -f 1890) },
  @{ Out = "animals\cow.mp3"; Url = ($bsb -f 2386) },
  @{ Out = "animals\sheep.mp3"; Url = ($bsb -f 2343) },
  @{ Out = "animals\horse.mp3"; Url = ($bsb -f 284) },
  @{ Out = "animals\chicken.mp3"; Url = ($bsb -f 440) },
  @{ Out = "animals\duck.mp3"; Url = ($bsb -f 276) },
  @{ Out = "animals\bird.mp3"; Url = ($bsb -f 999) },
  @{ Out = "animals\bee.mp3"; Url = ($bsb -f 1000) },
  @{ Out = "animals\frog.mp3"; Url = ($bsb -f 998) },
  @{ Out = "animals\owl.mp3"; Url = ($bsb -f 1764) },
  @{ Out = "animals\mouse.mp3"; Url = ($bsb -f 459) },
  @{ Out = "animals\pig.mp3"; Url = ($bsb -f 1659) },
  @{ Out = "animals\elephant.wav"; Url = "$gh/beast_or_animal/Voice%203.wav" },
  @{ Out = "animals\wolf.wav"; Url = "$gh/beast_or_animal/Growl%202.wav" },
  @{ Out = "animals\eagle.mp3"; Url = ($bsb -f 3464) },
  @{ Out = "animals\goat.mp3"; Url = ($bsb -f 279) },
  @{ Out = "animals\donkey.mp3"; Url = ($bsb -f 1551) },
  @{ Out = "animals\robin.mp3"; Url = ($bsb -f 1670) },
  @{ Out = "animals\penguin.ogg"; Url = "https://opengameart.org/sites/default/files/penguin_02.ogg" },
  @{ Out = "instruments\guitar.mp3"; Url = ($bsb -f 1564) },
  @{ Out = "instruments\violin.mp3"; Url = ($bsb -f 1560) },
  @{ Out = "instruments\drums.mp3"; Url = ($bsb -f 2402) },
  @{ Out = "instruments\trumpet.mp3"; Url = ($bsb -f 3263) },
  @{ Out = "instruments\xylophone.mp3"; Url = ($bsb -f 2285) },
  @{ Out = "instruments\organ.mp3"; Url = ($bsb -f 598) },
  @{ Out = "instruments\piano.mp3"; Url = "https://cdn.freesound.org/previews/859/859607_15820073-hq.mp3" },
  @{ Out = "instruments\flute.mp3"; Url = "https://cdn.freesound.org/previews/529/529982_9159316-hq.mp3" },
  @{ Out = "instruments\harp.mp3"; Url = "https://cdn.freesound.org/previews/610/610703_7772719-hq.mp3" },
  @{ Out = "instruments\harmonica.mp3"; Url = "https://cdn.freesound.org/previews/701/701063_6007224-hq.mp3" },
  @{ Out = "instruments\glockenspiel.mp3"; Url = ($bsb -f 920) },
  @{ Out = "instruments\triangle.mp3"; Url = ($bsb -f 1688) },
  @{ Out = "instruments\cymbals.mp3"; Url = ($bsb -f 2314) },
  @{ Out = "instruments\singing-bowl.mp3"; Url = ($bsb -f 1109) },
  @{ Out = "instruments\sax.wav"; Url = "$vcsl/Aerophones/Reed%20Aerophones/Tenor%20Saxophone/Vibrato/BrettTenor_Vib_Main_C4_var2.wav" }
)

foreach ($item in $downloads) {
  $dest = Join-Path $root ("assets\audio\sfx\" + $item.Out)
  Write-Host "GET $($item.Url) -> $($item.Out)"
  curl.exe -fsSL -o $dest $item.Url
  if (-not (Test-Path $dest) -or (Get-Item $dest).Length -lt 512) {
    throw "Download failed or too small: $($item.Out)"
  }
}

# Remove legacy creature-SFX files replaced by real recordings
$legacy = @(
  "animals\pig.ogg", "animals\elephant.ogg", "animals\lion.ogg", "animals\wolf.ogg",
  "animals\eagle.ogg", "animals\snake.ogg", "animals\monkey.ogg",
  "animals\lion.mp3", "animals\snake.mp3", "animals\monkey.mp3"
)
foreach ($rel in $legacy) {
  $path = Join-Path $root ("assets\audio\sfx\" + $rel)
  if (Test-Path $path) { Remove-Item $path -Force }
}
$legacyInst = @("instruments\harp.mp3")
foreach ($rel in $legacyInst) {
  $path = Join-Path $root ("assets\audio\sfx\" + $rel)
  if (Test-Path $path) { Remove-Item $path -Force }
}

Write-Host "Done. $($downloads.Count) files in assets/audio/sfx/"
