// ── Timer: a stopwatch, or a countdown ──────────────────────────────────────────
// Both can run at once; the buttons at the top choose which one you see.
// Times come from performance.now(), so they stay accurate even if the screen
// redraws slowly or the tab is in the background.

/* ---------- Stopwatch ---------- */
let swRunning=false, swStartAt=0, swElapsed=0, swRaf=null, swLaps=[], swLastLap=0;

function swNow(){ return swRunning ? swElapsed + (performance.now() - swStartAt) : swElapsed; }

function fmtTime(ms){
  const p=n=>String(n).padStart(2,"0");
  const cs=Math.floor(ms/10)%100, s=Math.floor(ms/1000)%60, m=Math.floor(ms/60000)%60, h=Math.floor(ms/3600000);
  return (h ? h+":"+p(m) : p(m)) + ":" + p(s) + "." + p(cs);
}

function swRender(){
  document.getElementById("swDisplay").textContent=fmtTime(swNow());
  timerStatus();
  if(swRunning) swRaf=requestAnimationFrame(swRender);
}

function swToggle(){
  const startBtn=document.getElementById("swStartBtn"), lapBtn=document.getElementById("swLapBtn");
  if(!swRunning){
    swRunning=true; swStartAt=performance.now();
    startBtn.textContent="Stop"; startBtn.classList.add("active");
    lapBtn.textContent="Lap"; lapBtn.disabled=false;
    swRender();
  } else {
    swElapsed+=performance.now()-swStartAt; swRunning=false;
    cancelAnimationFrame(swRaf);
    startBtn.textContent="Start"; startBtn.classList.remove("active");
    lapBtn.textContent="Reset";
    swRender();
  }
}

function swLapOrReset(){
  const lapBtn=document.getElementById("swLapBtn");
  if(swRunning){
    const t=swNow();
    swLaps.unshift({n:swLaps.length+1, split:t-swLastLap, total:t});
    swLastLap=t;
  } else {
    swElapsed=0; swLastLap=0; swLaps=[];
    lapBtn.textContent="Lap"; lapBtn.disabled=true;
    swRender();
  }
  document.getElementById("swLaps").innerHTML=swLaps.map(l=>
    `<li><span>Lap ${l.n}</span><span>${fmtTime(l.split)}</span><span class="sw-total">${fmtTime(l.total)}</span></li>`
  ).join("");
}

/* ---------- Countdown ----------
   Set the minutes with − and +, then Start. At zero it plays a soft three-note chime.
   The screen stays awake while it counts down (js/awake.js), so the chime comes on time. */
let cdSet=5*60000, cdLeft=cdSet, cdRunning=false, cdEndAt=0, cdRaf=0, cdTimeout=0;

function fmtClock(ms){   // minutes and seconds, rounded up, so a countdown shows 05:00, 04:59 … 00:01, 00:00
  const s=Math.ceil(Math.max(0, ms)/1000);
  return String(Math.floor(s/60)).padStart(2,"0") + ":" + String(s%60).padStart(2,"0");
}
function cdRemaining(){ return cdRunning ? Math.max(0, cdEndAt - performance.now()) : cdLeft; }

function cdRender(){
  document.getElementById("cdDisplay").textContent=fmtClock(cdRemaining());
  timerStatus();
  if(cdRunning) cdRaf=requestAnimationFrame(cdRender);
}
function cdButtons(){
  const start=document.getElementById("cdStartBtn");
  start.textContent = cdRunning ? "Pause" : (cdLeft>0 && cdLeft<cdSet ? "Resume" : "Start");
  start.classList.toggle("active", cdRunning);
  document.getElementById("cdResetBtn").disabled = !cdRunning && cdLeft===cdSet;
  document.getElementById("cdMinus").disabled = cdRunning || cdSet<=60000;
  document.getElementById("cdPlus").disabled = cdRunning || cdSet>=99*60000;
}

function cdAdjust(minutes){
  if(cdRunning) return;
  cdSet=Math.min(99*60000, Math.max(60000, cdSet + minutes*60000));
  cdLeft=cdSet;
  cdMessage("");
  cdButtons(); cdRender();
}
function cdToggle(){
  if(!cdRunning){
    if(cdLeft<=0) cdLeft=cdSet;
    wakeSound();                          // starts the sound now, inside the tap, so the chime can play later
    cdRunning=true; cdEndAt=performance.now()+cdLeft;
    cdTimeout=setTimeout(cdFinish, cdLeft);
    stayAwake("countdown", true);
    cdMessage("");
  } else {
    cdLeft=cdRemaining(); cdRunning=false;
    clearTimeout(cdTimeout); cancelAnimationFrame(cdRaf);
    stayAwake("countdown", false);
  }
  cdButtons(); cdRender();
}
function cdFinish(){
  if(!cdRunning) return;
  cdRunning=false; cdLeft=0;
  clearTimeout(cdTimeout); cancelAnimationFrame(cdRaf);
  stayAwake("countdown", false);
  chime();                                // js/sound.js
  cdMessage("Time’s up!");
  cdButtons(); cdRender();
}
function cdReset(){
  if(cdRunning){ cdRunning=false; clearTimeout(cdTimeout); cancelAnimationFrame(cdRaf); stayAwake("countdown", false); }
  cdLeft=cdSet;
  cdMessage("");
  cdButtons(); cdRender();
}
function cdMessage(text){
  document.getElementById("cdMsg").textContent=text;
  document.getElementById("cdDisplay").classList.toggle("done", !!text);
}
// a phone may hold back timers while the page is in the background: finish on return if it's past time
document.addEventListener("visibilitychange", ()=>{ if(!document.hidden && cdRunning && performance.now()>=cdEndAt) cdFinish(); });

/* ---------- Which one you see, and the status in the folded heading ---------- */
function timerMode(mode){
  const sw = mode !== "cd";
  document.getElementById("swPanel").hidden=!sw;
  document.getElementById("cdPanel").hidden=sw;
  document.getElementById("tmModeSw").setAttribute("aria-pressed", String(sw));
  document.getElementById("tmModeCd").setAttribute("aria-pressed", String(!sw));
  try { localStorage.setItem("mt-timer-mode", sw ? "sw" : "cd"); } catch(e) {}
}

let lastTimerStatus="";
function timerStatus(){
  const parts=[];
  if(swRunning) parts.push("Stopwatch " + fmtClock(Math.floor(swNow()/1000)*1000));
  if(cdRunning) parts.push(fmtClock(cdRemaining()) + " left");
  const text=parts.join(" · ");
  if(text!==lastTimerStatus){ lastTimerStatus=text; setFoldStatus("timer", text); }
}

(function(){
  let mode="sw";
  try { mode=localStorage.getItem("mt-timer-mode")==="cd" ? "cd" : "sw"; } catch(e) {}
  timerMode(mode);
  cdButtons(); cdRender();
})();
