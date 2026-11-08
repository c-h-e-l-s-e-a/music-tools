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

// Layout: treble staff on top, bass staff below, middle C exactly halfway between.
const LG = 8;                                  // pixels per diatonic step (half a space)
const TREBLE_TOP    = 48;                      // room above for C6 (two ledger lines)
const TREBLE_BOTTOM = TREBLE_TOP + 8*LG;       // E4 line
const BASS_TOP      = TREBLE_BOTTOM + 4*LG;    // A3 line; middle C sits 2 steps from each staff
const BASS_BOTTOM   = BASS_TOP + 8*LG;         // G2 line
const STAFF_H       = BASS_BOTTOM + 4*LG;      // room below for E2 (one ledger line)

function resizeStaff(){
  const canvas=document.getElementById("staffCanvas");
  canvas.width=Math.max(300, canvas.parentElement.clientWidth-28);
  canvas.height=STAFF_H;
  drawStaff(lastMidi);
}
window.addEventListener("resize", resizeStaff);

let lastMidi=null, staffTimer=0;

// The note doesn't stay on the staff forever: it clears after a moment, along with its name above the staff.
function clearStaff(){
  clearTimeout(staffTimer);
  lastMidi=null;
  drawStaff(null);
  document.getElementById("currentNoteDisp").textContent="—";
}
function clearStaffAfter(ms){ clearTimeout(staffTimer); staffTimer=setTimeout(clearStaff, ms); }

function drawStaff(midi){
  if(midi!==null && midi!==undefined){
    lastMidi=midi;
    clearTimeout(staffTimer);   // a new note cancels any clearing that was waiting
    document.getElementById("currentNoteDisp").textContent=midiToStr(midi);
  }
  const canvas=document.getElementById("staffCanvas");
  const W=canvas.width, H=canvas.height;
  const ctx=canvas.getContext("2d");
  ctx.clearRect(0,0,W,H);
  const leftMar=56, rightMar=W-20;
  const lineColor="rgba(0,0,0,0.22)", noteColor="#185FA5", clefColor="rgba(0,0,0,0.38)";

  function drawStaffLines(yBottom){
    ctx.strokeStyle=lineColor; ctx.lineWidth=1;
    for(let i=0;i<5;i++){ const y=yBottom-i*2*LG; ctx.beginPath(); ctx.moveTo(leftMar,y); ctx.lineTo(rightMar,y); ctx.stroke(); }
  }
  drawStaffLines(TREBLE_BOTTOM);
  drawStaffLines(BASS_BOTTOM);

  // Clefs
  ctx.fillStyle=clefColor;
  ctx.font="48px serif";
  ctx.fillText("𝄞", 10, TREBLE_BOTTOM-2*LG+2);
  ctx.font="40px serif";
  ctx.fillText("𝄢", 12, BASS_TOP+5*LG+2);

  // Barlines joining both staves
  ctx.strokeStyle=lineColor; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(leftMar,TREBLE_TOP); ctx.lineTo(leftMar,BASS_BOTTOM); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(rightMar,TREBLE_TOP); ctx.lineTo(rightMar,BASS_BOTTOM); ctx.stroke();

  if(midi===null || midi===undefined) return;

  const info=staffInfo(midi);
  const isSharp=NOTE_NAMES[midi%12].includes("#");
  const yBase=info.clef==="treble"?TREBLE_BOTTOM:BASS_BOTTOM;
  const NX=leftMar+(rightMar-leftMar)/2;
  const NY=yBase-info.steps*LG;
  const NRX=6, NRY=4.5;
  const ledgerW=NRX*2.4;

  // Ledger lines below staff
  ctx.strokeStyle="rgba(0,0,0,0.45)"; ctx.lineWidth=1.2;
  if(info.steps<0){
    for(let s=-2;s>=info.steps;s-=2){
      const ly=yBase-s*LG;
      ctx.beginPath(); ctx.moveTo(NX-ledgerW,ly); ctx.lineTo(NX+ledgerW,ly); ctx.stroke();
    }
  }
  // Ledger lines above staff (above step 8)
  if(info.steps>8){
    for(let s=10;s<=info.steps;s+=2){
      const ly=yBase-s*LG;
      ctx.beginPath(); ctx.moveTo(NX-ledgerW,ly); ctx.lineTo(NX+ledgerW,ly); ctx.stroke();
    }
  }

  // Note head
  ctx.fillStyle=noteColor;
  ctx.beginPath(); ctx.ellipse(NX,NY,NRX,NRY,Math.PI*-0.1,0,Math.PI*2); ctx.fill();

  if(isSharp){ ctx.fillStyle=noteColor; ctx.font="bold 14px serif"; ctx.fillText("♯",NX-20,NY+5); }

  ctx.fillStyle="#888"; ctx.font="12px -apple-system,sans-serif";
  ctx.fillText(midiToStr(midi), NX+NRX+8, NY+4);
}

resizeStaff();
