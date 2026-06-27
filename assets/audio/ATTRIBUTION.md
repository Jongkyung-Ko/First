# Game audio

## Sound effects

Procedural Web Audio synthesis in `js/game-audio.js` (no external files required).

## Sound page (animals & instruments)

Real recordings under `assets/audio/sfx/` (CC0 / public domain). Run `scripts/fetch-sound-samples.ps1` to download.

| Source | License | Used for |
|--------|---------|----------|
| [BigSoundBank](https://bigsoundbank.com/) (La Sonothèque / Joseph SARDIN et al.) | CC0 | Farm/domestic animals (goat, donkey, robin, etc.), pig, eagle |
| [lavenderdotpet/CC0-Public-Domain-Sounds](https://github.com/lavenderdotpet/CC0-Public-Domain-Sounds) | CC0 | Elephant & wolf (beast_or_animal), keyboard, slide whistle |
| [OpenGameArt — Penguin sounds](https://opengameart.org/content/penguin-sounds) (Bidone) | CC0 | Penguin |
| [OpenGameArt — Animal or beast sounds](https://opengameart.org/content/animal-or-beast-sounds) (pauliuw) | CC0 | Elephant, wolf |

Nature and white-noise categories remain synthesized in `js/sound.js`.

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
