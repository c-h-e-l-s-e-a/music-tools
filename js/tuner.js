/* ---------- Tuner: listens through the microphone, then adds the note to the staff's trail and lights its key ----------
   Uses the keyboard's sound engine and note helpers (piano.js), the staff (staff.js) and detectPitch (pitch.js). */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var card = $('tuner'), btn = $('tnBtn'), statusEl = $('tnStatus'), noteEl = $('tnNote'), freqEl = $('tnFreq'),
    needle = $('tnNeedle'), verdict = $('tnVerdict'), scroller = $('pianoScroll');

  var IN_TUNE = 10;          /* within 10 cents of the note counts as in tune */
  var EVERY = 40;            /* check the sound every 40 ms */
  var LET_GO = 1000;         /* one second after the note stops, the key goes dark (the staff's trail clears a little later) */
  var IDLE = 'Sing or play a note, and it shows on the staff and the keyboard.';

  var listening = false, stream = null, source = null, analyser = null, buf = null, raf = 0, lastRun = 0;
  var recent = [], heldNote = null, heldCount = 0, shown = null, cents = 0, quietSince = 0, litKey = null, rangeNote = '';
  var touchedKeysAt = 0, onStaff = null;   /* the note this tuner has put on the staff and is still holding */

  function say(text) { statusEl.textContent = text; }
  function pretty(m) { return midiToStr(m).replace('#', '♯'); }
  function median(a) { var s = a.slice().sort(function (x, y) { return x - y; }); return s[s.length >> 1]; }

  /* ---------- Starting and stopping ---------- */
  function start() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      say('This browser can’t use the microphone here. The tuner needs a secure (https) page, like your GitHub Pages site.');
      return;
    }
    setSoundMode('play-and-record');   /* iPhone and iPad: the microphone needs this sound setting */
    var ac = wakeSound();   /* started inside the tap, which iPhones and iPads require */
    btn.disabled = true;
    say('Waiting for the microphone…');
    /* the voice clean-up made for calls changes the sound, so it's switched off for accurate pitch */
    navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
      .then(function (s) {
        stream = s;
        attach(AC);
        listening = true;
        btn.disabled = false;
        btn.classList.add('active');
        btn.innerHTML = '<span aria-hidden="true">■</span> Stop listening';
        card.classList.add('on');
        stayAwake('tuner', true);                 /* keep the screen on (js/awake.js) */
        setFoldStatus('tuner', 'Listening');     /* shown in the heading if the section is folded */
        say('Listening… sing or play a note.');
        raf = requestAnimationFrame(tick);
      })
      .catch(function (e) {
        btn.disabled = false;
        setSoundMode('playback');
        var name = e && e.name;
        say(name === 'NotAllowedError' || name === 'SecurityError'
          ? 'The microphone is blocked for this page. Allow it in your browser’s settings for this site, then tap Start listening again.'
          : name === 'NotFoundError' ? 'No microphone was found on this device.'
          : 'The microphone couldn’t start. Close other apps that might be using it, then try again.');
      });
  }

  function stop(message) {
    listening = false;
    cancelAnimationFrame(raf);
    if (source) source.disconnect();
    if (stream) stream.getTracks().forEach(function (t) { t.stop(); });   /* releases the microphone */
    stream = source = analyser = null;
    setSoundMode('playback');
    letGo();
    noteEl.textContent = '—';
    btn.classList.remove('active');
    btn.innerHTML = '<span aria-hidden="true">🎤</span> Start listening';
    card.classList.remove('on');
    stayAwake('tuner', false);
    setFoldStatus('tuner', '');
    say(message || IDLE);
  }

  /* the microphone feeds a sound analyser on the shared engine */
  function attach(ac) {
    if (source) source.disconnect();
    source = ac.createMediaStreamSource(stream);
    analyser = ac.createAnalyser();
    analyser.fftSize = 2048;   /* about 43 ms of sound: enough for two cycles of the lowest note, E2 */
    source.connect(analyser);  /* not connected to the speakers, so the microphone is never played back */
    buf = new Float32Array(analyser.fftSize);
  }
  /* if a tap starts a fresh sound engine while listening, move the microphone over to it */
  onFreshSound.push(function (ac) { if (listening && stream) attach(ac); });

  /* ---------- Listening ---------- */
  function tick(now) {
    if (!listening) return;
    raf = requestAnimationFrame(tick);
    if (now - lastRun < EVERY) return;
    lastRun = now;
    analyser.getFloatTimeDomainData(buf);
    var r = detectPitch(buf, AC.sampleRate, { minF: 60, maxF: 1600 });
    if (!r) return quiet(now);
    quietSince = 0;

    /* the middle of the last three readings, so a single odd reading (or a metronome click) is ignored */
    recent.push(69 + 12 * Math.log2(r.freq / 440));
    if (recent.length > 3) recent.shift();
    if (recent.length < 2) return;
    var m = median(recent), note = Math.round(m), c = (m - note) * 100;

    /* a new note has to hold for two readings before it shows */
    if (note === heldNote) heldCount++; else { heldNote = note; heldCount = 1; }
    if (note !== shown) {
      if (heldCount < 2) return;
      shown = note;
      cents = c;
      showNote(note);
    } else {
      cents = cents * 0.6 + c * 0.4;   /* smooth the needle */
    }
    showTuning(m);
  }

  function quiet(now) {
    recent.length = 0;
    heldNote = null; heldCount = 0;
    if (!quietSince) quietSince = now;
    if (shown !== null && now - quietSince > LET_GO) {
      letGo();
      say('Listening… sing or play a note.');
    }
  }

  /* ---------- Showing it ---------- */
  function showNote(note) {
    if (litKey) litKey.classList.remove('heard', 'in-tune');
    litKey = null;
    noteEl.textContent = pretty(note);
    card.classList.add('has-note');
    offStaff();
    if (note >= START && note <= END) {
      rangeNote = '';
      staffPress(note);   /* onto the staff's trail (js/staff.js) */
      onStaff = note;
      litKey = keyEls[note];
      litKey.classList.add('heard');
      bringIntoView(litKey);
      say('Listening…');
    } else {
      rangeNote = note < START ? 'below the keyboard' : 'above the keyboard';
      say('That note is ' + rangeNote + ' (E2 to C6).');
    }
  }

  function showTuning(m) {
    var inTune = Math.abs(cents) <= IN_TUNE, rc = Math.round(cents);
    freqEl.textContent = (440 * Math.pow(2, (m - 69) / 12)).toFixed(1) + ' Hz';
    needle.style.left = (50 + Math.max(-50, Math.min(50, cents))) + '%';
    card.classList.toggle('in-tune', inTune);
    if (litKey) litKey.classList.toggle('in-tune', inTune);
    verdict.textContent = inTune ? 'In tune' : Math.abs(rc) + ' cents ' + (rc < 0 ? 'flat' : 'sharp');
  }

  /* the note stops sounding as far as the staff is concerned; it stays in the trail until that clears */
  function offStaff() {
    if (onStaff !== null) { staffRelease(onStaff); onStaff = null; }
  }

  /* the key goes dark and the meter empties */
  function letGo() {
    offStaff();
    if (litKey) litKey.classList.remove('heard', 'in-tune');
    litKey = null; shown = null; heldNote = null; heldCount = 0; recent.length = 0;
    card.classList.remove('has-note', 'in-tune');
    noteEl.textContent = '—';
    freqEl.textContent = '';
    verdict.textContent = '';
  }

  /* scroll the keyboard so the key is in view, unless someone has just been scrolling or playing it */
  function bringIntoView(el) {
    if (Date.now() - touchedKeysAt < 2500) return;
    var left = el.offsetLeft, right = left + el.offsetWidth, view = scroller.scrollLeft, w = scroller.clientWidth;
    if (left < view + 8 || right > view + w - 8) {
      scroller.scrollTo({ left: left - (w - el.offsetWidth) / 2, behavior: 'smooth' });
    }
  }
  ['touchstart', 'pointerdown', 'wheel'].forEach(function (type) {
    scroller.addEventListener(type, function () { touchedKeysAt = Date.now(); }, { passive: true });
  });

  btn.addEventListener('click', function () { if (listening) stop(); else start(); });
  /* let go of the microphone when you switch apps or tabs */
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && listening) stop('Stopped listening when you left the page. Tap Start listening to carry on.');
  });
  say(IDLE);
})();
