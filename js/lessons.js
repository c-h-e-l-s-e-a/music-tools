/* ---------- Theory lessons: how they work ----------
   The Lessons button opens a list of short lessons. Each lesson has a few steps, and each step has something
   to try on the keyboard, the staff or the metronome. At the end there's an optional practice round.
   The lessons themselves (their words, what to play and the practice questions) are in js/lesson-list.js.
   Which lessons you've finished is remembered on this device.

   Each screen has its own web address, so a phone's Back gesture goes back a screen:
     #lessons            the list of lessons
     #lesson/3           lesson 3
     #lesson/3/practice  its practice round
     #lesson/3/done      the "lesson done" screen
   Anything else is the tools page. */

const LESSONS = [];   // filled in by js/lesson-list.js
let go = function () {}, lessonsReady = function () {};   // go("#lessons") opens a screen; both are set up below

/* ---------- Note helpers for the lessons ---------- */
/* "C4", "F♯4" or "B♭4" (or with # and b) -> note number */
function N(name) {
  const m = /^([A-G])([♯#♭b]?)(\d)$/.exec(name);
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]];
  const shift = m[2] === '♯' || m[2] === '#' ? 1 : m[2] === '♭' || m[2] === 'b' ? -1 : 0;
  return (parseInt(m[3], 10) + 1) * 12 + base + shift;
}
function pc(m) { return ((m % 12) + 12) % 12; }        // which note, ignoring the octave: 0 = C … 11 = B
function letter(m) { return prettyName(m).replace(/\d/g, ''); }   // "C♯"
const ORDINAL = ['first', 'second', 'third', 'fourth', 'fifth'];

/* where a note sits on the grand staff, in words */
function whereOnStaff(m) {
  if (m === 60) return 'middle C, on its own short line between the staffs';
  const info = staffInfo(m), s = info.steps, which = info.clef + ' staff';
  if (s >= 0 && s <= 8) return s % 2 === 0 ? 'on the ' + ORDINAL[s / 2] + ' line of the ' + which : 'in the ' + ORDINAL[(s - 1) / 2] + ' space of the ' + which;
  if (s === -1) return 'just below the ' + which;
  if (s === 9) return 'just above the ' + which;
  return (s < 0 ? 'below' : 'above') + ' the ' + which + ', on short extra lines';
}

/* the shapes of notes, for the rhythm lessons: whole, half, quarter, eighth */
function noteIcon(kind, size) {
  size = size || 40;
  const hollow = kind === 'whole' || kind === 'half', stem = kind !== 'whole';
  const label = { whole: 'whole note', half: 'half note', quarter: 'quarter note', eighth: 'eighth note' }[kind];
  return '<svg width="' + (size * 0.55) + '" height="' + size + '" viewBox="0 0 22 40" role="img" aria-label="' + label + '">' +
    '<ellipse cx="9" cy="32" rx="' + (kind === 'whole' ? 7.2 : 6.2) + '" ry="4.6" transform="rotate(-20 9 32)" ' +
    (hollow ? 'fill="none" stroke="currentColor" stroke-width="2"' : 'fill="currentColor"') + '/>' +
    (stem ? '<line x1="14.6" y1="31" x2="14.6" y2="4" stroke="currentColor" stroke-width="1.8"/>' : '') +
    (kind === 'eighth' ? '<path d="M14.6 4c0.6 5 6.4 7 5.4 15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>' : '') +
    '</svg>';
}

/* play notes for a question: one after another, or together when gap is 0 */
function playNotes(list, gap, hold) {
  wakeSound();
  list.forEach(function (m, i) {
    setTimeout(function () {
      const off = noteOn(440 * Math.pow(2, (m - 69) / 12));
      setTimeout(off, hold || 500);
    }, i * gap);
  });
}
/* metronome clicks for a question: n clicks, `spb` seconds apart, the first of every `group` higher */
function playClicks(n, spb, group) {
  const ac = wakeSound(), t0 = ac.currentTime + 0.15;
  for (let i = 0; i < n; i++) playClick(t0 + i * spb, group > 1 && i % group === 0);
}
/* how far apart the metronome's clicks are now, in ms */
function clickMs() { return timeSig === 6 ? 40000 / bpm : 60000 / bpm; }

