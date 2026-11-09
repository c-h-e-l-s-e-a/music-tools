// ── Metronome ─────────────────────────────────────────────────────────────────
let metroOn=false, bpm=80, timeSig=4, beatIdx=0, nextBeatTime=0, metroTimer=null;

function setBpm(v){ bpm=Math.min(208,Math.max(40,v)); document.getElementById("bpmVal").textContent=bpm; document.getElementById("bpmSlider").value=bpm; }
function adjBpm(d){ setBpm(bpm+d); }
function updateTs(){ timeSig=parseInt(document.getElementById("tsSelect").value); beatIdx=0; buildBeats(); }

function buildBeats(){
  const row=document.getElementById("beatsRow"); row.innerHTML="";
  const n=timeSig===6?6:timeSig;
  for(let i=0;i<n;i++){ const d=document.createElement("div"); d.className="beat-dot"; d.id="bd"+i; row.appendChild(d); }
}

function toggleMetro(){
  metroOn=!metroOn;
  const btn=document.getElementById("playBtn");
  const ac=wakeSound();
  if(metroOn){ btn.classList.add("active"); btn.innerHTML="&#9646;&#9646; Stop"; beatIdx=0; nextBeatTime=ac.currentTime; metroTimer=setInterval(scheduler,25); }
  else { btn.classList.remove("active"); btn.innerHTML="&#9654; Start"; clearInterval(metroTimer); const n=timeSig===6?6:timeSig; for(let i=0;i<n;i++){ const d=document.getElementById("bd"+i); if(d) d.classList.remove("lit"); } }
}

// a fresh sound engine has its own clock, so the next beat is timed from that
onFreshSound.push(ac=>{ if(metroOn) nextBeatTime=ac.currentTime+0.05; });

function scheduler(){
  const ac=getAC(), n=timeSig===6?6:timeSig, spb=timeSig===6?(60/bpm)/1.5:(60/bpm);
  while(nextBeatTime<ac.currentTime+0.1){ scheduleClick(beatIdx,nextBeatTime,n); nextBeatTime+=spb; beatIdx=(beatIdx+1)%n; }
}

function scheduleClick(beat,time,n){
  const ac=getAC(), isAcc=beat===0 && n>1;   // "Steady" (n=1): every click the same, no accent
  playClick(time, isAcc);                     // the chosen metronome sound (js/sound.js)
  const delay=Math.max(0,(time-ac.currentTime)*1000);
  setTimeout(()=>{ const n2=timeSig===6?6:timeSig; for(let i=0;i<n2;i++){ const d=document.getElementById("bd"+i); if(d) d.classList.remove("lit"); } const d=document.getElementById("bd"+beat); if(d) d.classList.add("lit");
    // With a single dot, flash it briefly so each beat is visible
    if(n2===1 && d) setTimeout(()=>d.classList.remove("lit"), 120);
  }, delay);
}

buildBeats();
