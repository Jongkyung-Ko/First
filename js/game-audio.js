(function () {
  const STORAGE_KEY = "game-audio-muted";
  const BGM_VOL = 0.22;
  const SFX_VOL = 0.35;

  let ac = null;
  let master = null;
  let sfxGain = null;
  let bgmGain = null;
  let muted = localStorage.getItem(STORAGE_KEY) === "1";
  let bgmEngine = null;
  let unlocked = false;

  function ensure() {
    if (!ac) {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain();
      sfxGain = ac.createGain();
      bgmGain = ac.createGain();
      master.gain.value = muted ? 0 : 1;
      sfxGain.gain.value = SFX_VOL;
      bgmGain.gain.value = BGM_VOL;
      sfxGain.connect(master);
      bgmGain.connect(master);
      master.connect(ac.destination);
    }
    if (ac.state === "suspended") ac.resume();
    return ac;
  }

  function unlock() {
    if (unlocked) return;
    unlocked = true;
    ensure();
    if (ac.state === "suspended") ac.resume();
  }

  function setMuted(next) {
    muted = next;
    localStorage.setItem(STORAGE_KEY, muted ? "1" : "0");
    if (master) master.gain.value = muted ? 0 : 1;
    if (muted) stopBgm();
  }

  function isMuted() {
    return muted;
  }

  function tone(freq, dur, type, vol, when) {
    const ctx = ensure();
    const t = when ?? ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(sfxGain);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noiseBurst(dur, vol) {
    const ctx = ensure();
    const bufferSize = ctx.sampleRate * dur;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(g);
    g.connect(sfxGain);
    src.start();
  }

  const SFX = {
    click() {
      tone(620, 0.04, "square", 0.12);
    },
    flip() {
      tone(380, 0.05, "triangle", 0.14);
      tone(520, 0.06, "triangle", 0.1, ensure().currentTime + 0.04);
    },
    match() {
      tone(660, 0.07, "sine", 0.15);
      tone(880, 0.09, "sine", 0.12, ensure().currentTime + 0.06);
    },
    score() {
      tone(980, 0.05, "sine", 0.14);
      tone(1310, 0.07, "sine", 0.1, ensure().currentTime + 0.05);
    },
    jump() {
      tone(280, 0.08, "square", 0.14);
      tone(420, 0.1, "square", 0.1, ensure().currentTime + 0.04);
    },
    flap() {
      tone(340, 0.06, "triangle", 0.12);
      noiseBurst(0.04, 0.06);
    },
    hit() {
      tone(120, 0.15, "sawtooth", 0.18);
      noiseBurst(0.08, 0.1);
    },
    win() {
      const t = ensure().currentTime;
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.12, "square", 0.12, t + i * 0.1));
    },
    lose() {
      const t = ensure().currentTime;
      [392, 330, 262, 196].forEach((f, i) => tone(f, 0.14, "sawtooth", 0.1, t + i * 0.12));
    },
    deal() {
      tone(300, 0.04, "triangle", 0.1);
      tone(360, 0.04, "triangle", 0.1, ensure().currentTime + 0.05);
    },
    flag() {
      tone(900, 0.04, "sine", 0.1);
    },
    mine() {
      noiseBurst(0.2, 0.2);
      tone(80, 0.25, "sawtooth", 0.2);
    },
    move() {
      tone(440, 0.03, "square", 0.08);
    },
    line() {
      tone(220, 0.08, "square", 0.14);
      tone(440, 0.1, "square", 0.12, ensure().currentTime + 0.06);
    },
    eat() {
      tone(520, 0.05, "sine", 0.12);
    },
    pong() {
      tone(640, 0.05, "square", 0.12);
    },
    card() {
      tone(420, 0.03, "triangle", 0.1);
    },
    go() {
      tone(740, 0.08, "square", 0.14);
      tone(980, 0.1, "square", 0.12, ensure().currentTime + 0.08);
    },
    stop() {
      tone(520, 0.1, "sine", 0.14);
    },
    step() {
      tone(180, 0.03, "triangle", 0.08);
    },
    attack() {
      noiseBurst(0.06, 0.12);
      tone(200, 0.08, "sawtooth", 0.12);
    },
    pickup() {
      tone(880, 0.06, "sine", 0.12);
      tone(1175, 0.08, "sine", 0.1, ensure().currentTime + 0.05);
    }
  };

  function sfx(name) {
    if (muted) return;
    unlock();
    const fn = SFX[name];
    if (fn) fn();
  }

  const BGM_PATTERNS = {
    forest: {
      tempo: 92,
      wave: "triangle",
      bass: [
        110, 0, 110, 130, 110, 98, 0, 87, 98, 110, 0, 130, 147, 130, 110, 98,
        87, 0, 98, 110, 130, 110, 98, 87, 82, 87, 98, 110, 0, 110, 98, 87
      ],
      lead: [
        440, 0, 523, 587, 523, 440, 0, 392, 440, 523, 659, 587, 523, 440, 392, 349,
        392, 440, 523, 587, 659, 587, 523, 440, 392, 349, 392, 440, 523, 0, 440, 392
      ],
      harmony: [
        220, 0, 262, 294, 262, 220, 0, 196, 220, 262, 330, 294, 262, 220, 196, 175,
        196, 220, 262, 294, 330, 294, 262, 220, 196, 175, 196, 220, 262, 0, 220, 196
      ]
    },
    spark: {
      tempo: 118,
      wave: "square",
      bass: [
        196, 196, 220, 220, 247, 247, 220, 196, 175, 196, 220, 247, 262, 247, 220, 196,
        196, 220, 247, 262, 294, 262, 247, 220, 196, 175, 196, 220, 247, 262, 247, 220
      ],
      lead: [
        784, 880, 988, 880, 784, 659, 784, 880, 988, 1175, 988, 880, 784, 659, 587, 659,
        784, 880, 988, 1175, 1319, 1175, 988, 880, 784, 659, 587, 659, 784, 880, 988, 880
      ],
      harmony: [
        392, 440, 494, 440, 392, 330, 392, 440, 494, 587, 494, 440, 392, 330, 294, 330,
        392, 440, 494, 587, 659, 587, 494, 440, 392, 330, 294, 330, 392, 440, 494, 440
      ]
    },
    drive: {
      tempo: 132,
      wave: "square",
      bass: [
        130, 0, 146, 0, 164, 0, 146, 130, 110, 0, 130, 146, 164, 146, 130, 110,
        130, 0, 146, 164, 174, 164, 146, 130, 110, 130, 146, 164, 196, 164, 146, 130
      ],
      lead: [
        523, 587, 659, 587, 523, 494, 523, 587, 659, 784, 659, 587, 523, 494, 440, 494,
        523, 587, 659, 784, 880, 784, 659, 587, 523, 587, 659, 784, 880, 784, 659, 587
      ],
      harmony: [
        262, 294, 330, 294, 262, 247, 262, 294, 330, 392, 330, 294, 262, 247, 220, 247,
        262, 294, 330, 392, 440, 392, 330, 294, 262, 294, 330, 392, 440, 392, 330, 294
      ]
    },
    sky: {
      tempo: 120,
      wave: "triangle",
      bass: [
        164, 164, 196, 196, 220, 220, 196, 164, 147, 164, 196, 220, 247, 220, 196, 164,
        164, 196, 220, 247, 262, 247, 220, 196, 164, 147, 164, 196, 220, 247, 220, 196
      ],
      lead: [
        659, 0, 784, 659, 988, 0, 784, 659, 587, 659, 784, 988, 1175, 988, 784, 659,
        659, 784, 988, 1175, 1319, 1175, 988, 784, 659, 587, 659, 784, 988, 1175, 988, 784
      ],
      harmony: [
        330, 0, 392, 330, 494, 0, 392, 330, 294, 330, 392, 494, 587, 494, 392, 330,
        330, 392, 494, 587, 659, 587, 494, 392, 330, 294, 330, 392, 494, 587, 494, 392
      ]
    },
    dungeon: {
      tempo: 96,
      wave: "sawtooth",
      bass: [
        110, 0, 110, 98, 87, 0, 98, 110, 98, 87, 82, 87, 98, 110, 98, 87,
        82, 87, 98, 110, 130, 110, 98, 87, 82, 0, 87, 98, 110, 98, 87, 82
      ],
      lead: [
        440, 0, 392, 349, 392, 440, 0, 523, 494, 440, 392, 349, 392, 440, 392, 349,
        330, 349, 392, 440, 523, 494, 440, 392, 349, 330, 349, 392, 440, 392, 349, 330
      ],
      harmony: [
        220, 0, 196, 175, 196, 220, 0, 262, 247, 220, 196, 175, 196, 220, 196, 175,
        165, 175, 196, 220, 262, 247, 220, 196, 175, 165, 175, 196, 220, 196, 175, 165
      ]
    },
    battle: {
      tempo: 144,
      wave: "square",
      bass: [
        164, 164, 196, 196, 220, 220, 196, 164, 164, 196, 220, 247, 262, 247, 220, 196,
        174, 196, 220, 247, 262, 294, 262, 247, 220, 196, 174, 196, 220, 247, 220, 196
      ],
      lead: [
        659, 784, 988, 784, 659, 784, 988, 1175, 988, 784, 659, 784, 988, 1175, 1319, 1175,
        988, 784, 659, 784, 988, 1175, 1319, 1175, 988, 784, 659, 784, 988, 784, 659, 587
      ],
      harmony: [
        330, 392, 494, 392, 330, 392, 494, 587, 494, 392, 330, 392, 494, 587, 659, 587,
        494, 392, 330, 392, 494, 587, 659, 587, 494, 392, 330, 392, 494, 392, 330, 294
      ]
    }
  };

  const BGM_FILES = {
    cave: "assets/audio/bgm/cave.ogg"
  };

  function stopBgm() {
    if (bgmEngine) {
      if (bgmEngine.timer) clearInterval(bgmEngine.timer);
      if (bgmEngine.oscillators) bgmEngine.oscillators.forEach((o) => {
        try { o.stop(); } catch (_) { /* noop */ }
      });
      if (bgmEngine.audio) {
        bgmEngine.audio.pause();
        bgmEngine.audio.src = "";
      }
      bgmEngine = null;
    }
  }

  function playFileBgm(url) {
    const audio = new Audio(url);
    audio.loop = true;
    audio.volume = BGM_VOL;
    const p = audio.play();
    if (p && p.catch) p.catch(() => {});
    return { audio, timer: null, oscillators: [] };
  }

  function playSynthBgm(track) {
    const pat = BGM_PATTERNS[track];
    if (!pat) return null;
    const ctx = ensure();
    const beatMs = (60 / pat.tempo) * 1000 / 2;
    let step = 0;
    const oscillators = [];
    const len = pat.bass.length;

    function playNote(freq, wave, lenSec, vol) {
      if (!freq) return;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = wave;
      osc.frequency.value = freq;
      const t = ctx.currentTime;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + lenSec);
      osc.connect(g);
      g.connect(bgmGain);
      osc.start(t);
      osc.stop(t + lenSec + 0.02);
      oscillators.push(osc);
      if (oscillators.length > 48) oscillators.splice(0, 12);
    }

    const timer = setInterval(() => {
      if (muted) return;
      const i = step % len;
      const noteLen = beatMs / 1000 * 0.92;
      playNote(pat.bass[i], "triangle", noteLen, 0.16);
      playNote(pat.lead[i], pat.wave, noteLen * 0.88, 0.13);
      if (pat.harmony) playNote(pat.harmony[i], "sine", noteLen * 0.85, 0.07);
      step++;
    }, beatMs);

    return { timer, oscillators, audio: null };
  }

  function playBgm(track) {
    if (muted) return;
    unlock();
    stopBgm();
    const file = BGM_FILES[track];
    if (file) {
      bgmEngine = playFileBgm(file);
      if (bgmEngine) return;
    }
    bgmEngine = playSynthBgm(track);
  }

  function mountToggle(container) {
    if (!container || container.querySelector(".game-audio-toggle")) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "game-audio-toggle";
    btn.title = "음소거";
    const sync = () => {
      btn.textContent = muted ? "🔇" : "🔊";
      btn.setAttribute("aria-pressed", muted ? "true" : "false");
    };
    sync();
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      unlock();
      setMuted(!muted);
      sync();
    });
    const toolbar = container.querySelector(".game-toolbar");
    if (toolbar) toolbar.appendChild(btn);
    else container.prepend(btn);
  }

  document.addEventListener(
    "pointerdown",
    () => unlock(),
    { once: true, passive: true }
  );
  document.addEventListener(
    "keydown",
    () => unlock(),
    { once: true }
  );

  window.GameAudio = {
    sfx,
    playBgm,
    stopBgm,
    setMuted,
    isMuted,
    unlock,
    mountToggle
  };
})();
