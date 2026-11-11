// ── Grand staff ───────────────────────────────────────────────────────────────
// Positions count diatonic steps up from each staff's bottom line
// (treble bottom line = E4, bass bottom line = G2). D4 and up go on the treble
// staff; C4 and below on the bass staff. Sharps sit on their natural's line.
const TREBLE_BOTTOM_MIDI = noteToMidi("E4");
const BASS_BOTTOM_MIDI   = noteToMidi("G2");

function staffInfo(midi){
  const dp=diatonicPos(midi);
  const trebleBaseDp=diatonicPos(TREBLE_BOTTOM_MIDI);
  const bassBaseDp=diatonicPos(BASS_BOTTOM_MIDI);
  const useNote=NOTE_NAMES[midi%12].includes("#")?NOTE_NAMES[(midi%12)-1]:NOTE_NAMES[midi%12];
  const oct=Math.floor(midi/12)-1;
  const aboveMiddleC=(oct>4)||(oct===4&&DIATONIC.indexOf(useNote)>=1);
  if(aboveMiddleC){ return{clef:"treble", steps:dp-trebleBaseDp}; }
  else { return{clef:"bass", steps:dp-bassBaseDp}; }
}

// Layout: treble staff on top, bass staff below, middle C exactly halfway between, note names underneath.
const LG = 8;                                  // pixels per diatonic step (half a space)
const TREBLE_TOP    = 48;                      // room above for C6 (two ledger lines)
const TREBLE_BOTTOM = TREBLE_TOP + 8*LG;       // E4 line
const BASS_TOP      = TREBLE_BOTTOM + 4*LG;    // A3 line; middle C sits 2 steps from each staff
const BASS_BOTTOM   = BASS_TOP + 8*LG;         // G2 line
const NAME_TOP      = BASS_BOTTOM + 4*LG + 12; // the first line of names, below room for E2's ledger line
const NAME_LINE     = 12, MAX_NAMES = 4;       // up to four names per column; more shows as "+2"
const STAFF_H       = NAME_TOP + NAME_LINE*(MAX_NAMES-1) + 6;

// ── The trail ────────────────────────────────────────────────────────────────
// Each note you play is added on the right, so the staff shows the last few notes in order.
// Notes that start within GROUP_MS of each other count as played together, and stack as a chord.
// A few seconds after the last note ends, the trail clears.
const GROUP_MS = 100, CLEAR_AFTER = 3000, COL_W = 30, LEFT_GAP = 14;
let trail = [];                   // columns, oldest first: { at, notes: [note numbers] }
const sounding = new Map();       // note number -> how many keys or voices are holding it
let trailTimer = 0, staffW = 300;

// ── A lesson's question ──────────────────────────────────────────────────────
// Notes a lesson asks about (js/lessons.js) stay on the left in orange, named "?", until the lesson
// clears them. Each entry is one column: a list of note numbers.
let asked = [];
function staffAsk(cols){ asked = cols || []; drawStaff(); }

function staffPress(midi){
  clearTimeout(trailTimer);
  const now = performance.now(), last = trail[trail.length - 1];
  if (last && now - last.at <= GROUP_MS && last.notes.indexOf(midi) < 0) last.notes.push(midi);
  else trail.push({ at: now, notes: [midi] });
  sounding.set(midi, (sounding.get(midi) || 0) + 1);
  drawStaff();
}
function staffRelease(midi){
  const n = (sounding.get(midi) || 0) - 1;
  if (n > 0) sounding.set(midi, n); else sounding.delete(midi);
  if (!sounding.size){ clearTimeout(trailTimer); trailTimer = setTimeout(clearStaff, CLEAR_AFTER); }
}
// a press that turned out to be a swipe: take its note back off the trail
function staffCancel(midi){
  for (let i = trail.length - 1; i >= 0; i--){
    const k = trail[i].notes.indexOf(midi);
    if (k >= 0){ trail[i].notes.splice(k, 1); if (!trail[i].notes.length) trail.splice(i, 1); break; }
  }
  staffRelease(midi);
  drawStaff();
}
function clearStaff(){
  clearTimeout(trailTimer);
  trail = [];
  sounding.clear();
  drawStaff();
}

function prettyName(m){ return midiToStr(m).replace("#", "♯"); }

function resizeStaff(){
  const canvas = document.getElementById("staffCanvas");
  const dpr = window.devicePixelRatio || 1;
  staffW = Math.max(260, canvas.parentElement.clientWidth);
  canvas.width = Math.round(staffW * dpr);
  canvas.height = Math.round(STAFF_H * dpr);
  canvas.style.width = staffW + "px";
  canvas.style.height = STAFF_H + "px";
  canvas.getContext("2d").setTransform(dpr, 0, 0, dpr, 0, 0);   // draw in CSS pixels, crisp on sharp screens
  drawStaff();
}
window.addEventListener("resize", resizeStaff);

