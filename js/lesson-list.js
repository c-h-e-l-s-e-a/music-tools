/* ---------- The theory lessons themselves ----------
   12 lessons in three groups. Each lesson has:
     title, sub      its name, and a line about it in the list of lessons
     tools           what shows below it: "keys" (the keyboard), "staff", "metro" (the metronome)
     steps           each with text (what to read), try (what to do) and task (how it's checked; see js/lessons.js)
     learned         the summary on the "lesson done" screen
     practice        the optional practice round at the end
   Notes are written like "C4" (middle C), "F♯4" or "B♭4". */

/* ---------- Practice rounds ---------- */

/* the nearest key with this note name to key m (for showing where the right answer is) */
function nearestNamed(m, want) {
  let best = null;
  for (let k = START; k <= END; k++) if (pc(k) === want && (best === null || Math.abs(k - m) < Math.abs(best - m))) best = k;
  return best;
}

/* where each white key is, from the pattern of black keys */
const WHERE = {
  C: 'C is just left of each group of two black keys.',
  D: 'D is between the two black keys of each group of two.',
  E: 'E is just right of each group of two black keys.',
  F: 'F is just left of each group of three black keys.',
  G: 'G is between the first two black keys of each group of three.',
  A: 'A is between the last two black keys of each group of three.',
  B: 'B is just right of each group of three black keys.'
};
function whereIs(name) {
  if (name.length === 1) return WHERE[name];
  const up = name[1] === '♯', nat = name[0], other = prettyName(N(name + '4')).replace(/\d/g, '');
  return name + ' is the black key just ' + (up ? 'right' : 'left') + ' of ' + nat + (up ? '' : ' (the same key as ' + other + ')') + '.';
}

/* "Press any F": names hidden, so you find it from the pattern */
function findPractice(names, title, intro) {
  return {
    title: title, intro: intro, count: 10, hideNames: true, tools: ['keys'],
    make: function (i, last) {
      const name = pickNew(names, last), want = pc(N(name + '4'));
      return {
        id: name,
        ask: '<span class="ls-ask-small">Press any key named</span><span class="ls-ask-big">' + name + '</span>',
        key: function (what, m) {
          if (pc(m) === want) { flashKey(m); return { right: true, text: 'Yes, that’s ' + name + '.' }; }
          showKeys([nearestNamed(m, want)]);
          return { right: false, text: 'That’s ' + letter(m) + '. ' + whereIs(name) + ' The nearest one is lit up in orange.' };
        }
      };
    }
  };
}

/* "Which note is the orange one on the staff?" */
function staffPractice(names, title, intro) {
  return {
    title: title, intro: intro, count: 10, tools: ['keys', 'staff'],
    make: function (i, last) {
      const name = pickNew(names, last), m = N(name);
      return {
        id: name,
        ask: '<span class="ls-ask-small">Find the orange note on the staff below the keyboard, then press its key.</span>',
        start: function () { staffAsk([[m]]); },
        key: function (what, k) {
          if (k === m) { flashKey(k); return { right: true, text: 'Yes, that’s ' + prettyName(m) + ', ' + whereOnStaff(m) + '.' }; }
          showKeys([m]);
          return { right: false, text: 'That’s ' + prettyName(k) + '. The orange note is ' + prettyName(m) + ', ' + whereOnStaff(m) + '. Its key is lit up.' };
        }
      };
    }
  };
}

/* half step or whole step? */
function halfWholePractice() {
  return {
    title: 'Half or whole?', count: 10, tools: ['keys'],
    intro: 'Two keys light up in orange and play. Is it a half step or a whole step?',
    make: function (i, last) {
      let a, d;
      do { a = 60 + Math.floor(Math.random() * 10); d = Math.random() < 0.5 ? 1 : 2; } while (a + '-' + d === last);
      const b = a + d, A = prettyName(a), B = prettyName(b);
      const hear = function () { playNotes([a, b], 600); };
      return {
        id: a + '-' + d, focus: a,
        ask: '<span class="ls-ask-small">How far apart are the two orange keys?</span>',
        start: function () { showKeys([a, b]); hear(); }, replay: hear,
        choices: ['Half step', 'Whole step'], answer: d - 1,
        right: d === 1 ? 'Yes: ' + A + ' to ' + B + ' is a half step. They’re right next to each other.' : 'Yes: ' + A + ' to ' + B + ' is a whole step, with ' + prettyName(a + 1) + ' in between.',
        wrong: d === 1 ? 'It’s a half step: ' + A + ' and ' + B + ' are right next to each other, with no key in between.' : 'It’s a whole step: ' + prettyName(a + 1) + ' is in between ' + A + ' and ' + B + '.'
      };
    }
  };
}

