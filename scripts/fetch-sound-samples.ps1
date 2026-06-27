# Downloads CC0 / public-domain samples for Sound page (animals + instruments).
# Sources: BigSoundBank (CC0), lavenderdotpet/CC0-Public-Domain-Sounds, OpenGameArt penguin (CC0).

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
  @{ Out = "animals\pig.ogg"; Url = "$gh/80-CC0-creature-SFX/grunt_01.ogg" },
  @{ Out = "animals\lion.ogg"; Url = "$gh/80-CC0-creature-SFX/roar_01.ogg" },
  @{ Out = "animals\wolf.ogg"; Url = "$gh/80-CC0-creature-SFX/howl.ogg" },
  @{ Out = "animals\elephant.ogg"; Url = "$gh/80-CC0-creature-SFX/monster_05.ogg" },
  @{ Out = "animals\eagle.ogg"; Url = "$gh/80-CC0-creature-SFX/scream_01.ogg" },
  @{ Out = "animals\snake.ogg"; Url = "$gh/80-CC0-creature-SFX/spit_01.ogg" },
  @{ Out = "animals\monkey.ogg"; Url = "$gh/80-CC0-creature-SFX/cute_03.ogg" },
  @{ Out = "animals\penguin.ogg"; Url = "https://opengameart.org/sites/default/files/penguin_01.ogg" },
  @{ Out = "instruments\guitar.mp3"; Url = ($bsb -f 1564) },
  @{ Out = "instruments\violin.mp3"; Url = ($bsb -f 1560) },
  @{ Out = "instruments\drums.mp3"; Url = ($bsb -f 2402) },
  @{ Out = "instruments\harp.mp3"; Url = ($bsb -f 1110) },
  @{ Out = "instruments\trumpet.mp3"; Url = ($bsb -f 3263) },
  @{ Out = "instruments\xylophone.mp3"; Url = ($bsb -f 2285) },
  @{ Out = "instruments\organ.mp3"; Url = ($bsb -f 598) },
  @{ Out = "instruments\piano.wav"; Url = "$gh/bb%20-%20Keyboard%20Sounds%20(Mar%202021)/Keyboard%20-%20Key%201.wav" },
  @{ Out = "instruments\flute.wav"; Url = "$gh/bb%20-%20Slide%20Whistle%20(Aug%202021)/Fast%20Rise%20Fall.wav" },
  @{ Out = "instruments\sax.wav"; Url = "$gh/bb%20-%20Slide%20Whistle%20(Aug%202021)/Drunk%201.wav" }
)

foreach ($item in $downloads) {
  $dest = Join-Path $root ("assets\audio\sfx\" + $item.Out)
  Write-Host "GET $($item.Url) -> $($item.Out)"
  curl.exe -fsSL -o $dest $item.Url
  if (-not (Test-Path $dest) -or (Get-Item $dest).Length -lt 512) {
    throw "Download failed or too small: $($item.Out)"
  }
}

Write-Host "Done. $($downloads.Count) files in assets/audio/sfx/"
