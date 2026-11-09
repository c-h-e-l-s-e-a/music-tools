/* ---------- Sound: one shared Web Audio engine for the keys, the metronome and the tuner ----------
   Two Safari habits made the sound come and go:
   - iPhone and iPad: web sound follows the ring/silent switch, unless the page says it's a music player.
     From iOS 17, "playback" does that, so the app plays even on silent, the way music apps do.
   - Mac and iPhone: Safari sometimes pauses or stalls the engine (after switching tabs or apps, or when
     another tab with sound closes) and doesn't start it again. So every tap that makes a sound checks the
     engine first, and if it isn't running, starts a fresh one right there (browsers only allow that in a tap).
   Loaded first: the keyboard, metronome and tuner all use it. */
let AC = null;
let soundMode = 'playback';            // the tuner switches to 'play-and-record' while the microphone is on
const onFreshSound = [];               // the metronome and tuner re-attach when a fresh engine starts
let lastClock = -1, lastMoveAt = 0;    // when the engine's clock was last seen moving
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
  if (!clockMoved()) freshSound();
  return AC;
}

/* For code that runs between taps (the metronome's timer, the tuner's listening): no new engine, just a nudge. */
function getAC() {
  if (!AC) freshSound();
  if (AC.state === 'suspended' || AC.state === 'interrupted') AC.resume().catch(() => {});
  return AC;
}

function playFreq(freq) {
  const ac = getAC();
  const osc = ac.createOscillator(), env = ac.createGain();
  osc.connect(env); env.connect(ac.destination);
  osc.type = 'triangle';
  osc.frequency.value = freq;
  const t = ac.currentTime;
  env.gain.setValueAtTime(0.4, t);
  env.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
  osc.start(t); osc.stop(t + 1.5);
}

/* coming back to the page: pause and restart the engine, which gets Safari's stalled sound going again
   so a running metronome carries on; if that doesn't work, the next tap starts a fresh engine */
document.addEventListener('visibilitychange', () => {
  if (document.hidden || !AC || AC.state === 'closed') return;
  AC.suspend().then(() => AC.resume()).catch(() => {});
});