/* a key lights green for a moment when it's the right one */
function flashKey(m) {
  const el = keyEls[m];
  if (!el) return;
  el.classList.add('ls-good');
  setTimeout(function () { el.classList.remove('ls-good'); }, 650);
}
function showKeys(list) {
  document.querySelectorAll('.ls-show').forEach(function (el) { el.classList.remove('ls-show'); });
  (list || []).forEach(function (m) { if (keyEls[m]) keyEls[m].classList.add('ls-show'); });
}
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
/* pick from a list, not the same as last time */
function pickNew(list, last) {
  const from = list.length > 1 ? list.filter(function (x) { return x !== last; }) : list;
  return from[Math.floor(Math.random() * from.length)];
}

/* ---------- "Try it" tasks ----------
   Each step's task is made fresh each time the step opens. A task has:
     items   what to do, shown as chips (notes to play) or a checklist (metronome settings)
     key(what, note, time)   called for every key you press ("down") or let go ("up")
     tick()  called a few times a second (for things like the metronome)
     msg, good   a line of feedback, and whether it's good news
     done    true once everything's done
     focus   the key to bring into view on the keyboard */

/* play these notes. list: "C4" or { n: "F♯4", label: "a whole step up from E4" } (the label shows until it's played).
   opts.anyOrder: in any order · opts.anyOctave: any C counts for "C4" · opts.done: the message at the end */
function play(list, opts) {
  opts = opts || {};
  return function () {
    const items = list.map(function (x) {
      return typeof x === 'string'
        ? { note: N(x), label: x, shows: x, hidden: false, done: false }
        : { note: N(x.n), label: x.label, shows: x.shows || x.n, hidden: true, done: false };
    });
    const t = { items: items, style: 'chips', ordered: !opts.anyOrder, msg: '', good: false, done: false, i: 0, focus: items[0].note };
    const matches = function (it, m) { return opts.anyOctave ? pc(it.note) === pc(m) : it.note === m; };
    t.key = function (what, m) {
      if (what !== 'down' || t.done) return;
      if (opts.anyOrder) {
        const it = items.find(function (x) { return !x.done && matches(x, m); });
        if (it) {
          it.done = true; flashKey(m);
          const left = items.filter(function (x) { return !x.done; }).length;
          t.msg = left ? 'Yes, that’s ' + prettyName(m) + '. ' + left + ' more to go.' : ''; t.good = true;
        } else if (items.some(function (x) { return matches(x, m); })) {
          t.msg = 'You’ve found that one. ' + (opts.hint || 'Find the others.'); t.good = false;
        } else {
          t.msg = 'That’s ' + prettyName(m) + '. ' + (opts.hint || 'Try another key.'); t.good = false;
        }
      } else {
        const it = items[t.i];
        if (matches(it, m)) {
          it.done = true; flashKey(m); t.i++;
          const nx = items[t.i];
          t.msg = 'Yes, that’s ' + it.shows + (it.hidden ? ': ' + it.label : '') + '.' + (nx ? (nx.hidden ? ' Now ' + nx.label + '.' : ' Now find ' + nx.label + '.') : '');
          t.good = true;
          if (nx) t.focus = nx.note;
        } else if (t.i > 0 && matches(items[t.i - 1], m)) {
          /* playing the last one again is fine */
        } else {
          t.msg = 'That’s ' + prettyName(m) + '. ' + (it.hidden ? 'Try again: ' + it.label + '.' : 'Find ' + it.label + '.');
          t.good = false;
        }
      }
      if (items.every(function (x) { return x.done; })) { t.done = true; t.msg = opts.done || 'Well done!'; t.good = true; }
    };
    return t;
  };
}

/* play chords, one after another: [{ label: "C major", notes: ["C4", "E4", "G4"] }, …]
   The notes count as together if they're held at once, or played quickly one after another
   (so it works with a mouse, which plays one key at a time). */
