/* ---------- Sound: one shared Web Audio engine for the keys, the metronome and the tuner ----------
   Two Safari habits made the sound come and go:
   - iPhone and iPad: web sound follows the ring/silent switch, unless the page says it's a music player.
     From iOS 17, "playback" does that, so the app plays even on silent, the way music apps do.
   - Mac and iPhone: Safari sometimes pauses or stalls the engine (after switching tabs or apps, or when
     another tab with sound closes) and doesn't start it again. So every tap that makes a sound checks the
     engine first, and if it isn't running, starts a fresh one right there (browsers only allow that in a tap).
   It also makes the sounds themselves: the keyboard's sounds (held or tapped), the metronome's clicks,
   and the countdown's chime.
   Loaded first: the keyboard, metronome and tuner all use it. */
let AC = null;
let soundMode = 'playback';            // the tuner switches to 'play-and-record' while the microphone is on
const onFreshSound = [];               // the metronome and tuner re-attach when a fresh engine starts
let lastClock = -1, lastMoveAt = 0;    // when the engine's clock was last seen moving
let acRan = false;                     // has the current engine ever started?
const STALLED_AFTER = 800;             // a "running" engine whose clock hasn't moved for this long (ms) has stalled

function setSoundMode(mode) {
  soundMode = mode;
  try { if (navigator.audioSession) navigator.audioSession.type = mode; } catch (e) {}
}

function freshSound() {
  const old = AC;
  setSoundMode(soundMode);
  AC = new (window.AudioContext || window.webkitAudioContext)();
  lastClock = AC.currentTime; lastMoveAt = performance.now();
  const ctx = AC;
  acRan = ctx.state === 'running';
  ctx.onstatechange = () => { if (ctx === AC && ctx.state === 'running') acRan = true; };
  if (old) {
    try { old.close(); } catch (e) {}
    onFreshSound.forEach(fn => { try { fn(AC); } catch (e) {} });
  }
  return AC;
}

/* is the clock moving? checked a few times a second, and again at each tap */
function clockMoved() {
  if (!AC || AC.state !== 'running') return false;
  if (AC.currentTime !== lastClock) { lastClock = AC.currentTime; lastMoveAt = performance.now(); return true; }
  return performance.now() - lastMoveAt < STALLED_AFTER;
}
setInterval(clockMoved, 250);

/* Call at the start of any tap or click that makes a sound. Returns a working engine.
   "running" with a stopped clock is a Safari bug that doesn't recover by itself, so that gets a fresh engine too. */
function wakeSound() {
  /* an engine that has never started yet (made just before this tap): start it, keeping any note already waiting on it */
  if (AC && AC.state === 'suspended' && !acRan) { AC.resume().catch(() => {}); return AC; }
  if (!clockMoved()) freshSound();
  return AC;
}

/* For code that runs between taps (the metronome's timer, the tuner's listening): no new engine, just a nudge. */
function getAC() {
  if (!AC) freshSound();
  if (AC.state === 'suspended' || AC.state === 'interrupted') AC.resume().catch(() => {});
  return AC;
}

/* ---------- The sounds you can choose (picked in the menus; see js/sound-options.js) ---------- */
let keySound = 'classic';    // classic · musicbox · organ · pad · lead · 8bit   (the effect on them is in js/effects.js)
let clickSound = 'wood';     // gentle: tick felt drop · percussion: wood claves hihat drums
                             // musical: keys bell 8bit · original: classic
let clickVolume = 0.7;       // the metronome's volume, 0 to 1

/* a gain that rises to `peak` over `rise` seconds, then fades away over `fade` seconds */
function envelope(ac, t, peak, rise, fade) {
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + rise);
  g.gain.exponentialRampToValueAtTime(0.0001, t + rise + fade);
  return g;
}
function tone(ac, type, freq, t, peak, rise, fade, out) {
  const o = ac.createOscillator(), g = envelope(ac, t, peak, rise, fade);
  o.type = type; o.frequency.value = freq;
  o.connect(g); g.connect(out);
  o.start(t); o.stop(t + rise + fade + 0.05);
}
/* a tone whose pitch slides from f0 to f1 over `slide` seconds */
function sweep(ac, f0, f1, slide, t, peak, rise, fade, out) {
  const o = ac.createOscillator(), g = envelope(ac, t, peak, rise, fade);
  o.type = 'sine';
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + slide);
  o.connect(g); g.connect(out);
  o.start(t); o.stop(t + rise + fade + 0.05);
}
/* a short burst of filtered noise, for the wood block and hi-hat */
let noiseBuf = null, noiseFor = null;
function noiseHit(ac, t, filter, freq, q, peak, fade, out, rise) {
  if (noiseFor !== ac) {
    noiseBuf = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.2), ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noiseFor = ac;
  }
  rise = rise || 0.001;
  const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = envelope(ac, t, peak, rise, fade);
  s.buffer = noiseBuf; f.type = filter; f.frequency.value = freq; f.Q.value = q;
  s.connect(f); f.connect(g); g.connect(out);
  s.start(t); s.stop(t + rise + fade + 0.02);
}