/* play a whole major scale */
function scalePractice() {
  const SCALES = [
    { name: 'D major', notes: ['D4', 'E4', 'F♯4', 'G4', 'A4', 'B4', 'C♯5', 'D5'] },
    { name: 'F major', notes: ['F4', 'G4', 'A4', 'B♭4', 'C5', 'D5', 'E5', 'F5'] },
    { name: 'A major', notes: ['A3', 'B3', 'C♯4', 'D4', 'E4', 'F♯4', 'G♯4', 'A4'] },
    { name: 'E major', notes: ['E4', 'F♯4', 'G♯4', 'A4', 'B4', 'C♯5', 'D♯5', 'E5'] }
  ];
  const STEP = ['whole', 'whole', 'half', 'whole', 'whole', 'whole', 'half'];
  return {
    title: 'Build a scale', count: SCALES.length, tools: ['keys', 'staff'],
    intro: 'Play each major scale, going up. Use the pattern: whole, whole, half, whole, whole, whole, half.',
    make: function (i) {
      const s = SCALES[i], notes = s.notes.map(N);
      let k = 0;
      function chips() {
        const ul = document.getElementById('lsScale');
        if (ul) ul.innerHTML = s.notes.map(function (n, j) { return '<li class="' + (j < k ? 'done' : j === k ? 'now' : '') + '">' + (j < k ? n : j === 0 ? n : '?') + '</li>'; }).join('');
      }
      return {
        id: s.name, focus: notes[0],
        ask: '<span class="ls-ask-small">Play the major scale that starts on</span><span class="ls-ask-big">' + s.notes[0] + '</span><ul class="ls-chips" id="lsScale" aria-label="The scale so far"></ul>',
        start: chips,
        key: function (what, m) {
          if (m === notes[k]) {
            flashKey(m); showKeys(null); k++; chips();
            return k === notes.length ? { right: true, text: 'Yes! That’s the ' + s.name + ' scale: ' + s.notes.map(function (n) { return n.replace(/\d/, ''); }).join(' ') + '.' } : null;
          }
          if (k > 0 && m === notes[k - 1]) return null;
          if (k === 0) return { right: false, final: false, text: 'Start on ' + s.notes[0] + '.' };
          return { right: false, final: false, text: 'Not quite: ' + prettyName(m) + ' isn’t next. From ' + s.notes[k - 1] + ', go up a ' + STEP[k - 1] + ' step.' };
        },
        showMe: function () { showKeys([notes[k]]); return 'The next note is ' + s.notes[k] + ', lit up in orange.'; }
      };
    }
  };
}

/* name the interval */
function intervalPractice() {
  const WHITE = [0, 2, 4, 5, 7, 9, 11], NAMES = ['2nd', '3rd', '4th', '5th', '6th', '7th', 'Octave'];
  function up(m, letters) {   // the white key `letters` letters above white key m
    let idx = WHITE.indexOf(pc(m)), oct = Math.floor(m / 12);
    for (let s = 0; s < letters; s++) { idx++; if (idx === 7) { idx = 0; oct++; } }
    return oct * 12 + WHITE[idx];
  }
  return {
    title: 'Name the interval', count: 10, tools: ['keys', 'staff'],
    intro: 'Two orange notes appear on the staff and play. Count the letters from the lower one up to the higher one, counting both.',
    make: function (i, last) {
      let a, size;
      do { a = up(60, Math.floor(Math.random() * 5)); size = 2 + Math.floor(Math.random() * 7); } while (a + '-' + size === last);
      const b = up(a, size - 1), letters = [];
      for (let s = 0; s < size; s++) letters.push(letter(up(a, s)));
      const name = size === 8 ? 'an octave' : 'a ' + NAMES[size - 2], A = prettyName(a), B = prettyName(b);
      const hear = function () { playNotes([a, b], 650); };
      return {
        id: a + '-' + size,
        ask: '<span class="ls-ask-small">What interval are the two orange notes on the staff?</span>',
        start: function () { staffAsk([[a], [b]]); hear(); }, replay: hear,
        choices: NAMES, answer: size - 2,
        right: 'Yes: ' + A + ' up to ' + B + ' is ' + name + ' (' + letters.join(' ') + ').',
        wrong: 'It’s ' + name + ': from ' + A + ' up to ' + B + ' is ' + letters.join(', ') + ', ' + size + ' letters.'
      };
    }
  };
}

/* build the triad on each white key */
function chordPractice() {
  const TRIADS = { C: 'C major', D: 'D minor', E: 'E minor', F: 'F major', G: 'G major', A: 'A minor' };
  const WHITE = [0, 2, 4, 5, 7, 9, 11];
  let order = [];
  return {
    title: 'Build the triad', count: 6, tools: ['keys', 'staff'],
    intro: 'Play the triad that starts on each note: the note, then every other white key above it. Any octave will do.',
    make: function (i) {
      if (i === 0) order = shuffle(Object.keys(TRIADS));
      const root = order[i], r = N(root + '4');
      const idx = WHITE.indexOf(pc(r)), want = [0, 2, 4].map(function (s) { return WHITE[(idx + s) % 7]; });
      const shape = [r, r + (want[1] - want[0] + 12) % 12, r + (want[2] - want[0] + 12) % 12];
      const spell = want.map(function (p) { return NOTE_NAMES[p]; }).join(' ');
      let log = [];
      return {
        id: root, focus: r,
        ask: '<span class="ls-ask-small">Play the triad on</span><span class="ls-ask-big">' + root + '</span>',
        key: function (what, m, now) {
          log.push({ m: m, at: now });
          log = log.filter(function (p) { return now - p.at < 1500; });
          let got = Array.from(holding.keys());
          if (got.length < 3) got = log.slice(-3).map(function (p) { return p.m; });
          got = got.filter(function (x, k, a) { return a.indexOf(x) === k; }).sort(function (a, b) { return a - b; });
          if (got.length < 3) return null;
          const pcs = got.map(pc);
          const right = got.length === 3 && pcs[0] === want[0] && want.every(function (p) { return pcs.indexOf(p) >= 0; });
          log = [];
          if (right) { got.forEach(flashKey); return { right: true, text: 'Yes! ' + spell + ' is ' + ('AEF'.indexOf(root) >= 0 ? 'an ' : 'a ') + TRIADS[root] + ' chord.' }; }
          return { right: false, final: false, text: 'That’s ' + got.map(prettyName).join(' ') + '. Try again: start on ' + root + ', then every other white key.' };
        },
        showMe: function () { showKeys(shape); return 'The triad on ' + root + ' is ' + spell + ', lit up in orange.'; }
      };
    }
  };
}