function chords(list, opts) {
  opts = opts || {};
  return function () {
    const items = list.map(function (c) { return { label: c.label, names: c.notes, notes: c.notes.map(N), done: false }; });
    const t = { items: items, style: 'chips', ordered: true, msg: '', good: false, done: false, i: 0, focus: items[0].notes[0] };
    let log = [];   // recent presses: { m, at }
    t.key = function (what, m, now) {
      if (what !== 'down' || t.done) return;
      log.push({ m: m, at: now });
      log = log.filter(function (p) { return now - p.at < 1500; });
      const it = items[t.i], want = it.notes.length;
      let got = Array.from(holding.keys());
      if (got.length < want) got = log.slice(-want).map(function (p) { return p.m; });
      got = got.filter(function (x, k, a) { return a.indexOf(x) === k; }).sort(function (a, b) { return a - b; });
      if (got.length < want) { t.msg = ''; return; }
      const same = got.length === want && it.notes.every(function (n) { return got.indexOf(n) >= 0; });
      if (same) {
        it.done = true; got.forEach(flashKey); t.i++; log = [];
        const nx = items[t.i];
        t.msg = 'Yes, that’s ' + it.label + '.' + (nx ? ' Now ' + nx.label + '.' : ''); t.good = true;
        if (nx) t.focus = nx.notes[0];
      } else {
        t.msg = 'That’s ' + got.map(prettyName).join(' ') + '. Try ' + it.names.join(', ') + ', together.'; t.good = false;
      }
      if (items.every(function (x) { return x.done; })) { t.done = true; t.msg = opts.done || 'Well done!'; t.good = true; }
    };
    return t;
  };
}

/* metronome settings to make: [{ label: "Metronome set to 3/4", test: () => timeSig === 3 }, …]
   Done once they're all true at the same time. */
function metroTask(checks, opts) {
  opts = opts || {};
  return function () {
    const items = checks.map(function (c) { return { label: c.label, test: c.test, done: false }; });
    const t = { items: items, style: 'checks', msg: '', good: false, done: false, focus: null };
    t.tick = function () {
      if (t.done) return;
      items.forEach(function (it) { it.done = !!it.test(); });
      if (items.every(function (it) { return it.done; })) { t.done = true; t.msg = opts.done || 'Well done!'; t.good = true; }
    };
    t.tick();
    return t;
  };
}

/* ---------- Progress, remembered on this device ---------- */
const lessonProgress = { done: {}, practice: {} };   // lesson number -> true; lesson number -> best practice score "8 of 10"
(function () {
  try {
    const s = JSON.parse(localStorage.getItem('mt-lessons') || 'null');
    if (s && typeof s === 'object') { lessonProgress.done = s.done || {}; lessonProgress.practice = s.practice || {}; }
  } catch (e) {}
})();
function saveLessonProgress() { try { localStorage.setItem('mt-lessons', JSON.stringify(lessonProgress)); } catch (e) {} }
function lessonsDone() { return LESSONS.filter(function (L) { return lessonProgress.done[L.n]; }).length; }

