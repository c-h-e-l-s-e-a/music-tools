/* ---------- Keyboard effects, like a guitarist's pedals ----------
   The keyboard's notes pass through the chosen effect on their way to the speakers. The metronome's clicks
   don't, so the beat stays clear. A soft limiter at the very end keeps big chords and long echoes from distorting.
   Effects: none · echo and space: reverb, echo, space · swirl: chorus, phaser, flanger, spin · mystical: shimmer, dream */
let keyEffect = 'none';
let fx = null;   // the chain that's built now: { ac, kind, input, limiter, lfos, halo }

/* where a keyboard note should go: the chosen effect's input (built the first time it's needed) */
function keyOut(ac) {
  if (!fx || fx.ac !== ac || fx.kind !== keyEffect) buildEffect(ac);
  return fx.input;
}

/* a reverb's "room": a burst of noise that dies away; longer and slower for bigger spaces */
const roomCache = [];
function room(ac, seconds, decay) {
  const hit = roomCache.find(function (r) { return r.ac === ac && r.seconds === seconds && r.decay === decay; });
  if (hit) return hit.buf;
  const len = Math.floor(ac.sampleRate * seconds), buf = ac.createBuffer(2, len, ac.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  roomCache.push({ ac: ac, seconds: seconds, decay: decay, buf: buf });
  if (roomCache.length > 6) roomCache.shift();
  return buf;
}

function buildEffect(ac) {
  const old = fx;
  const input = ac.createGain(), output = ac.createGain(), limiter = ac.createDynamicsCompressor();
  limiter.threshold.value = -8; limiter.knee.value = 8; limiter.ratio.value = 6;
  limiter.attack.value = 0.003; limiter.release.value = 0.25;
  output.connect(limiter); limiter.connect(ac.destination);
  const lfos = [];
  let halo = null;

  function gain(v) { const g = ac.createGain(); g.gain.value = v; return g; }
  /* a slow wobble (a "low-frequency oscillator") that moves a setting up and down by `depth` */
  function lfo(rate, depth, target) {
    const o = ac.createOscillator(), g = gain(depth);
    o.frequency.value = rate; o.connect(g); g.connect(target); o.start();
    lfos.push(o);
  }
  function dry(level) { const g = gain(level); input.connect(g); g.connect(output); }
  /* a reverb you can send sound into: `seconds` long, darker with a lower `tone` */
  function reverb(seconds, decay, level, tone) {
    const send = ac.createGain(), lp = ac.createBiquadFilter(), conv = ac.createConvolver(), w = gain(level);
    lp.type = 'lowpass'; lp.frequency.value = tone;
    conv.buffer = room(ac, seconds, decay);
    send.connect(lp); lp.connect(conv); conv.connect(w); w.connect(output);
    return send;
  }
  /* a copy of the sound, slightly delayed, its delay wavering: the heart of chorus and flanger */
  function waver(base, rate, depth, pan, level, also) {
    const d = ac.createDelay(0.1), p = ac.createStereoPanner(), w = gain(level);
    d.delayTime.value = base; p.pan.value = pan;
    lfo(rate, depth, d.delayTime);
    input.connect(d); d.connect(p); p.connect(w); w.connect(output);
    if (also) w.connect(also);
  }

  switch (keyEffect) {
    case 'reverb':    // a concert hall
      dry(1);
      input.connect(reverb(2.8, 2.5, 0.45, 5000));
      break;
    case 'echo': {    // each note repeats, quieter and darker each time
      dry(1);
      const d = ac.createDelay(2), fb = gain(0.42), lp = ac.createBiquadFilter(), w = gain(0.38);
      d.delayTime.value = 0.36; lp.type = 'lowpass'; lp.frequency.value = 2800;
      input.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(w); w.connect(output);
      break;
    }
    case 'space': {   // echoes bouncing left and right, into a big dark reverb
      dry(0.9);
      const L = ac.createDelay(2), R = ac.createDelay(2), toR = gain(0.5), toL = gain(0.5);
      const panL = ac.createStereoPanner(), panR = ac.createStereoPanner(), wL = gain(0.35), wR = gain(0.35);
      const rev = reverb(3.5, 2.2, 0.35, 4000);
      L.delayTime.value = 0.3; R.delayTime.value = 0.3; panL.pan.value = -0.8; panR.pan.value = 0.8;
      input.connect(L); L.connect(toR); toR.connect(R); R.connect(toL); toL.connect(L);
      L.connect(panL); panL.connect(wL); wL.connect(output); wL.connect(rev);
      R.connect(panR); panR.connect(wR); wR.connect(output); wR.connect(rev);
      input.connect(rev);
      break;
    }
    case 'chorus':    // three slightly wavering copies spread left to right: lush and wide
      dry(0.7);
      waver(0.018, 0.27, 0.003, -0.7, 0.4);
      waver(0.023, 0.41, 0.003, 0, 0.4);
      waver(0.028, 0.53, 0.003, 0.7, 0.4);
      break;
    case 'phaser': {  // a slow sweeping swirl
      dry(0.6);
      let last = input;
      for (let i = 0; i < 6; i++) {
        const ap = ac.createBiquadFilter();
        ap.type = 'allpass'; ap.frequency.value = 900; ap.Q.value = 0.5;
        lfo(0.3, 700, ap.frequency);
        last.connect(ap); last = ap;
      }
      const w = gain(0.6); last.connect(w); w.connect(output);
      break;
    }
    case 'flanger': { // a jet-plane whoosh
      dry(0.7);
      const d = ac.createDelay(0.05), fb = gain(0.55), w = gain(0.7);
      d.delayTime.value = 0.004;
      lfo(0.18, 0.0032, d.delayTime);
      input.connect(d); d.connect(fb); fb.connect(d); d.connect(w); w.connect(output);
      break;
    }
    case 'spin': {    // a rotating speaker, like an organ's: the sound circles around you
      const d = ac.createDelay(0.05), amp = gain(0.8), pan = ac.createStereoPanner();
      d.delayTime.value = 0.003;
      lfo(1.1, 0.0007, d.delayTime);   // the pitch wobbles as the speaker turns toward you and away
      lfo(1.1, 0.25, amp.gain);        // louder when it faces you
      lfo(1.1, 0.75, pan.pan);         // and it moves around, left to right
      input.connect(d); d.connect(amp); amp.connect(pan); pan.connect(output);
      break;
    }
    case 'shimmer': { // a long glowing reverb, with a soft halo above each note (see addHalo)
      dry(0.85);
      const rev = reverb(5, 3, 0.55, 7000);
      input.connect(rev);
      halo = gain(1); halo.connect(rev);
      break;
    }
    case 'dream': {   // soft and hazy: a slowly wavering chorus inside a huge, dark reverb
      dry(0.6);
      const rev = reverb(4.5, 2.6, 0.6, 3500);
      waver(0.02, 0.15, 0.005, -0.6, 0.45, rev);
      waver(0.027, 0.22, 0.005, 0.6, 0.45, rev);
      input.connect(rev);
      break;
    }
    default:          // none
      dry(1);
  }
  fx = { ac: ac, kind: keyEffect, input: input, limiter: limiter, lfos: lfos, halo: halo };
  /* the old effect keeps going for a few seconds so notes already sounding finish their tails, then it's taken apart */
  if (old) setTimeout(function () {
    try { old.limiter.disconnect(); } catch (e) {}
    old.lfos.forEach(function (o) { try { o.stop(); } catch (e) {} });
  }, 7000);
}

/* Shimmer's halo: quiet tones an octave, and an octave and a fifth, above the note, swelling into the reverb */
function addHalo(ac, freq, t) {
  if (!fx || fx.ac !== ac || !fx.halo) return;
  [[2, 0.05], [3, 0.02]].forEach(function (p) {
    if (freq * p[0] < 10000) tone(ac, 'sine', freq * p[0], t, p[1], 0.5, 3.5, fx.halo);
  });
}