/* guess the tempo */
function tempoPractice() {
  const TEMPOS = [60, 90, 120, 160];
  return {
    title: 'Guess the tempo', count: 6, tools: [],
    intro: 'Listen to the clicks and pick the tempo. Remember: 60 bpm is one click every second.',
    make: function (i, last) {
      const t = pickNew(TEMPOS, last);
      const hear = function () { if (metroOn) toggleMetro(); playClicks(8, 60 / t, 0); };
      const extra = t === 60 ? ' One click every second.' : t === 120 ? ' Two clicks every second.' : '';
      return {
        id: t, ask: '<span class="ls-ask-small">Listen. What’s the tempo?</span>',
        start: hear, replay: hear,
        choices: TEMPOS.map(function (x) { return x + ' bpm'; }), answer: TEMPOS.indexOf(t),
        right: 'Yes, that was ' + t + ' bpm.' + extra, wrong: 'It was ' + t + ' bpm.' + extra
      };
    }
  };
}

/* how many beats? */
function beatsPractice() {
  const BEATS = { whole: 4, half: 2, quarter: 1, eighth: 0.5 };
  const SETS = [['whole'], ['half'], ['quarter'], ['eighth'], ['half', 'quarter'], ['eighth', 'eighth'], ['quarter', 'quarter', 'half'],
    ['half', 'half'], ['quarter', 'eighth', 'eighth'], ['eighth', 'eighth', 'half'], ['quarter', 'quarter', 'quarter']];
  const CHOICES = ['½', '1', '2', '3', '4'], VALUES = [0.5, 1, 2, 3, 4];
  let order = [];
  const say = function (v) { return v === 0.5 ? '½' : String(v); };
  return {
    title: 'How many beats?', count: 8, tools: [],
    intro: 'Add up how long the notes last. The beat is a quarter note, as in 4/4.',
    make: function (i) {
      if (i === 0) order = shuffle(SETS);
      const set = order[i], total = set.reduce(function (n, k) { return n + BEATS[k]; }, 0);
      const sum = set.map(function (k) { return 'a ' + k + ' note (' + say(BEATS[k]) + ')'; }).join(' + ') + (set.length > 1 ? ' = ' + say(total) : '');
      const beats = total === 1 ? '1 beat' : say(total) + ' beats';
      return {
        id: set.join('-'),
        ask: '<div class="ls-notes">' + set.map(function (k) { return noteIcon(k, 46); }).join('') + '</div>' +
          '<span class="ls-ask-small">' + (set.length > 1 ? 'How many beats, all together?' : 'How many beats does it last?') + '</span>',
        choices: CHOICES, answer: VALUES.indexOf(total),
        right: 'Yes: ' + (set.length > 1 ? sum + ' beats.' : 'a ' + set[0] + ' note lasts ' + beats + '.'),
        wrong: set.length > 1 ? 'It’s ' + beats + ': ' + sum + '.' : 'A ' + set[0] + ' note lasts ' + beats + '.'
      };
    }
  };
}

/* which time signature? */
function meterPractice() {
  return {
    title: 'Which time signature?', count: 6, tools: [],
    intro: 'Listen for the higher click: it comes on beat 1 of each bar. How many beats are in each bar?',
    make: function (i, last) {
      const n = pickNew([2, 3, 4], last);
      const hear = function () { if (metroOn) toggleMetro(); playClicks(n * 3, 0.5, n); };
      return {
        id: n, ask: '<span class="ls-ask-small">Listen. Which time signature is it?</span>',
        start: hear, replay: hear,
        choices: ['2/4', '3/4', '4/4'], answer: n - 2,
        right: 'Yes: the higher click came every ' + n + ' beats, so it’s ' + n + '/4.',
        wrong: 'It’s ' + n + '/4: the higher click came every ' + n + ' beats.'
      };
    }
  };
}

/* ---------- Tasks only one lesson uses ---------- */

