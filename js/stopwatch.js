// ── Stopwatch ─────────────────────────────────────────────────────────────────
// Time comes from performance.now(), so it stays accurate even if the screen
// redraws slowly or the tab is in the background.
let swRunning=false, swStartAt=0, swElapsed=0, swRaf=null, swLaps=[], swLastLap=0;

function swNow(){ return swRunning ? swElapsed + (performance.now() - swStartAt) : swElapsed; }

function fmtTime(ms){
  const p=n=>String(n).padStart(2,"0");
  const cs=Math.floor(ms/10)%100, s=Math.floor(ms/1000)%60, m=Math.floor(ms/60000)%60, h=Math.floor(ms/3600000);
  return (h ? h+":"+p(m) : p(m)) + ":" + p(s) + "." + p(cs);
}

function swRender(){
  document.getElementById("swDisplay").textContent=fmtTime(swNow());
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
