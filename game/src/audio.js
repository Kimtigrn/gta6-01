// Synthesized sound: every effect is built from WebAudio oscillators and filtered
// noise, so the game needs no audio files. Audio starts on the first user gesture
// (browsers block it before then) and can be muted with M.
export function createAudio() {
  let context = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let muted = false;
  let sirenTimer = 0;

  function ensure() {
    if (context) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.5;
      master.connect(context.destination);
      engineOsc = context.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = context.createGain();
      engineGain.gain.value = 0;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      engineOsc.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, duration, type, volume, slideTo) {
    if (!ensure() || muted) return;
    const now = context.currentTime;
    const osc = context.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), now + duration);
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  function noise(duration, volume, filterFreq) {
    if (!ensure() || muted) return;
    const now = context.currentTime;
    const length = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = context.createGain();
    gain.gain.value = volume;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(now);
  }

  return {
    /** Call from any user gesture; also resumes a suspended context. */
    unlock() {
      if (ensure() && context.state === 'suspended') context.resume();
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    isMuted() {
      return muted;
    },
    shoot() {
      noise(0.12, 0.5, 1800);
      tone(180, 0.1, 'square', 0.18, 60);
    },
    enemyShoot() {
      noise(0.1, 0.25, 1200);
    },
    hit() {
      tone(140, 0.15, 'sawtooth', 0.3, 70);
    },
    pickup() {
      tone(880, 0.12, 'sine', 0.3);
      tone(1320, 0.18, 'sine', 0.25);
    },
    cash() {
      tone(660, 0.1, 'triangle', 0.3);
      tone(990, 0.16, 'triangle', 0.3);
    },
    missionDone() {
      [523, 659, 784, 1047].forEach((freq, i) => {
        setTimeout(() => tone(freq, 0.22, 'triangle', 0.32), i * 110);
      });
    },
    missionStart() {
      tone(392, 0.14, 'triangle', 0.3);
      tone(523, 0.2, 'triangle', 0.3);
    },
    wantedUp() {
      tone(220, 0.2, 'sawtooth', 0.25, 440);
    },
    crash() {
      noise(0.25, 0.5, 500);
    },
    door() {
      tone(300, 0.08, 'square', 0.2, 180);
    },
    /** Engine hum follows the driven car's speed; call every frame. */
    engine(speedRatio, driving) {
      if (!ensure()) return;
      const target = muted || !driving ? 0 : 0.05 + speedRatio * 0.09;
      engineGain.gain.setTargetAtTime(target, context.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(55 + speedRatio * 130, context.currentTime, 0.08);
    },
    /** Two-tone police siren while the player is wanted; call every frame. */
    siren(dt, wanted) {
      if (!ensure() || muted || wanted === 0) return;
      sirenTimer -= dt;
      if (sirenTimer <= 0) {
        sirenTimer = 0.42;
        tone(720, 0.38, 'sine', 0.1);
        setTimeout(() => tone(540, 0.38, 'sine', 0.1), 210);
      }
    },
  };
}
