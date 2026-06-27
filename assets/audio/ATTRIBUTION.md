# Game audio

## Sound effects

Procedural Web Audio synthesis in `js/game-audio.js` (no external files required).

## Sound page (animals & instruments)

Real recordings under `assets/audio/sfx/` (CC0 / public domain). Run `scripts/fetch-sound-samples.ps1` to download.

| Source | License | Used for |
|--------|---------|----------|
| [BigSoundBank](https://bigsoundbank.com/) (La Sonothèque / Joseph SARDIN et al.) | CC0 | Farm/domestic animals (goat, donkey, robin, etc.), pig, eagle |
| [lavenderdotpet/CC0-Public-Domain-Sounds](https://github.com/lavenderdotpet/CC0-Public-Domain-Sounds) | CC0 | Elephant & wolf (beast_or_animal) |
| [VCSL — Versilian Community Sample Library](https://github.com/sgossner/VCSL) | CC0 | Piano, flute (soprano recorder), concert harp, tenor sax |
| [OpenGameArt — Penguin sounds](https://opengameart.org/content/penguin-sounds) (Bidone) | CC0 | Penguin |
| [OpenGameArt — Animal or beast sounds](https://opengameart.org/content/animal-or-beast-sounds) (pauliuw) | CC0 | Elephant, wolf |

Nature and white-noise categories remain synthesized in `js/sound.js`.

## Lullabies (Sound page)

20 tracks under `assets/audio/sfx/lullabies/` from [Freesound](https://freesound.org/) (**Creative Commons 0** — commercial use allowed). Catalog: `data/freesound-lullabies.json`. Re-download: `scripts/fetch-freesound-lullabies.ps1`.

| Freesound ID | Author | Local file |
|--------------|--------|------------|
| 859607 | blankie.rest | sleepy-piano.mp3 |
| 345310 | RokZRooM | light-piano-loop.mp3 |
| 583395 | HZee | soft-piano-lullaby.mp3 |
| 583494 | HZee | dreaming-piano.mp3 |
| 582948 | HZee | memories-piano.mp3 |
| 588711 | HZee | happy-thoughts-piano.mp3 |
| 713537 | ctribolet | piano-lullaby.mp3 |
| 841957 | joanne_pang | bittersweet-bells.mp3 |
| 554160 | Bigvegie | twinkle-piano.mp3 |
| 158206 | Rickbrewin | brahms-music-box.mp3 |
| 416384 | Garuda1982 | brahms-box-field.mp3 |
| 809137 | designerschoice | brahms-box-close.mp3 |
| 163644 | AudioBitsAndBytes | musicbox-clip.mp3 |
| 236813 | Thejack288 | musicbox-gentle-1.mp3 |
| 236814 | Thejack288 | musicbox-gentle-2.mp3 |
| 381973 | csnmedia | musicbox-soft.mp3 |
| 213886 | vumseplutten1709 | musicbox-vintage.mp3 |
| 812131 | christislord | all-night-all-day.mp3 |
| 390156 | iut_Paris8 | berceuse-piano.mp3 |
| 417446 | EJ_Fears | mystic-musicbox.mp3 |

## Background music

| Track | Source |
|-------|--------|
| **cave** (file) | [Chiptune Battle Music loop](https://opengameart.org/content/chiptune-battle-music) by pmiller — **CC0** |
| **cave**, **flappy**, **runner**, **arcade** (synth fallback) | Procedural chiptune loops in `js/game-audio.js` |

Place optional BGM files under `assets/audio/bgm/` (OGG). `cave.ogg` is used when present; otherwise a synthesized loop plays.

## Kenney (reference)

[Impact Sounds](https://kenney.nl/assets/impact-sounds) — CC0 — recommended for future file-based SFX packs.

## License note

- pmiller battle loop: CC0 (OpenGameArt)
- Kenney assets: CC0 1.0
- BigSoundBank CC0 samples: CC0 (see bigsoundbank.com/licenses)
- Synthesized SFX/BGM in this project: same site license as the app