function drawStaff(){
  const canvas = document.getElementById("staffCanvas");
  const W = staffW, ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, W, STAFF_H);
  const leftMar = 56, rightMar = W - 20;
  const lineColor = "rgba(0,0,0,0.22)", noteColor = "#185FA5", clefColor = "rgba(0,0,0,0.38)";

  ctx.strokeStyle = lineColor; ctx.lineWidth = 1;
  [TREBLE_BOTTOM, BASS_BOTTOM].forEach(yBottom => {
    for (let i = 0; i < 5; i++){ const y = yBottom - i*2*LG; ctx.beginPath(); ctx.moveTo(leftMar, y); ctx.lineTo(rightMar, y); ctx.stroke(); }
  });
  ctx.fillStyle = clefColor;
  ctx.font = "48px serif"; ctx.fillText("𝄞", 10, TREBLE_BOTTOM - 2*LG + 2);
  ctx.font = "40px serif"; ctx.fillText("𝄢", 12, BASS_TOP + 5*LG + 2);
  ctx.beginPath(); ctx.moveTo(leftMar, TREBLE_TOP); ctx.lineTo(leftMar, BASS_BOTTOM); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(rightMar, TREBLE_TOP); ctx.lineTo(rightMar, BASS_BOTTOM); ctx.stroke();

  // only as many columns as fit; the oldest drop off the left
  const ASK_GAP = asked.length ? 10 : 0;
  const fit = Math.max(1, Math.floor((rightMar - leftMar - LEFT_GAP - ASK_GAP) / COL_W) - asked.length);
  if (trail.length > fit) trail = trail.slice(trail.length - fit);
  const n = trail.length, NRX = 6, NRY = 4.5;
  const cols = asked.map(notes => ({ notes: notes, ask: true })).concat(trail);

  cols.forEach((col, i) => {
    const t = i - asked.length;                                       // its place in the trail
    const x = leftMar + LEFT_GAP + i*COL_W + COL_W/2 + (col.ask ? 0 : ASK_GAP);
    ctx.globalAlpha = col.ask || t === n - 1 ? 1 : 0.35 + 0.45 * (t + 1) / n;   // older notes fade
    const notes = col.notes.slice().sort((a, b) => a - b).map(m => {
      const info = staffInfo(m), base = info.clef === "treble" ? TREBLE_BOTTOM : BASS_BOTTOM;
      return { m, info, base, y: base - info.steps*LG, dx: 0 };
    });
    // two notes a step apart (or on the same line) can't share a spot: the upper one moves to the right
    for (let j = 1; j < notes.length; j++){
      if (notes[j-1].y - notes[j].y <= LG && notes[j-1].dx === 0) notes[j].dx = 11;
    }
    notes.forEach(o => {
      const nx = x + o.dx, ledger = NRX*2.4;
      ctx.strokeStyle = "rgba(0,0,0,0.45)"; ctx.lineWidth = 1.2;
      if (o.info.steps < 0) for (let st = -2; st >= o.info.steps; st -= 2){ const ly = o.base - st*LG; ctx.beginPath(); ctx.moveTo(nx-ledger, ly); ctx.lineTo(nx+ledger, ly); ctx.stroke(); }
      if (o.info.steps > 8) for (let st = 10; st <= o.info.steps; st += 2){ const ly = o.base - st*LG; ctx.beginPath(); ctx.moveTo(nx-ledger, ly); ctx.lineTo(nx+ledger, ly); ctx.stroke(); }
      ctx.fillStyle = col.ask ? "#c8641e" : noteColor;
      ctx.beginPath(); ctx.ellipse(nx, o.y, NRX, NRY, Math.PI*-0.1, 0, Math.PI*2); ctx.fill();
      if (NOTE_NAMES[o.m % 12].includes("#")){ ctx.font = "bold 13px serif"; ctx.fillText("♯", nx - 17, o.y + 5); }
    });
    // names underneath, highest first, so they read like the chord
    ctx.fillStyle = "#555"; ctx.font = "10px -apple-system, BlinkMacSystemFont, sans-serif"; ctx.textAlign = "center";
    const names = notes.map(o => col.ask ? "?" : prettyName(o.m)).reverse();
    const shown = names.length > MAX_NAMES ? names.slice(0, MAX_NAMES - 1).concat("+" + (names.length - MAX_NAMES + 1)) : names;
    shown.forEach((t, k) => ctx.fillText(t, x + 3, NAME_TOP + k*NAME_LINE));
    ctx.textAlign = "start";
  });
  ctx.globalAlpha = 1;

  document.getElementById("currentNoteDisp").textContent =
    n ? trail[n-1].notes.slice().sort((a, b) => a - b).map(prettyName).join("  ") : "—";
}

resizeStaff();