/* ---------- The screens ---------- */
(function () {
  const view = document.getElementById('lessons');
  let current = null;        // what's open: { kind: "lesson" | "practice" | …, L, step, task, q, … }
  let lastSig = '', pendingFocus = null, cameByLink = false;

  const CHECK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const CIRCLE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9a9a9a" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="8"/></svg>';
  const BACK = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>';
  const NEXT = '<svg class="ls-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
  const esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  const $ = function (sel) { return view.querySelector(sel); };

  function progressBar(done) {
    return '<div class="ls-progress"><div class="ls-bar"><span style="width:' + (100 * done / LESSONS.length).toFixed(1) + '%"></span></div>';
  }

  /* leave whatever was open: stop its task or question, take its marks off the staff and keyboard */
  function leave() {
    if (current && current.q && current.q.stop) { try { current.q.stop(); } catch (e) {} }
    current = null; pendingFocus = null; lastSig = '';
    clearStaff();          /* each screen starts with an empty staff */
    staffAsk(null);
    showKeys(null);
    document.body.classList.remove('hide-key-names');
  }

  function setMode(mode, uses) {
    leave();
    uses = uses || [];
    const b = document.body;
    b.classList.toggle('in-lessons', mode !== 'tools');
    b.classList.toggle('in-lesson', mode === 'lesson');
    ['keys', 'staff', 'metro'].forEach(function (u) { b.classList.toggle('uses-' + u, mode === 'lesson' && uses.indexOf(u) >= 0); });
    view.hidden = mode === 'tools';
    if (mode !== 'tools' && typeof stopTuner === 'function') stopTuner();   // the tuner would put its notes on the staff
    /* a lesson screen without the metronome on it stops the metronome, so it isn't ticking with no Stop button in sight */
    if (mode !== 'tools' && metroOn && !(mode === 'lesson' && uses.indexOf('metro') >= 0)) toggleMetro();
    if (mode === 'tools') view.innerHTML = '';
    window.scrollTo(0, 0);
  }
  function settle(uses) {
    if (uses && uses.indexOf('staff') >= 0) resizeStaff();   // the staff fits itself to its width once it shows
    if (cameByLink) { const h = view.querySelector('h1'); if (h) h.focus({ preventScroll: true }); }
  }

  /* ---------- The list of lessons ---------- */
  function showList() {
    setMode('list');
    const done = lessonsDone(), next = LESSONS.find(function (L) { return !lessonProgress.done[L.n]; });
    let html = '<a class="ls-back" href="#">' + BACK + 'Music Tools</a>' +
      '<section class="ls-card" aria-labelledby="ls-list-title">' +
      '<div class="ls-heading"><p class="ls-kicker">Music theory</p><h1 class="ls-title" id="ls-list-title" tabindex="-1">Your adventure</h1></div>' +
      '<p class="ls-text">' + LESSONS.length + ' short lessons on reading notes, scales and rhythm. You try each idea on the keyboard, the staff and the metronome.</p>' +
      progressBar(done) + '<p class="ls-meta">' + done + ' of ' + LESSONS.length + ' lessons done · each takes about 5 minutes, with an optional practice round at the end</p></div>';
    const units = [];
    LESSONS.forEach(function (L) { if (units.indexOf(L.unit) < 0) units.push(L.unit); });
    units.forEach(function (u) {
      html += '<div class="ls-unit"><h2>' + esc(u) + '</h2>';
      LESSONS.filter(function (L) { return L.unit === u; }).forEach(function (L) {
        const isDone = !!lessonProgress.done[L.n], isNext = next === L;
        const tag = isNext ? (done ? 'Next up' : 'Start here') : isDone ? (lessonProgress.practice[L.n] ? 'Practice: ' + lessonProgress.practice[L.n] : 'Done') : '';
        html += '<a class="ls-row' + (isDone ? ' done' : '') + (isNext ? ' next' : '') + '" href="#lesson/' + L.n + '">' +
          '<span class="ls-dot" aria-hidden="true">' + (isDone ? '✓' : L.n) + '</span>' +
          '<span class="ls-row-words"><span class="ls-row-title"><span class="vh">Lesson ' + L.n + ': </span>' + esc(L.title) + (isDone ? '<span class="vh"> (done)</span>' : '') + '</span>' +
          '<span class="ls-row-sub">' + esc(L.sub) + '</span>' + (tag ? '<span class="ls-row-tag">' + esc(tag) + '</span>' : '') + '</span>' + NEXT + '</a>';
      });
      html += '</div>';
    });
    if (done) html += '<button type="button" class="ls-link" id="lsClear">Clear my progress</button>';
    html += '</section>';
    view.innerHTML = html;
    const clear = $('#lsClear');
    if (clear) clear.addEventListener('click', function () {
      if (clear.dataset.sure) {
        lessonProgress.done = {}; lessonProgress.practice = {}; saveLessonProgress(); showList();
      } else {
        clear.dataset.sure = '1'; clear.textContent = 'Tap again to clear all your progress';
      }
    });
    settle();
  }

  /* ---------- A lesson ---------- */
  function showLesson(L, i) {
    setMode('lesson', L.tools);
    const step = L.steps[i], last = i === L.steps.length - 1;
    current = { kind: 'lesson', L: L, step: i, task: step.task ? step.task() : null };
    const t = current.task;
    let dots = '';
    for (let k = 0; k < L.steps.length; k++) dots += '<span class="' + (k < i ? 'past' : k === i ? 'now' : '') + '"></span>';
    view.innerHTML =
      '<section class="ls-card" aria-labelledby="ls-title">' +
      '<div class="ls-top"><a class="ls-back" href="#lessons">' + BACK + 'All lessons</a><div class="ls-dots" aria-hidden="true">' + dots + '</div></div>' +
      '<p class="ls-kicker">Lesson ' + L.n + ' · Step ' + (i + 1) + ' of ' + L.steps.length + '</p>' +
      '<h1 class="ls-title" id="ls-title" tabindex="-1">' + esc(L.title) + '</h1>' +
      '<div class="ls-text">' + step.text + '</div>' +
      (step.try ? '<div class="ls-try"><p><strong>Try it:</strong> ' + step.try + '</p><div id="lsItems"></div></div>' : '') +
      '<p class="ls-msg" id="lsMsg" role="status" aria-live="polite"></p>' +
      '<div class="ls-actions">' +
      (i > 0 ? '<button type="button" class="ls-btn" id="lsPrev">Back</button>' : '') +
      (last ? '<a class="ls-btn" href="#lesson/' + L.n + '/practice">Practice (optional)</a><a class="ls-btn primary" href="#lesson/' + L.n + '/done">Finish lesson</a>'
            : '<button type="button" class="ls-btn primary" id="lsNext">Next</button>') +
      '</div></section>';
    const prev = $('#lsPrev'), nxt = $('#lsNext');
    if (prev) prev.addEventListener('click', function () { cameByLink = true; showLesson(L, i - 1); });
    if (nxt) nxt.addEventListener('click', function () { cameByLink = true; showLesson(L, i + 1); });
    renderTask(true);
    settle(L.tools);
    if (step.show) showKeys(step.show.map(N));
  }

  function renderTask(force) {
    if (!current || current.kind !== 'lesson') return;
    const t = current.task, box = $('#lsItems'), msg = $('#lsMsg');
    if (!t) return;
    const sig = JSON.stringify([t.items.map(function (x) { return x.done; }), t.msg, t.good, t.i]);
    if (!force && sig === lastSig) return;
    lastSig = sig;
    if (box) {
      if (t.style === 'checks') {
        box.innerHTML = '<ul class="ls-checks">' + t.items.map(function (it) {
          return '<li class="' + (it.done ? 'done' : '') + '">' + (it.done ? CHECK : CIRCLE) + esc(it.label) + '</li>';
        }).join('') + '</ul>';
      } else {
        const now = t.items.findIndex(function (x) { return !x.done; });
        box.innerHTML = '<ul class="ls-chips" aria-label="To play">' + t.items.map(function (it, k) {
          return '<li class="' + (it.done ? 'done' : t.ordered && k === now ? 'now' : '') + '">' + (it.done ? CHECK : '') +
            esc(it.done ? it.shows || it.label : it.label) + (it.done ? '<span class="vh"> (done)</span>' : '') + '</li>';
        }).join('') + '</ul>';
      }
    }
    msg.textContent = t.msg;
    msg.className = 'ls-msg' + (t.good ? ' good' : '');
    if (t.focus != null) focusKey(t.focus);
  }

  /* bring a key into view, but not while a finger is on the keys (scrolling then would cancel its note) */
  function focusKey(m) {
    if (holding.size || touches.size) { pendingFocus = m; return; }
    pendingFocus = null;
    if (keyEls[m]) bringKeyIntoView(keyEls[m]);
  }

  /* ---------- Practice ---------- */
  function showPractice(L) {
    const P = L.practice;
    setMode('lesson', P.tools || L.tools);
    current = { kind: 'practice', L: L, P: P, qi: 0, score: 0, q: null, answered: false, missed: false, last: null };
    if (P.hideNames) document.body.classList.add('hide-key-names');
    view.innerHTML =
      '<section class="ls-card" aria-labelledby="ls-title">' +
      '<div class="ls-top"><a class="ls-back" href="#lesson/' + L.n + '">' + BACK + 'Lesson</a><a class="ls-link skip" href="#lesson/' + L.n + '/done">Skip practice</a></div>' +
      '<p class="ls-kicker">Lesson ' + L.n + ' · Optional practice</p>' +
      '<h1 class="ls-title" id="ls-title" tabindex="-1">' + esc(P.title) + '</h1>' +
      '<div class="ls-progress"><div class="ls-bar"><span id="lsQBar"></span></div><p class="ls-meta" id="lsQMeta"></p></div>' +
      '<p class="ls-text">' + P.intro + '</p>' +
      '<div class="ls-ask" id="lsAsk"></div>' +
      '<div class="ls-choices" id="lsChoices" role="group" aria-label="Answers"></div>' +
      '<div class="ls-actions" id="lsQTools"></div>' +
      '<div class="ls-result" id="lsResult" role="status" aria-live="polite"></div>' +
      '<div class="ls-actions"><button type="button" class="ls-btn primary" id="lsQNext" hidden>Next question</button></div>' +
      '</section>';
    $('#lsQNext').addEventListener('click', function () {
      const c = current;
      if (c.qi + 1 >= c.P.count) {
        const score = c.score + ' of ' + c.P.count, best = lessonProgress.practice[L.n];
        if (!best || parseInt(best, 10) <= c.score) lessonProgress.practice[L.n] = score;
        lessonProgress.done[L.n] = true;
        saveLessonProgress();
        c.finalScore = score;
        lastPracticeScore = { n: L.n, score: score };
        go('#lesson/' + L.n + '/done');
      } else {
        c.qi++;
        askQuestion();
      }
    });
    askQuestion();
    settle(P.tools || L.tools);
  }

  let lastPracticeScore = null;

  function askQuestion() {
    const c = current;
    if (c.q && c.q.stop) c.q.stop();
    staffAsk(null); showKeys(null);
    c.q = c.P.make(c.qi, c.last);
    c.last = c.q.id;
    c.answered = false; c.missed = false;
    $('#lsQBar').style.width = (100 * c.qi / c.P.count).toFixed(1) + '%';
    $('#lsQMeta').textContent = 'Question ' + (c.qi + 1) + ' of ' + c.P.count + (c.qi ? ' · ' + c.score + ' right so far' : '');
    $('#lsAsk').innerHTML = c.q.ask;
    const choices = $('#lsChoices');
    choices.innerHTML = (c.q.choices || []).map(function (ch, k) {
      return '<button type="button" class="ls-choice" data-k="' + k + '">' + ch + '</button>';
    }).join('');
    choices.hidden = !c.q.choices;
    choices.querySelectorAll('.ls-choice').forEach(function (b) {
      b.addEventListener('click', function () { choose(Number(b.dataset.k), b); });
    });
    const tools = $('#lsQTools');
    tools.innerHTML = (c.q.replay ? '<button type="button" class="ls-btn" id="lsReplay"><span aria-hidden="true">▶</span> Play again</button>' : '') +
      (c.q.showMe ? '<button type="button" class="ls-btn" id="lsShowMe">Show me</button>' : '');
    tools.hidden = !c.q.replay && !c.q.showMe;
    if (c.q.replay) $('#lsReplay').addEventListener('click', function () { c.q.replay(); });
    if (c.q.showMe) $('#lsShowMe').addEventListener('click', function () { c.missed = true; const r = c.q.showMe(); if (r) result(r, false, false); });
    $('#lsResult').innerHTML = ''; $('#lsResult').className = 'ls-result';
    const nb = $('#lsQNext');
    nb.hidden = true;
    nb.textContent = c.qi + 1 >= c.P.count ? 'See how you did' : 'Next question';
    if (c.q.start) c.q.start();
    if (c.q.focus != null) focusKey(c.q.focus);
  }

  /* show how it went. right: was it right · final: is the question over */
  function result(text, right, final) {
    const c = current, box = $('#lsResult');
    box.className = 'ls-result ' + (right ? 'right' : 'wrong');
    box.innerHTML = (right ? CHECK : '') + '<span>' + text + '</span>';
    if (!right) c.missed = true;           /* a wrong try, or "Show me": the question no longer scores */
    if (final !== false && !c.answered) {
      c.answered = true;
      if (right && !c.missed) c.score++;
      $('#lsQNext').hidden = false;
      $('#lsQMeta').textContent = 'Question ' + (c.qi + 1) + ' of ' + c.P.count + ' · ' + c.score + ' right so far';
      const sm = $('#lsShowMe'); if (sm) sm.hidden = true;
    }
  }

  function choose(k, btn) {
    const c = current, q = c.q;
    if (c.answered) return;
    const right = k === q.answer;
    btn.classList.add(right ? 'right' : 'wrong');
    if (!right) $('#lsChoices').querySelector('[data-k="' + q.answer + '"]').classList.add('right');
    $('#lsChoices').querySelectorAll('.ls-choice').forEach(function (b) { b.disabled = true; });
    result(right ? q.right : q.wrong, right);
  }

  /* ---------- Done ---------- */
  function showDone(L) {
    setMode('done');
    if (!lessonProgress.done[L.n]) { lessonProgress.done[L.n] = true; saveLessonProgress(); }
    const done = lessonsDone(), nextL = LESSONS.find(function (x) { return x.n > L.n && !lessonProgress.done[x.n]; }) || LESSONS.find(function (x) { return !lessonProgress.done[x.n]; });
    const score = lastPracticeScore && lastPracticeScore.n === L.n ? lastPracticeScore.score : null;
    lastPracticeScore = null;
    const all = done === LESSONS.length;
    view.innerHTML =
      '<section class="ls-card" aria-labelledby="ls-title">' +
      '<div class="ls-done-head"><span class="ls-done-mark"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>' +
      '<div class="ls-heading"><h1 class="ls-title" id="ls-title" tabindex="-1">Lesson ' + L.n + ' done</h1>' +
      '<p class="ls-meta" style="font-size:14px;color:#555">' + esc(L.title) + (score ? ' · practice ' + score : '') + '</p></div></div>' +
      '<div class="ls-learned"><h2>What you learned</h2><ul>' + L.learned.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul></div>' +
      progressBar(done) + '<p class="ls-meta">' + (all ? 'All ' + LESSONS.length + ' lessons done. Well done!' : done + ' of ' + LESSONS.length + ' lessons done') + '</p></div>' +
      '<div class="ls-actions stack">' +
      (nextL ? '<a class="ls-btn primary" href="#lesson/' + nextL.n + '">Next: ' + esc(nextL.title) + '</a>' : '') +
      (!score && !lessonProgress.practice[L.n] ? '<a class="ls-btn" href="#lesson/' + L.n + '/practice">Try the practice (optional)</a>' : '') +
      '<a class="ls-btn' + (nextL ? '' : ' primary') + '" href="#lessons">All lessons</a>' +
      '</div></section>';
    settle();
  }

  function showTools() { setMode('tools'); }

  /* ---------- Which screen ----------
     Links to the screens ("#lessons" and so on) are handled here rather than left to the browser: inside a
     preview (a page shown within another page, as in the Claude app) the browser would read "#lessons" as a link
     to the outer page, and nothing would happen. The address still changes where it can, so Back works. */
  let shown = null;          // the screen showing now, as its address ("" for the tools)
  function route(h) {
    shown = h;
    let m;
    if (h === '#lessons') showList();
    else if ((m = /^#lesson\/(\d+)(?:\/(practice|done))?$/.exec(h)) && LESSONS[m[1] - 1]) {
      const L = LESSONS[m[1] - 1];
      if (m[2] === 'practice') showPractice(L); else if (m[2] === 'done') showDone(L); else showLesson(L, 0);
    } else showTools();
  }
  function hereNow() { try { return location.hash === '#' ? '' : location.hash; } catch (e) { return ''; } }
  go = function (h) {
    h = h === '#' ? '' : h;
    try { if (hereNow() !== h) location.hash = h; } catch (e) {}
    if (h !== shown) { cameByLink = true; route(h); }
  };
  document.addEventListener('click', function (e) {
    const a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    go(a.getAttribute('href'));
  });
  window.addEventListener('hashchange', function () { const h = hereNow(); if (h !== shown) { cameByLink = true; route(h); } });
  /* called at the end of js/lesson-list.js, once the lessons are there */
  lessonsReady = function () { cameByLink = false; route(hereNow()); };

  /* ---------- Listening to the keys, and checking the metronome ---------- */
  keyWatchers.push(function (what, m) {
    if (!current) return;
    const now = performance.now();
    if (current.kind === 'lesson' && current.task && current.task.key) {
      current.task.key(what, m, now);
      renderTask();
    } else if (current.kind === 'practice' && current.q && current.q.key && !current.answered && what === 'down') {
      const r = current.q.key(what, m, now);
      if (r) result(r.text, r.right, r.final);
    }
    if ((what === 'up' || what === 'cancel') && pendingFocus != null && !holding.size) {
      const p = pendingFocus;
      setTimeout(function () { if (!holding.size && !touches.size) focusKey(p); }, 150);
    }
  });
  setInterval(function () {
    if (current && current.kind === 'lesson' && current.task && current.task.tick) { current.task.tick(); renderTask(); }
  }, 250);
})();