/* the 8-bit tone: a "pulse" wave that's on a quarter of the time, the thin buzzy sound of old game consoles */
let pulse = null, pulseFor = null;
function pulseWave(ac) {
  if (pulseFor !== ac) {
    const n = 64, re = new Float32Array(n), im = new Float32Array(n);
    for (let k = 1; k < n; k++) re[k] = 2 / (k * Math.PI) * Math.sin(k * Math.PI * 0.25);
    pulse = ac.createPeriodicWave(re, im);
    pulseFor = ac;
  }
  return pulse;
}
/* a pulse-wave note that holds steady, then stops quickly, the way game consoles played notes */
function blip(ac, freq, t, hold, fade, peak, out) {
  const o = ac.createOscillator(), g = ac.createGain();
  peak = Math.max(peak, 0.0002);
  o.setPeriodicWave(pulseWave(ac));
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.002);
  g.gain.setValueAtTime(peak, t + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t + hold + fade);
  o.connect(g); g.connect(out);
  o.start(t); o.stop(t + hold + fade + 0.05);
}

/* How each keyboard sound behaves when you hold a key and let go:
   - these hold steady while the key is down, then fade over their release time (seconds) */
const SUSTAINED = { organ: 0.15, '8bit': 0.06, pad: 0.9, lead: 0.18 };
/* - these ring on by themselves after you let go, as the real instruments do */
const RINGS_ON = { musicbox: true };
/* - classic fades naturally, and stops soon after you let go, like a piano's dampers */

/* the held sounds: they start, then hold until stopped. Returns the oscillators to stop */
function sustainedVoice(ac, kind, freq, t, out) {
  const oscs = [];
  function osc(type, f, detuneCents) {
    const o = ac.createOscillator();
    if (type === 'pulse') o.setPeriodicWave(pulseWave(ac)); else o.type = type;
    o.frequency.value = f;
    if (detuneCents) o.detune.value = detuneCents;
    oscs.push(o);
    return o;
  }
  function rise(peak, time) {
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + time);
    g.connect(out);
    return g;
  }
  if (kind === 'organ') {                       // drawbar organ: a few pure harmonics, steady
    [[1, 0.17], [2, 0.09], [3, 0.05], [4, 0.025]].forEach(function (p) { osc('sine', freq * p[0]).connect(rise(p[1], 0.02)); });
  } else if (kind === '8bit') {                 // a game-console pulse wave
    osc('pulse', freq).connect(rise(0.16, 0.002));
  } else if (kind === 'pad') {                  // synth pad: three slightly detuned saw waves, softened, swelling in slowly
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass'; lp.Q.value = 0.5;
    lp.frequency.setValueAtTime(Math.min(600 + freq * 1.5, 3500), t);
    lp.frequency.linearRampToValueAtTime(Math.min(900 + freq * 2.5, 5000), t + 1.2);   // it opens up a little as it swells
    lp.connect(rise(0.12, 0.45));
    [-9, 0, 9].forEach(function (c) { osc('sawtooth', freq, c).connect(lp); });
  } else if (kind === 'lead') {                 // synth lead: bright saw and square, a filter that snaps shut, and vibrato that creeps in
    const lp = ac.createBiquadFilter(), amp = rise(0.1, 0.008);
    lp.type = 'lowpass'; lp.Q.value = 3;
    lp.frequency.setValueAtTime(Math.min(freq * 10, 9000), t);
    lp.frequency.exponentialRampToValueAtTime(Math.min(freq * 3.5, 6000), t + 0.25);
    lp.connect(amp);
    const a = osc('sawtooth', freq), b = osc('square', freq, 6);
    const vib = ac.createOscillator(), depth = ac.createGain();
    vib.frequency.value = 5.5;
    depth.gain.setValueAtTime(0, t);
    depth.gain.setValueAtTime(0, t + 0.3);
    depth.gain.linearRampToValueAtTime(freq * 0.006, t + 0.7);   // about ±10 cents, after a moment
    vib.connect(depth); depth.connect(a.frequency); depth.connect(b.frequency);
    oscs.push(vib);
    const half = ac.createGain(); half.gain.value = 0.5;
    a.connect(lp); b.connect(half); half.connect(lp);
  }
  oscs.forEach(function (o) { o.start(t); });
  return oscs;
}