/* Lesson 1: play a whole group of two black keys, and a whole group of three */
function blackGroups() {
  return function () {
    const items = [{ label: 'a group of two', done: false }, { label: 'a group of three', done: false }];
    const got = {};   // e.g. "2-5": the group of two in this octave -> the keys played in it
    const t = { items: items, style: 'chips', ordered: false, msg: '', good: false, done: false, focus: N('C♯4') };
    t.key = function (what, m) {
      if (what !== 'down' || t.done) return;
      const p = pc(m), size = p === 1 || p === 3 ? 2 : p === 6 || p === 8 || p === 10 ? 3 : 0;
      if (!size) { t.msg = 'That’s a white key. Play the black keys.'; t.good = false; return; }
      const id = size + '-' + Math.floor(m / 12);
      got[id] = got[id] || [];
      if (got[id].indexOf(m) < 0) got[id].push(m);
      if (got[id].length === size) {
        items[size - 2].done = true; got[id].forEach(flashKey); got[id] = [];
        t.msg = 'Yes, that’s a whole group of ' + (size === 2 ? 'two.' : 'three.'); t.good = true;
      } else {
        t.msg = 'Good. Now the ' + (size === 2 ? 'other black key' : 'other black keys') + ' in that group.'; t.good = true;
      }
      if (items.every(function (x) { return x.done; })) { t.done = true; t.msg = 'That’s the pattern: twos and threes, all the way along.'; t.good = true; }
    };
    return t;
  };
}

/* Lesson 2: a high note and a low note */
function highLow() {
  return function () {
    const items = [{ label: 'a high note: C5 or higher', done: false }, { label: 'a low note: C3 or lower', done: false }];
    const t = { items: items, style: 'chips', ordered: false, msg: '', good: false, done: false, focus: N('C5') };
    t.key = function (what, m) {
      if (what !== 'down' || t.done) return;
      if (m >= N('C5')) { items[0].done = true; flashKey(m); t.msg = 'Yes: ' + prettyName(m) + ' is up on the treble staff.'; t.good = true; t.focus = N('C3'); }
      else if (m <= N('C3')) { items[1].done = true; flashKey(m); t.msg = 'Yes: ' + prettyName(m) + ' is down on the bass staff.'; t.good = true; t.focus = N('C5'); }
      else { t.msg = 'That’s ' + prettyName(m) + ', near the middle. Go further up or down.'; t.good = false; }
      if (items.every(function (x) { return x.done; })) { t.done = true; t.msg = 'High notes go on the treble staff, low notes on the bass staff.'; t.good = true; }
    };
    return t;
  };
}

/* Lesson 11: notes spaced evenly with the clicks; perClick 1 = quarter notes, 2 = eighth notes */
function tapsWithClicks(perClick, count, label, doneMsg) {
  return function () {
    const items = [{ label: 'Metronome started', done: false }, { label: label, done: false }];
    const t = { items: items, style: 'checks', msg: '', good: false, done: false, focus: null };
    let times = [];
    t.tick = function () { if (!t.done) items[0].done = metroOn; };
    t.key = function (what, m, now) {
      if (what !== 'down' || t.done) return;
      if (!metroOn) { t.msg = 'Start the metronome first: press Start below.'; t.good = false; times = []; return; }
      times.push(now);
      if (times.length > count) times.shift();
      if (times.length < count) { t.msg = ''; return; }
      const click = clickMs(), want = 1 / perClick, gaps = [];
      for (let k = 1; k < times.length; k++) gaps.push((times[k] - times[k - 1]) / click);
      const avg = gaps.reduce(function (a, b) { return a + b; }, 0) / gaps.length;
      const even = gaps.every(function (g) { return Math.abs(g - want) <= want * 0.35; }) && Math.abs(avg - want) <= want * 0.2;
      if (even) { items[1].done = true; t.done = true; t.msg = doneMsg; t.good = true; }
      else {
        t.msg = 'Those notes were about ' + avg.toFixed(1) + ' clicks apart. ' + (perClick === 1 ? 'Try one note on each click.' : 'Try two notes on each click: one on the click, one halfway to the next.');
        t.good = false;
      }
    };
    return t;
  };
}

/* Lesson 11: hold a key for 2 beats, then for 4 */
function holdBeats() {
  return function () {
    const items = [{ label: 'Metronome started', done: false }, { label: 'A half note: 2 beats', done: false }, { label: 'A whole note: 4 beats', done: false }];
    const t = { items: items, style: 'checks', msg: '', good: false, done: false, focus: null };
    const downAt = {};
    t.tick = function () { if (!t.done) items[0].done = metroOn; };
    t.key = function (what, m, now) {
      if (t.done) return;
      if (what === 'down') { downAt[m] = now; return; }
      if (what !== 'up' || downAt[m] === undefined) return;
      const beats = (now - downAt[m]) / clickMs();
      delete downAt[m];
      if (!metroOn) { t.msg = 'Start the metronome first: press Start below.'; t.good = false; return; }
      const it = items[1].done ? items[2] : items[1], want = it === items[1] ? 2 : 4;
      if (Math.abs(beats - want) <= want * 0.25) {
        it.done = true; flashKey(m);
        t.msg = want === 2 ? 'Yes: that was a half note, 2 beats. Now hold one for 4 beats.' : 'Yes: a whole note, 4 beats.'; t.good = true;
      } else {
        t.msg = 'You held it for about ' + beats.toFixed(1) + ' beats. Press on a click and let go ' + (want === 2 ? 'two' : 'four') + ' clicks later.'; t.good = false;
      }
      if (items[1].done && items[2].done) { items[0].done = true; t.done = true; t.msg = 'Half note: 2 beats. Whole note: 4 beats.'; t.good = true; }
    };
    return t;
  };
}

const playing = { label: 'Metronome playing', test: function () { return metroOn; } };
const started = { label: 'Metronome started', test: function () { return metroOn; } };
const NOTE = function (kind) { return '<span class="ls-notes-inline">' + noteIcon(kind, 30) + '</span>'; };

