/* ---------- Keyboard: every note in the standard vocal range (E2 to C6), the voice-range bars and the sound ----------
   Loaded first: the other sections use its note helpers and sound. */
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
let whiteKeys=[], AC=null;
const keyEls={};   // each key's element by note number, so the tuner can light up the key it hears

function getAC(){ if(!AC) AC=new(window.AudioContext||window.webkitAudioContext)(); if(AC.state==='suspended') AC.resume(); return AC; }
function playFreq(freq){ const ac=getAC(); const osc=ac.createOscillator(); const env=ac.createGain(); osc.connect(env); env.connect(ac.destination); osc.type='triangle'; osc.frequency.value=freq; const t=ac.currentTime; env.gain.setValueAtTime(0.4,t); env.gain.exponentialRampToValueAtTime(0.001,t+1.5); osc.start(t); osc.stop(t+1.5); }

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

// Touch handling: a tap plays the note; a swipe (finger moves > 6px) scrolls instead
function addKeyListeners(el, midi) {
  el.addEventListener("mousedown", () => onKey(midi, el));

  let touchStartX = 0, touchStartY = 0, moved = false;
  el.addEventListener("touchstart", e => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    moved = false;
  }, {passive: true});

  el.addEventListener("touchmove", e => {
    const dx = Math.abs(e.touches[0].clientX - touchStartX);
    const dy = Math.abs(e.touches[0].clientY - touchStartY);
    if (dx > 6 || dy > 6) moved = true;
  }, {passive: true});

  el.addEventListener("touchcancel", () => { moved = true; }, {passive: true});

  el.addEventListener("touchend", e => {
    if (!moved) {
      e.preventDefault();
      onKey(midi, el);
    }
  }, {passive: false});
}

function onKey(midi, el){
  playFreq(440*Math.pow(2,(midi-69)/12));
  drawStaff(midi);
  clearStaffAfter(1500);   // the note leaves the staff as its sound fades
  el.classList.add("pressed");
  setTimeout(()=>el.classList.remove("pressed"),120);
}

buildPiano();
