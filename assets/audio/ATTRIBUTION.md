# Game audio

## Sound effects

Procedural Web Audio synthesis in `js/game-audio.js` (no external files required).

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
- Synthesized SFX/BGM in this project: same site license as the app