/* ---------- The lessons ---------- */
LESSONS.push(
  /* ---------------- Reading notes ---------------- */
  {
    n: 1, unit: 'Reading notes', title: 'The pattern of the keys', sub: 'Black keys come in twos and threes. Find every C.',
    tools: ['keys'],
    steps: [
      { text: '<p>A piano keyboard repeats the same pattern over and over. Look at the black keys: they come in <strong>groups of two</strong> and <strong>groups of three</strong>.</p>',
        try: 'play all the black keys in a group of two, then all the black keys in a group of three.',
        task: blackGroups() },
      { text: '<p>The white keys are named with the first seven letters of the alphabet, A to G. Then the letters start again.</p><p><strong>C</strong> is the white key just to the left of each group of two black keys.</p>',
        try: 'find and play every C on this keyboard. There are four.',
        task: play(['C3', 'C4', 'C5', 'C6'], { anyOrder: true, hint: 'C is just left of a group of two black keys.', done: 'Those are all the Cs on this keyboard.' }) },
      { text: '<p>From C, the white keys go up through the letters: C, D, E, F, G, A, B, and then C again. The further right you go, the higher the notes sound.</p>',
        try: 'play from C4 up to the next C, one white key at a time.',
        task: play(['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'], { done: 'C D E F G A B C: that pattern repeats all the way along.' }) }
    ],
    learned: ['Black keys come in groups of two and three', 'C is just left of each group of two black keys', 'The white keys go C D E F G A B, then start again'],
    practice: findPractice(['C', 'D', 'E', 'F', 'G', 'A', 'B'], 'Find the key',
      'Press any key with that name. The names on the keys are hidden, so use the pattern of black keys.')
  },
  {
    n: 2, unit: 'Reading notes', title: 'Middle C and the grand staff', sub: 'The treble clef, the bass clef, and the note between them.',
    tools: ['keys', 'staff'],
    steps: [
      { text: '<p>Music is written on a <strong>staff</strong>: five lines with four spaces between them. The higher a note sounds, the higher it sits on the staff.</p><p>The <strong>grand staff</strong> joins two staffs. The top one, marked with a <strong>treble clef</strong>, is for higher notes. The bottom one, marked with a <strong>bass clef</strong>, is for lower notes.</p>',
        try: 'play a high note and a low note, and watch where each one lands on the staff below the keyboard.',
        task: highLow() },
      { text: '<p><strong>Middle C</strong> is the C nearest the middle of a piano, called C4. On the grand staff it sits between the two staffs, on a short line of its own called a <strong>ledger line</strong>.</p>',
        try: 'play middle C.',
        task: play(['C4'], { done: 'That’s middle C, right between the two staffs.' }) },
      { text: '<p>Each line and each space stands for one white key. Going up one white key moves a note up one place on the staff: from a line to the space just above it, then to the next line, and so on.</p>',
        try: 'play C4, D4, E4, F4 and G4, and watch them climb the staff.',
        task: play(['C4', 'D4', 'E4', 'F4', 'G4'], { done: 'Line, space, line, space: each white key is one step up the staff.' }) }
    ],
    learned: ['The treble staff is for higher notes, the bass staff for lower notes', 'Middle C (C4) sits between them, on its own ledger line', 'Each white key up is one place up the staff: line, space, line, space'],
    practice: staffPractice(['G3', 'A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4'], 'Name that note',
      'Which note is the orange one on the staff? Press its key. Count up or down from middle C.')
  },
  {
    n: 3, unit: 'Reading notes', title: 'Notes on the treble staff', sub: 'Lines E G B D F, spaces F A C E.',
    tools: ['keys', 'staff'],
    steps: [
      { text: '<p>The <strong>treble clef</strong> is also called the <strong>G clef</strong>. Its curl wraps around the second line from the bottom, and that line is G: the G above middle C, G4.</p>',
        try: 'play G4 and see it land on the second line.',
        task: play(['G4'], { done: 'G4: the line the treble clef curls around.' }) },
      { text: '<p>The four <strong>spaces</strong> of the treble staff, from the bottom up, spell <strong>FACE</strong>: F4, A4, C5, E5.</p>',
        try: 'play the four space notes, from the bottom space up.',
        task: play(['F4', 'A4', 'C5', 'E5'], { done: 'F A C E: the spaces spell FACE.' }) },
      { text: '<p>The five <strong>lines</strong>, from the bottom up, are <strong>E G B D F</strong>: E4, G4, B4, D5, F5. Many people remember them as “Every Good Boy Does Fine”.</p>',
        try: 'play the five line notes, from the bottom line up.',
        task: play(['E4', 'G4', 'B4', 'D5', 'F5'], { done: 'E G B D F: Every Good Boy Does Fine.' }) }
    ],
    learned: ['The treble clef (the G clef) curls around G4, on the second line', 'Its spaces, bottom to top: F A C E', 'Its lines, bottom to top: E G B D F'],
    practice: staffPractice(['E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F5'], 'Name that note',
      'Which note is the orange one on the treble staff? Press its key. Lines and spaces are counted from the bottom.')
  },
  {
    n: 4, unit: 'Reading notes', title: 'Notes on the bass staff', sub: 'Lines G B D F A, spaces A C E G.',
    tools: ['keys', 'staff'],
    steps: [
      { text: '<p>The <strong>bass clef</strong> is also called the <strong>F clef</strong>. Its two dots sit either side of the fourth line from the bottom, and that line is F: the F below middle C, F3.</p>',
        try: 'play F3 and see it land on the fourth line.',
        task: play(['F3'], { done: 'F3: the line between the bass clef’s two dots.' }) },
      { text: '<p>The four <strong>spaces</strong> of the bass staff, from the bottom up, are <strong>A C E G</strong>: A2, C3, E3, G3. Many people remember them as “All Cows Eat Grass”.</p>',
        try: 'play the four space notes, from the bottom space up.',
        task: play(['A2', 'C3', 'E3', 'G3'], { done: 'A C E G: All Cows Eat Grass.' }) },
      { text: '<p>The five <strong>lines</strong>, from the bottom up, are <strong>G B D F A</strong>: G2, B2, D3, F3, A3. Many people remember them as “Good Boys Do Fine Always”.</p>',
        try: 'play the five line notes, from the bottom line up.',
        task: play(['G2', 'B2', 'D3', 'F3', 'A3'], { done: 'G B D F A: Good Boys Do Fine Always.' }) }
    ],
    learned: ['The bass clef (the F clef) marks F3 with its two dots', 'Its spaces, bottom to top: A C E G', 'Its lines, bottom to top: G B D F A'],
    practice: staffPractice(['G2', 'A2', 'B2', 'C3', 'D3', 'E3', 'F3', 'G3', 'A3'], 'Name that note',
      'Which note is the orange one on the bass staff? Press its key. Lines and spaces are counted from the bottom.')
  },

  /* ---------------- Steps, scales and chords ---------------- */
  {
    n: 5, unit: 'Steps, scales and chords', title: 'Half steps and whole steps', sub: 'The distance from one key to the very next one.',
    tools: ['keys', 'staff'],
    steps: [
      { text: '<p>A <strong>half step</strong> is the distance from one key to the very next key, black or white, with no key in between. It’s the smallest step on the keyboard.</p><p>Most half steps go from a white key to the black key right next to it.</p>',
        try: 'play C4, then the black key just to its right, C♯4.',
        task: play(['C4', 'C♯4'], { done: 'C4 to C♯4 is a half step.' }) },
      { text: '<p>In two places, white keys sit right next to each other with no black key between them: <strong>E and F</strong>, and <strong>B and C</strong>. Those are half steps too.</p>',
        try: 'play E4 then F4, then B4 then C5.',
        task: play(['E4', 'F4', 'B4', 'C5'], { done: 'E to F and B to C: half steps between white keys.' }) },
      { text: '<p>A <strong>whole step</strong> is two half steps: skip the very next key and land on the one after it. C to D is a whole step, with C♯ in between.</p>',
        try: 'play C4 then D4. Then find a whole step up from E4. (Careful: the key right after E is F.)',
        task: play(['C4', 'D4', 'E4', { n: 'F♯4', label: 'a whole step up from E4' }], { done: 'E4 to F♯4 is a whole step, with F4 in between.' }) }
    ],
    learned: ['A half step goes from one key to the very next one', 'E to F and B to C are half steps, with no black key between', 'A whole step is two half steps, with one key in between'],
    practice: halfWholePractice()
  },
  {
    n: 6, unit: 'Steps, scales and chords', title: 'Sharps and flats', sub: 'Why each black key has two names.',
    tools: ['keys', 'staff'],
    steps: [
      { text: '<p>A <strong>sharp</strong> (♯) raises a note by a half step. F♯ (“F sharp”) is the key just to the right of F.</p>',
        try: 'play F4, then F♯4.',
        task: play(['F4', 'F♯4'], { done: 'F♯4 is a half step above F4.' }) },
      { text: '<p>A <strong>flat</strong> (♭) lowers a note by a half step. B♭ (“B flat”) is the key just to the left of B.</p>',
        try: 'play B4, then B♭4.',
        task: play(['B4', 'B♭4'], { done: 'B♭4 is a half step below B4. It’s the same key as A♯4.' }) },
      { text: '<p>So every black key has two names. The key between C and D is both C♯ and D♭. The key between D and E is both D♯ and E♭, and so on.</p><p>This keyboard and staff use the sharp names for the black keys.</p>',
        try: 'play E♭4 and A♭4.',
        task: play(['E♭4', 'A♭4'], { anyOrder: true, hint: 'A flat is the black key just to the left of its letter.', done: 'E♭4 is the key labelled D♯4, and A♭4 is G♯4.' }) }
    ],
    learned: ['A sharp (♯) is a half step higher', 'A flat (♭) is a half step lower', 'Each black key has two names, like C♯ and D♭'],
    practice: findPractice(['C♯', 'D♭', 'D♯', 'E♭', 'F♯', 'G♭', 'G♯', 'A♭', 'A♯', 'B♭'], 'Find the sharp or flat',
      'Press any key with that name. The names on the keys are hidden.')
  },
  {
    n: 7, unit: 'Steps, scales and chords', title: 'The major scale', sub: 'Whole, whole, half, whole, whole, whole, half.',
    tools: ['keys', 'staff'],
    steps: [
      { text: '<p>A <strong>scale</strong> is a set of notes played in order, going up or down. The <strong>C major scale</strong> uses only the white keys: C D E F G A B C.</p>',
        try: 'play the C major scale from C4 up to C5.',
        task: play(['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'], { done: 'That’s the C major scale.' }) },
      { text: '<p>Every major scale follows the same pattern of steps:</p><p><strong>whole, whole, half, whole, whole, whole, half</strong></p><p>In C major, the two half steps are E to F and B to C, where there’s no black key in between. Scales go down as well as up.</p>',
        try: 'play the C major scale going down, from C5 to C4.',
        task: play(['C5', 'B4', 'A4', 'G4', 'F4', 'E4', 'D4', 'C4'], { done: 'C major, going down.' }) },
      { text: '<p>That pattern, started on any note, makes a major scale. Starting on G, it needs one black key: <strong>G A B C D E F♯ G</strong>.</p>',
        try: 'play the G major scale from G3 up to G4.',
        task: play(['G3', 'A3', 'B3', 'C4', 'D4', 'E4', 'F♯4', 'G4'], { done: 'That’s G major: the same pattern, starting on G.' }) }
    ],
    learned: ['A major scale’s steps: whole, whole, half, whole, whole, whole, half', 'C major uses only the white keys', 'Major scales on other notes need black keys: G major has F♯'],
    practice: scalePractice()
  },
  {
    n: 8, unit: 'Steps, scales and chords', title: 'Intervals', sub: 'Counting the distance between two notes.',
    tools: ['keys', 'staff'],
    steps: [
      { text: '<p>An <strong>interval</strong> is the distance between two notes. To name it, count the letters from the lower note up to the higher one, counting both.</p><p>C up to E is C, D, E: three letters, so it’s a <strong>3rd</strong>.</p>',
        try: 'play C4, then E4.',
        task: play(['C4', 'E4'], { done: 'C up to E: a 3rd.' }) },
      { text: '<p>C up to G is C, D, E, F, G: a <strong>5th</strong>. C up to the next C is eight letters, called an <strong>octave</strong>. The two Cs sound alike, one higher than the other.</p>',
        try: 'play C4 then G4, then C4 then C5.',
        task: play(['C4', 'G4', 'C4', 'C5'], { done: 'C to G is a 5th, and C to C is an octave.' }) },
      { text: '<p>Next-door letters, like C and D, make a <strong>2nd</strong>. On the staff, a 2nd goes from a line to the space just above it. A 3rd goes from one line to the next line, or from one space to the next space.</p>',
        try: 'play a 2nd up from G4, then a 4th up from C4.',
        task: play(['G4', { n: 'A4', label: 'a 2nd up from G4' }, 'C4', { n: 'F4', label: 'a 4th up from C4' }], { done: 'G to A is a 2nd, and C to F (C D E F) is a 4th.' }) }
    ],
    learned: ['To name an interval, count the letters from the lower note to the higher one, counting both', 'C to E is a 3rd, C to G is a 5th, C to C is an octave', 'On the staff, line to next line (or space to next space) is a 3rd'],
    practice: intervalPractice()
  },
  {
    n: 9, unit: 'Steps, scales and chords', title: 'Chords', sub: 'Stacking every other note into a triad.',
    tools: ['keys', 'staff'],
    steps: [
      { text: '<p>A <strong>chord</strong> is three or more notes played together. The most common chord is a <strong>triad</strong>: start on a note, skip a white key, play the next one, skip one, play the next.</p><p>On a phone or tablet, use three fingers. On a computer, hold three letter keys, or click the keys quickly one after another.</p>',
        try: 'play C4, E4 and G4 together.',
        task: chords([{ label: 'C4 E4 G4', notes: ['C4', 'E4', 'G4'] }], { done: 'That’s a C chord: C, E and G.' }) },
      { text: '<p>A triad is named after its bottom note, called the <strong>root</strong>. F A C is an F chord, and G B D is a G chord. The other two notes are a 3rd and a 5th above the root.</p>',
        try: 'play an F chord (F4 A4 C5), then a G chord (G4 B4 D5).',
        task: chords([{ label: 'an F chord', notes: ['F4', 'A4', 'C5'] }, { label: 'a G chord', notes: ['G4', 'B4', 'D5'] }], { done: 'F chord, G chord: each named after its root.' }) },
      { text: '<p>C E G is a <strong>major</strong> chord: it sounds bright. Lower the middle note a half step, to E♭, and you get a <strong>minor</strong> chord, C E♭ G, which sounds darker.</p>',
        try: 'play C major (C4 E4 G4), then C minor (C4 E♭4 G4), and listen to the difference.',
        task: chords([{ label: 'C major', notes: ['C4', 'E4', 'G4'] }, { label: 'C minor', notes: ['C4', 'E♭4', 'G4'] }], { done: 'Major sounds bright; minor sounds darker.' }) }
    ],
    learned: ['A chord is three or more notes played together', 'A triad stacks every other note: the root, a 3rd and a 5th', 'Major sounds bright; minor, with its middle note a half step lower, sounds darker'],
    practice: chordPractice()
  },

  /* ---------------- Rhythm ---------------- */
  {
    n: 10, unit: 'Rhythm', title: 'Beat and tempo', sub: 'A steady beat, and what bpm means.',
    tools: ['metro'],
    steps: [
      { text: '<p>The <strong>beat</strong> is the steady pulse in music: the one you tap your foot or nod your head to. A metronome clicks on every beat, to help you keep time.</p>',
        try: 'set the metronome below to Steady, then press Start.',
        task: metroTask([{ label: 'Metronome set to Steady', test: function () { return timeSig === 1; } }, started], { done: 'That steady click is the beat.' }) },
      { text: '<p><strong>Tempo</strong> is how fast the beat goes. It’s measured in <strong>beats per minute</strong> (bpm). At 60 bpm there’s one beat every second, like a clock ticking.</p>',
        try: 'set the tempo to 60 bpm. Use − and +, or the slider.',
        task: metroTask([{ label: 'Tempo at 60 bpm', test: function () { return bpm === 60; } }, playing], { done: '60 bpm: one beat every second.' }) },
      { text: '<p>A higher number means a faster tempo. At 120 bpm the beats come twice as fast as at 60: two every second.</p><p>Tip: to find the tempo of music you’re listening to, tap the <strong>Tap</strong> button along with its beat.</p>',
        try: 'set the tempo to 120 bpm and hear the difference.',
        task: metroTask([{ label: 'Tempo at 120 bpm', test: function () { return bpm === 120; } }, playing], { done: '120 bpm: twice as fast as 60.' }) }
    ],
    learned: ['The beat is the steady pulse in music', 'Tempo is how fast the beat goes, in beats per minute (bpm)', '60 bpm is one beat a second; 120 bpm is two'],
    practice: tempoPractice()
  },
  {
    n: 11, unit: 'Rhythm', title: 'Note lengths', sub: 'Whole, half, quarter and eighth notes.',
    tools: ['keys', 'metro'],
    steps: [
      { text: '<p>A note’s shape tells you how long to hold it, counted in beats. In 4/4 time, the most common, a <strong>quarter note</strong> ' + NOTE('quarter') + ' lasts one beat.</p>',
        try: 'start the metronome, then play a key on each click: four quarter notes in a row.',
        task: tapsWithClicks(1, 4, 'Four notes, one on each click', 'Four quarter notes: one on each beat.') },
      { text: '<p>A <strong>half note</strong> ' + NOTE('half') + ' lasts two beats. A <strong>whole note</strong> ' + NOTE('whole') + ' lasts four.</p>',
        try: 'with the metronome playing, hold a key for 2 beats: press it on a click and let go two clicks later. Then hold one for 4 beats.',
        task: holdBeats() },
      { text: '<p>An <strong>eighth note</strong> ' + NOTE('eighth') + ' lasts half a beat, so two eighth notes fit in one beat. Musicians count them “1 and 2 and 3 and 4 and”.</p>',
        try: 'play two notes on every click: one on the click and one halfway to the next. Keep going for eight notes.',
        task: tapsWithClicks(2, 8, 'Eight notes, two on each click', 'Eight eighth notes: two on each beat.') }
    ],
    learned: ['When the beat is a quarter note (as in 4/4): a whole note lasts 4 beats, a half note 2, a quarter note 1, an eighth note ½', 'A note’s shape tells you how long to hold it', 'Two eighth notes fit in one beat'],
    practice: beatsPractice()
  },
  {
    n: 12, unit: 'Rhythm', title: 'Time signatures', sub: 'What 2/4, 3/4, 4/4 and 6/8 tell you.',
    tools: ['metro'],
    steps: [
      { text: '<p>Beats are grouped into <strong>bars</strong>, also called measures. A <strong>time signature</strong> at the start of the music tells you how: the <strong>top number</strong> is how many beats are in each bar, and the <strong>bottom number</strong> says which note gets one beat (4 means a quarter note).</p><p>4/4 has four quarter-note beats in each bar. 2/4 has two, like a march.</p>',
        try: 'set the metronome to 4/4 and press Start. The higher click marks beat 1 of each bar.',
        task: metroTask([{ label: 'Metronome set to 4/4', test: function () { return timeSig === 4; } }, started], { done: '1, 2, 3, 4: four beats in each bar.' }) },
      { text: '<p>In <strong>3/4</strong> there are three beats in each bar, so the higher click comes once every three beats, on beat 1. Waltzes are in 3/4.</p>',
        try: 'set the metronome to 3/4, press Start, and count “1, 2, 3” along with it.',
        task: metroTask([{ label: 'Metronome set to 3/4', test: function () { return timeSig === 3; } }, started], { done: '1, 2, 3: three beats in each bar.' }) },
      { text: '<p>In <strong>6/8</strong> the bottom number is 8, so an eighth note gets one beat, and there are six in each bar. They’re usually felt in two groups of three: “<strong>1</strong> 2 3 <strong>4</strong> 5 6”.</p>',
        try: 'set the metronome to 6/8 and count along to six.',
        task: metroTask([{ label: 'Metronome set to 6/8', test: function () { return timeSig === 6; } }, started], { done: '1 2 3 4 5 6: six eighth notes in each bar.' }) }
    ],
    learned: ['Top number: how many beats are in each bar', 'Bottom number: which note gets one beat (4 = a quarter note, 8 = an eighth note)', '3/4 has three beats in each bar; 6/8 has six eighth notes, felt in two groups of three'],
    practice: meterPractice()
  }
);

/* the lessons are all here: show whichever screen the page's address asks for */
lessonsReady();
