/* ---------- Tuner: listens through the microphone, then adds the note to the staff's trail and lights its key ----------
   Uses the keyboard's sound engine and note helpers (piano.js), the staff (staff.js) and detectPitch (pitch.js). */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var card = $('tuner'), btn = $('tnBtn'), statusEl = $('tnStatus'), noteEl = $('tnNote'), freqEl = $('tnFreq'),
    needle = $('tnNeedle'), verdict = $('tnVerdict'), levelEl = $('tnLevel'), scroller = $('pianoScroll');

  var IN_TUNE = 10;          /* within 10 cents of the note counts as in tune */
  var EVERY = 40;            /* check the sound every 40 ms */
  var LET_GO = 1000;         /* one second after the note stops, the key goes dark (the staff's trail clears a little later) */
  var STUCK_AFTER = 1500;    /* no new sound at all from the microphone for this long (ms) means the sound engine has paused */
  var IDLE = 'Sing or play a note, and it shows on the staff and the keyboard.';
  var LISTENING = 'Listening… sing or play a note.';

  var listening = false, stream = null, source = null, analyser = null, sink = null, buf = null, raf = 0, lastRun = 0;
  var recent = [], heldNote = null, heldCount = 0, shown = null, cents = 0, quietSince = 0, litKey = null, rangeNote = '';
  var touchedKeysAt = 0, onStaff = null;   /* the note this tuner has put on the staff and is still holding */
  var level = 0, lastSig = NaN, sameSince = 0, stuck = false, lastNudge = 0;

  function say(text) { statusEl.textContent = text; }
  function pretty(m) { return midiToStr(m).replace('#', '♯'); }
  function median(a) { var s = a.slice().sort(function (x, y) { return x - y; }); return s[s.length >> 1]; }

  /* ---------- Starting and stopping ----------
     Safari (Mac, iPhone and iPad) feeds the tuner silence unless the sound engine is started inside the tap,
     before the microphone is asked for. Asking takes a moment, and by then the tap no longer counts.
     Safari can also pause the engine as the microphone starts, so it's started again once the microphone is on. */
  function start() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      say('This browser can’t use the microphone here. The tuner needs a secure (https) page, like your GitHub Pages site.');
      return;
    }
    setSoundMode('play-and-record');   /* iPhone and iPad: the microphone needs this sound setting */
    freshSound();                      /* a fresh engine, made in that setting (one made before can stop when the microphone starts) */
    primeSound(AC);                    /* and started now, inside the tap */
    btn.disabled = true;
    say('Waiting for the microphone…');
    /* the voice clean-up made for calls changes the sound, so it's switched off for accurate pitch */
    navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
      .then(function (s) {
        stream = s;
        attach(AC);
        if (AC.state !== 'running') AC.resume().catch(function () {});
        /* if the device takes the microphone away (a phone call, another app), stop and say so */
        s.getAudioTracks().forEach(function (t) {
          t.addEventListener('ended', function () {
            if (listening && stream === s) stop('The microphone was turned off. Tap Start listening to carry on.');
          });
        });
        listening = true;
        stuck = false; sameSince = 0; lastSig = NaN;
        btn.disabled = false;
        btn.classList.add('active');
        btn.innerHTML = '<span aria-hidden="true">■</span> Stop listening';
        card.classList.add('on');
        stayAwake('tuner', true);                 /* keep the screen on (js/awake.js) */
        setFoldStatus('tuner', 'Listening');     /* shown in the heading if the section is folded */
        say(LISTENING);
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
    if (sink) sink.disconnect();
    if (stream) stream.getTracks().forEach(function (t) { t.stop(); });   /* releases the microphone */
    stream = source = analyser = sink = null;
    setSoundMode('playback');
    letGo();
    stuck = false; level = 0;
    levelEl.style.width = '0';
    noteEl.textContent = '—';
    btn.classList.remove('active');
    btn.innerHTML = '<span aria-hidden="true">🎤</span> Start listening';
    card.classList.remove('on');
    stayAwake('tuner', false);
    setFoldStatus('tuner', '');
    say(message || IDLE);
  }

  /* the microphone feeds a sound analyser on the shared engine. The analyser is connected on to the speakers
     through a volume of zero: that plays nothing (so the microphone is never heard), but it keeps Safari working on it */
  function attach(ac) {
    if (source) source.disconnect();
    if (sink) sink.disconnect();
    source = ac.createMediaStreamSource(stream);
    analyser = ac.createAnalyser();
    analyser.fftSize = 2048;   /* about 43 ms of sound: enough for two cycles of the lowest note, E2 */
    sink = ac.createGain();
    sink.gain.value = 0;
    source.connect(analyser); analyser.connect(sink); sink.connect(ac.destination);
    buf = new Float32Array(analyser.fftSize);
    lastSig = NaN; sameSince = 0;
  }
  /* if a tap starts a fresh sound engine while listening, move the microphone over to it */
  onFreshSound.push(function (ac) { if (listening && stream) attach(ac); });

  /* ---------- When the engine pauses ----------
     A microphone never sends exactly the same sound twice, so the same reading over and over (or none) means the
     engine has paused. It's nudged once a second; if that doesn't work, the next tap anywhere starts a fresh one. */
  function getStuck() {
    stuck = true;
    letGo();
    say('The tuner isn’t getting any sound. Tap anywhere on the page to wake it.');
  }
  function unstick() {
    stuck = false;
    say(LISTENING);
  }
  function wakeIfStuck() {
    if (!listening || !stuck) return;
    freshSound();      /* the microphone moves over to it (see attach above) */
    primeSound(AC);
    sameSince = 0;
  }
  document.addEventListener('pointerdown', wakeIfStuck, true);
  document.addEventListener('keydown', wakeIfStuck, true);

  /* ---------- Listening ---------- */
  function tick(now) {
    if (!listening) return;
    raf = requestAnimationFrame(tick);
    if (now - lastRun < EVERY) return;
    lastRun = now;
    analyser.getFloatTimeDomainData(buf);

    /* how loud it is, for the "Hearing" bar, and a fingerprint of this reading to tell whether sound is arriving */
    var sq = 0;
    for (var i = 0; i < buf.length; i++) sq += buf[i] * buf[i];
    var rms = Math.sqrt(sq / buf.length), sig = sq + buf[0] + buf[buf.length >> 1];
    var db = rms > 0 ? 20 * Math.log10(rms) : -100;          /* -60 dB (very quiet) to -10 dB (loud) fills the bar */
    level = Math.max(Math.min(1, Math.max(0, (db + 60) / 50)), level * 0.8);
    levelEl.style.width = (level * 100).toFixed(1) + '%';

    if (AC.state === 'running' && sig !== lastSig) {
      sameSince = 0;
      if (stuck) unstick();
    } else {
      if (!sameSince) sameSince = now;
      if (now - sameSince > STUCK_AFTER && !stuck) getStuck();
      if (now - lastNudge > 1000) { lastNudge = now; AC.resume().catch(function () {}); }
    }
    lastSig = sig;
    if (sameSince) return;   /* nothing new to listen to */

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
