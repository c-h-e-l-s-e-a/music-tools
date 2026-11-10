/* ---------- Fold-away sections ----------
   Tap a section's heading to fold it away and save space; tap again to open it.
   A folded tool keeps running (the metronome keeps ticking, the timer keeps counting), and its heading
   shows a short status such as "Playing · 80 bpm". Which sections are folded is remembered on this device. */
const foldSections = {};               // name -> { section, button, body, status }

function setFoldStatus(name, text) {
  const f = foldSections[name];
  if (f) f.status.textContent = text;
}

(function () {
  let folded = [];
  try { folded = JSON.parse(localStorage.getItem('mt-folded') || '[]'); } catch (e) {}
  if (!Array.isArray(folded)) folded = [];

  function save() {
    const names = Object.keys(foldSections).filter(function (n) { return foldSections[n].section.classList.contains('folded'); });
    try { localStorage.setItem('mt-folded', JSON.stringify(names)); } catch (e) {}
  }

  function setFolded(name, fold) {
    const f = foldSections[name];
    f.section.classList.toggle('folded', fold);
    f.body.hidden = fold;
    f.button.setAttribute('aria-expanded', String(!fold));
    if (!fold && name === 'staff' && typeof resizeStaff === 'function') resizeStaff();   // the staff fits itself to its width when it opens
  }

  document.querySelectorAll('[data-fold]').forEach(function (section) {
    const name = section.getAttribute('data-fold');
    const button = section.querySelector('.sec-toggle');
    foldSections[name] = { section: section, button: button, body: section.querySelector('.sec-body'), status: section.querySelector('.sec-status') };
    button.addEventListener('click', function () {
      setFolded(name, !section.classList.contains('folded'));
      save();
    });
    if (folded.indexOf(name) >= 0) setFolded(name, true);
  });
})();