/* the keyboard's sounds at a set length. `level` scales the volume; `short` makes a brief version for the metronome */
function voice(ac, kind, freq, t, out, level, short) {
  if (SUSTAINED[kind] !== undefined) {          // a held sound, held for a moment then let go
    const g = ac.createGain(), hold = short ? 0.1 : 0.8, rel = SUSTAINED[kind];
    g.gain.value = level; g.connect(out);
    g.gain.setTargetAtTime(0, t + hold, rel / 3);
    sustainedVoice(ac, kind, freq, t, g).forEach(function (o) { o.stop(t + hold + rel * 2 + 0.2); });
  } else if (kind === 'musicbox') {             // a plucked metal tooth: a tiny pluck, a bright metallic overtone, a long shimmering ring
    const ring = short ? 0.35 : Math.max(1.0, Math.min(3.0, 3.0 - Math.log2(freq / 220) * 0.6));   // low teeth ring longer
    tone(ac, 'sine', freq, t, 0.22 * level, 0.001, ring, out);
    tone(ac, 'sine', freq * Math.pow(2, 3 / 1200), t, 0.08 * level, 0.001, ring * 0.8, out);   // a second tooth a hair sharp: the shimmer
    tone(ac, 'sine', freq * 2, t, 0.03 * level, 0.001, ring * 0.3, out);
    tone(ac, 'sine', freq * 6.27, t, 0.06 * level, 0.001, short ? 0.08 : 0.2, out);           // a metal tooth's overtone isn't a whole multiple
    noiseHit(ac, t, 'highpass', 4000, 0.7, 0.05 * level, 0.006, out);                         // the pin plucking the tooth
  } else {                                      // classic, the original: a plain triangle wave
    tone(ac, 'triangle', freq, t, 0.4 * level, 0.003, short ? 0.25 : 1.5, out);
  }
}

/* a key held down: it sounds until you let go. Returns a function that lets go of it. */
function noteOn(freq) {
  const ac = getAC(), t = ac.currentTime + 0.005, bus = ac.createGain(), k = keySound;
  bus.connect(keyOut(ac));                     // through the chosen effect (js/effects.js)
  let held = [];
  if (SUSTAINED[k] !== undefined) held = sustainedVoice(ac, k, freq, t, bus);
  else voice(ac, k, freq, t, bus, 1, false);   /* these fade by themselves */
  addHalo(ac, freq, t);                        // the Shimmer effect's glow; does nothing for the others (js/effects.js)
  if (held.length) held.forEach(function (o) { o.stop(t + 60); });   /* a backstop, in case a let-go is never heard */
  let done = false;
  return function letGo(quick) {
    if (done) return;
    done = true;
    if (quick) {                                      /* a press that turned out to be a swipe: fade out at once */
      bus.gain.setTargetAtTime(0, ac.currentTime, 0.015);
      held.forEach(function (o) { try { o.stop(ac.currentTime + 0.2); } catch (e) {} });
      setTimeout(function () { try { bus.disconnect(); } catch (e) {} }, 1000);
      return;
    }
    const from = Math.max(ac.currentTime, t + 0.1);   /* even a very quick tap is heard for a moment */
    if (held.length) {
      const rel = SUSTAINED[k];
      bus.gain.setTargetAtTime(0, from, rel / 3);
      held.forEach(function (o) { try { o.stop(from + rel * 2 + 0.2); } catch (e) {} });
    } else if (!RINGS_ON[k]) {
      bus.gain.setTargetAtTime(0, from, 0.12);
    }
    setTimeout(function () { try { bus.disconnect(); } catch (e) {} }, 5000);
  };
}

