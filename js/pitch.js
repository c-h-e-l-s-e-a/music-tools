/* ---------- Pitch detection for the tuner ----------
   Finds the main pitch in a short slice of sound using the YIN method: it looks for the
   shortest delay at which the sound lines up with itself, which is one cycle of the note.
   Returns { freq, clarity } in Hz, or null when the sound is too quiet or isn't a clear note.
   There's no page code in here, so it can be tested on its own. */
function detectPitch(buf, sampleRate, opts) {
  opts = opts || {};
  var minF = opts.minF || 60, maxF = opts.maxF || 1600;
  var threshold = opts.threshold || 0.15;   /* lower = stricter about what counts as a clear note */
  var minRms = opts.minRms || 0.008;        /* quieter than this counts as silence */
  var n = buf.length, i, tau;

  /* too quiet? */
  var mean = 0, rms = 0;
  for (i = 0; i < n; i++) mean += buf[i];
  mean /= n;
  for (i = 0; i < n; i++) { var v = buf[i] - mean; rms += v * v; }
  rms = Math.sqrt(rms / n);
  if (rms < minRms) return null;

  var tauMin = Math.max(2, Math.floor(sampleRate / maxF));
  var tauMax = Math.min(Math.ceil(sampleRate / minF), (n >> 1) - 2);
  var W = n - tauMax - 1;

  /* how different the sound is from itself, delayed by tau samples */
  var d = new Float32Array(tauMax + 2);
  for (tau = 1; tau <= tauMax + 1; tau++) {
    var s = 0;
    for (i = 0; i < W; i++) { var x = buf[i] - buf[i + tau]; s += x * x; }
    d[tau] = s;
  }
  /* scaled against the running average, so 0 means a perfect match and about 1 means no match */
  d[0] = 1;
  var run = 0;
  for (tau = 1; tau <= tauMax + 1; tau++) { run += d[tau]; d[tau] = run > 0 ? d[tau] * tau / run : 1; }

  /* the first good match, then slide down into the bottom of its dip */
  var best = -1;
  for (tau = tauMin; tau <= tauMax; tau++) {
    if (d[tau] < threshold) {
      while (tau + 1 <= tauMax && d[tau + 1] < d[tau]) tau++;
      best = tau;
      break;
    }
  }
  if (best < 0) return null;

  /* fine-tune between samples */
  var a = d[best - 1], b = d[best], c = d[best + 1], den = a - 2 * b + c;
  var exact = best + (den !== 0 ? (a - c) / (2 * den) : 0);
  return { freq: sampleRate / exact, clarity: 1 - b };
}
