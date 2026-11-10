/* ---------- Keep the screen awake while the metronome, tuner or countdown is running ----------
   Otherwise phones dim and lock in the middle of practice. Browsers let a page ask for this
   (Safari since iOS 16.4); the request ends by itself when you leave the page, so it's asked
   for again when you come back. Browsers that can't do it simply carry on as before. */
const awakeFor = new Set();            // which tools want the screen on: 'metronome', 'tuner', 'countdown'
let wakeLock = null, wakeAsking = false;

function stayAwake(who, on) {
  if (on) awakeFor.add(who); else awakeFor.delete(who);
  syncAwake();
}

function syncAwake() {
  if (!('wakeLock' in navigator)) return;
  if (awakeFor.size && !wakeLock && !wakeAsking && document.visibilityState === 'visible') {
    wakeAsking = true;
    navigator.wakeLock.request('screen').then(function (lock) {
      wakeAsking = false;
      wakeLock = lock;
      lock.addEventListener('release', function () { if (wakeLock === lock) wakeLock = null; });
      if (!awakeFor.size) syncAwake();   // everything stopped while we were asking
    }).catch(function () { wakeAsking = false; });
  } else if (!awakeFor.size && wakeLock) {
    const lock = wakeLock;
    wakeLock = null;
    lock.release().catch(function () {});
  }
}

document.addEventListener('visibilitychange', syncAwake);