/* the countdown's end: three soft bell notes going up */
function chime() {
  const ac = getAC(), t = ac.currentTime + 0.02;
  [1046.5, 1318.5, 1568].forEach(function (f, i) {
    [[1, 1, 1.2], [2.76, 0.3, 0.4], [5.4, 0.12, 0.2]].forEach(function (p) {
      tone(ac, 'sine', f * p[0], t + i * 0.22, 0.22 * p[1], 0.002, p[2], ac.destination);
    });
  });
}

/* one note at its full natural length (the sample you hear when you pick a keyboard sound) */
function playFreq(freq) {
  const ac = getAC(), t = ac.currentTime + 0.005;
  voice(ac, keySound, freq, t, keyOut(ac), 1, false);
  addHalo(ac, freq, t);
}

/* one metronome click at `time`; the accent (beat 1) is higher and a little louder */
function playClick(time, accent) {
  const ac = getAC(), v = clickVolume, out = ac.destination, a = accent;
  if (v <= 0) return;
  switch (clickSound) {
    /* gentle */
    case 'tick':      // a soft, low tick
      tone(ac, 'sine', a ? 880 : 660, time, (a ? 0.34 : 0.26) * v, 0.002, 0.035, out); break;
    case 'felt': {    // a muffled knock, like tapping a padded table
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1200; lp.connect(out);
      sweep(ac, a ? 420 : 340, a ? 240 : 200, 0.07, time, (a ? 0.5 : 0.38) * v, 0.004, 0.08, lp); break;
    }
    case 'drop':      // a little rising "plip", like a water drop
      sweep(ac, a ? 700 : 520, a ? 1900 : 1400, 0.05, time, (a ? 0.32 : 0.25) * v, 0.002, 0.07, out); break;
    /* percussion */
    case 'claves':    // two hardwood sticks: bright and very short
      tone(ac, 'sine', a ? 2900 : 2500, time, (a ? 0.3 : 0.22) * v, 0.001, 0.035, out); break;
    case 'hihat':     // a light hi-hat
      noiseHit(ac, time, 'highpass', 7000, 0.7, (a ? 0.45 : 0.3) * v, a ? 0.06 : 0.035, out); break;
    case 'drums':     // a kick drum on beat 1, a hi-hat on every beat
      if (a) {
        sweep(ac, 180, 55, 0.1, time, 0.75 * v, 0.002, 0.2, out);
        tone(ac, 'sine', 1200, time, 0.12 * v, 0.001, 0.012, out);   /* the beater, so phone speakers hear it */
      }
      noiseHit(ac, time, 'highpass', 7000, 0.7, 0.24 * v, 0.04, out); break;
    /* musical */
    case 'keys':      // the keyboard's own sound: G5 on beat 1, C5 on the others
      voice(ac, keySound, a ? 783.99 : 523.25, time, out, v * 0.8, true); break;
    case 'bell':      // a small, soft bell: E6 on beat 1, B5 on the others
      [[1, 1, 0.7], [2.76, 0.3, 0.25], [5.4, 0.12, 0.12]].forEach(function (p) {
        tone(ac, 'sine', (a ? 1318.5 : 987.77) * p[0], time, (a ? 0.22 : 0.17) * p[1] * v, 0.002, p[2], out);
      });
      break;
    case '8bit':      // a game-style blip: G5 on most beats; on beat 1, C6 jumping up to G6
      if (a) { blip(ac, 1046.5, time, 0.035, 0.01, 0.15 * v, out); blip(ac, 1567.98, time + 0.04, 0.05, 0.02, 0.15 * v, out); }
      else blip(ac, 783.99, time, 0.04, 0.015, 0.13 * v, out);
      break;
    /* original */
    case 'classic':   // the original beep
      tone(ac, 'square', a ? 1050 : 800, time, (a ? 0.22 : 0.13) * v, 0.001, 0.05, out); break;
    default:          // wood block: a short "tok"
      tone(ac, 'sine', a ? 1250 : 900, time, (a ? 0.4 : 0.3) * v, 0.001, 0.05, out);
      noiseHit(ac, time, 'bandpass', a ? 3000 : 2400, 3, (a ? 0.22 : 0.16) * v, 0.02, out);
  }
}

/* coming back to the page: pause and restart the engine, which gets Safari's stalled sound going again
   so a running metronome carries on; if that doesn't work, the next tap starts a fresh engine */
document.addEventListener('visibilitychange', () => {
  if (document.hidden || !AC || AC.state === 'closed') return;
  AC.suspend().then(() => AC.resume()).catch(() => {});
});
