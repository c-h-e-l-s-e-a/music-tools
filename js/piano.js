/* ---------- Keyboard: every note in the standard vocal range (E2 to C6), the voice-range bars and the sound ----------
   Loaded right after js/sound.js: the other sections use its note helpers. */
const NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const BLACK = new Set(["C#","D#","F#","G#","A#"]);
const DIATONIC = ["C","D","E","F","G","A","B"];

function noteToMidi(s){ const m=s.match(/^([A-G]#?)(\d)$/); return(parseInt(m[2])+1)*12+NOTE_NAMES.indexOf(m[1]); }
function midiToStr(midi){ return NOTE_NAMES[midi%12]+(Math.floor(midi/12)-1); }
function diatonicPos(midi){ const oct=Math.floor(midi/12)-1; const n=NOTE_NAMES[midi%12]; const nat=n.includes("#")?NOTE_NAMES[(midi%12)-1]:n; return oct*7+DIATONIC.indexOf(nat); }

const VOICE_RANGES = [
  { name:"Bass",      low:"E2", high:"E4", color:"#534AB7" },
  { name:"Baritone",  low:"G2", high:"G4", color:"#378ADD" },
  { name:"Tenor",     low:"C3", high:"C5", color:"#1D9E75" },
  { name:"Contralto", low:"F3", high:"F5", color:"#D85A30" },
  { name:"Mezzo",     low:"A3", high:"A5", color:"#EF9F27" },
  { name:"Soprano",   low:"C4", high:"C6", color:"#D4537E" },
];

const WW=32, WH=110, BW=20, BH=68;
const START=noteToMidi("E2"), END=noteToMidi("C6");
let whiteKeys=[];
const keyEls={};   // each key's element by note number, so the tuner can light up the key it hears


function buildPiano(){
  const wrap=document.getElementById("pianoWrap");
  wrap.innerHTML=""; whiteKeys=[];
  const whites=[], blacks=[];
  for(let m=START;m<=END;m++){ if(!BLACK.has(NOTE_NAMES[m%12])) whites.push(m); else blacks.push(m); }
  const BAND_H=VOICE_RANGES.length*9+6;
  wrap.style.width=(whites.length*WW)+"px";
  wrap.style.height=(BAND_H+WH+24)+"px";
  wrap.style.position="relative";

  whites.forEach((m,wi)=>{
    const el=document.createElement("div");
    el.className="wkey";
    el.style.cssText=`left:${wi*WW}px;width:${WW}px;height:${WH}px;top:${BAND_H}px;`;
    const note=NOTE_NAMES[m%12], oct=Math.floor(m/12)-1;
    el.innerHTML=`<span class="nlabel">${note}${oct}</span>`;
    addKeyListeners(el, m);
    keyEls[m]=el;
    wrap.appendChild(el);
    whiteKeys.push({midi:m,wi,el});
  });

  blacks.forEach(m=>{
    const prev=whiteKeys.find(k=>k.midi===m-1);
    if(!prev) return;
    const el=document.createElement("div");
    el.className="bkey";
    el.style.cssText=`left:${(prev.wi+1)*WW-BW/2-1}px;width:${BW}px;height:${BH}px;top:${BAND_H}px;`;
    const note=NOTE_NAMES[m%12], oct=Math.floor(m/12)-1;
    el.innerHTML=`<span class="nlabel">${note.replace("#","&#9839;")}${oct}</span>`;
    addKeyListeners(el, m);
    keyEls[m]=el;
    wrap.appendChild(el);
  });

  VOICE_RANGES.forEach((v,i)=>{
    const lm=noteToMidi(v.low), hm=noteToMidi(v.high);
    const lw=whiteKeys.find(k=>k.midi===lm)||whiteKeys.find(k=>k.midi===lm+1);
    const hw=whiteKeys.find(k=>k.midi===hm)||whiteKeys.find(k=>k.midi===hm+1);
    if(!lw||!hw) return;
    const bar=document.createElement("div");
    bar.style.cssText=`position:absolute;left:${lw.wi*WW}px;top:${i*9}px;width:${(hw.wi-lw.wi+1)*WW}px;height:8px;background:${v.color};opacity:0.65;border-radius:2px;pointer-events:none;`;
    wrap.appendChild(bar);
  });

  document.getElementById("legend").innerHTML=VOICE_RANGES.map(v=>
    `<div class="legend-item"><div class="legend-sw" style="background:${v.color}"></div>${v.name} (${v.low}&#8211;${v.high})</div>`
  ).join("");
}

/* ---------- Playing ----------
   A note sounds while its key is held, and several keys can be held at once (a chord).
   On a touch screen, a finger that slides sideways scrolls the keyboard instead of playing:
   a note starts once the finger has stayed put for a moment (SETTLE), or straight away when it lifts.
   On a computer, the mouse plays one key at a time, and the letter keys play like a piano (see below). */
const SETTLE = 60;            // ms a finger must stay still before its note starts
const MOVE = 8;               // px a finger may drift before it counts as scrolling
const holding = new Map();    // note number -> { letGo, count } for every note sounding right now

function pressKey(midi){
  const el = keyEls[midi];
  if (!el) return;
  const h = holding.get(midi);
  if (h) h.letGo();                                   // pressing a sounding key again restarts it
  wakeSound();                                        // makes sure the sound engine is running (js/sound.js)
  const letGo = noteOn(440 * Math.pow(2, (midi - 69) / 12));
  holding.set(midi, { letGo: letGo, count: (h ? h.count : 0) + 1 });
  el.classList.add("pressed");
  staffPress(midi);                                   // onto the staff's trail (js/staff.js)
}
function releaseKey(midi){
  const h = holding.get(midi);
  if (!h) return;
  staffRelease(midi);                                 // every press has its own release on the staff
  if (--h.count > 0) return;                          // another finger or key is still holding it
  holding.delete(midi);
  h.letGo();
  keyEls[midi].classList.remove("pressed");
}

// a press that turned out to be a swipe: stop it at once and take it back off the staff
function cancelKey(midi){
  const h = holding.get(midi);
  if (!h) return;
  staffCancel(midi);
  if (--h.count > 0) return;
  holding.delete(midi);
  h.letGo(true);
  keyEls[midi].classList.remove("pressed");
}

const touches = new Map();    // touch id -> { midi, x, y, on, moved, timer }
function touchIsSwipe(s){
  s.moved = true;
  clearTimeout(s.timer);
  if (s.on){ s.on = false; cancelKey(s.midi); }
}
// phones can hold back the first small movements of a finger; if the keyboard scrolls, it was a swipe
document.getElementById("pianoScroll").addEventListener("scroll", () => {
  touches.forEach(s => { if (!s.moved) touchIsSwipe(s); });
}, { passive: true });
function addKeyListeners(el, midi) {
  el.addEventListener("mousedown", e => {
    if (e.button !== 0) return;
    e.preventDefault();                               // keeps the click from selecting text
    pressKey(midi);
    const up = () => { releaseKey(midi); window.removeEventListener("mouseup", up); };
    window.addEventListener("mouseup", up);
  });

  el.addEventListener("touchstart", e => {
    Array.prototype.forEach.call(e.changedTouches, t => {
      const s = { midi: midi, x: t.clientX, y: t.clientY, on: false, moved: false, timer: 0 };
      s.timer = setTimeout(() => { if (!s.moved) { s.on = true; pressKey(midi); } }, SETTLE);
      touches.set(t.identifier, s);
    });
  }, { passive: true });

  el.addEventListener("touchmove", e => {
    Array.prototype.forEach.call(e.changedTouches, t => {
      const s = touches.get(t.identifier);
      if (!s || s.moved) return;
      if (Math.abs(t.clientX - s.x) > MOVE || Math.abs(t.clientY - s.y) > MOVE) touchIsSwipe(s);   // it's a scroll, not a note
    });
  }, { passive: true });

  const end = e => {
    let tapped = false;
    Array.prototype.forEach.call(e.changedTouches, t => {
      const s = touches.get(t.identifier);
      if (!s) return;
      touches.delete(t.identifier);
      clearTimeout(s.timer);
      if (s.moved) return;
      tapped = true;
      if (!s.on) pressKey(s.midi);                    // a quick tap: play it, then let go
      releaseKey(s.midi);
    });
    if (tapped && e.cancelable) e.preventDefault();   // stops the browser also sending a mouse click
  };
  el.addEventListener("touchend", end, { passive: false });
  el.addEventListener("touchcancel", e => {
    Array.prototype.forEach.call(e.changedTouches, t => {
      const s = touches.get(t.identifier);
      if (!s) return;
      touches.delete(t.identifier);
      clearTimeout(s.timer);
      if (s.on) releaseKey(s.midi);
    });
  }, { passive: true });
}

/* ---------- Playing from a computer keyboard ----------
   The middle row is the white keys and the row above is the black keys, like a piano:
   A W S E D F T G Y H U J K O L P ;  =  C C♯ D D♯ E F F♯ G G♯ A A♯ B C C♯ D D♯ E
   Z and X move the whole thing down or up an octave. */
const LETTERS = { a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11, k: 12, o: 13, l: 14, p: 15, ";": 16 };
let baseC = 60;               // C4
const letterHeld = new Map(); // letter -> the note it started
function typingSomewhere(){
  const a = document.activeElement;
  return a && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName) && a.type !== "range";
}
document.addEventListener("keydown", e => {
  if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || typingSomewhere()) return;
  const k = e.key.toLowerCase();
  if (k === "z" || k === "x") {
    baseC = Math.min(72, Math.max(36, baseC + (k === "x" ? 12 : -12)));
    showKeyboardHint();
    return;
  }
  if (!(k in LETTERS) || letterHeld.has(k)) return;
  const midi = baseC + LETTERS[k];
  if (midi < START || midi > END) return;
  e.preventDefault();
  letterHeld.set(k, midi);
  pressKey(midi);
  bringKeyIntoView(keyEls[midi]);
});
document.addEventListener("keyup", e => {
  const k = e.key.toLowerCase();
  if (!letterHeld.has(k)) return;
  releaseKey(letterHeld.get(k));
  letterHeld.delete(k);
});
window.addEventListener("blur", () => {               // switching windows mid-note: let everything go
  letterHeld.forEach(m => releaseKey(m));
  letterHeld.clear();
});

/* the hint under the keyboard, shown only on computers with a mouse or trackpad */
function showKeyboardHint(){
  const hint = document.getElementById("kbdHint");
  if (!hint || !window.matchMedia || !matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  hint.hidden = false;
  document.getElementById("kbdFrom").textContent = midiToStr(baseC);
}

/* scroll the keyboard so a key is in view */
function bringKeyIntoView(el){
  const sc = document.getElementById("pianoScroll");
  const left = el.offsetLeft, right = left + el.offsetWidth, view = sc.scrollLeft, w = sc.clientWidth;
  if (left < view + 8 || right > view + w - 8) sc.scrollTo({ left: left - (w - el.offsetWidth) / 2, behavior: "smooth" });
}

buildPiano();
showKeyboardHint();
