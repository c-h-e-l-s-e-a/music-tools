/* ---------- Feedback: a short form, sent by email through FormSubmit (formsubmit.co) ----------
   The same form as the learning games. */

/* Where feedback goes: set feedbackEmail in js/my-settings.js, not here. */
var FEEDBACK_TO = String((window.MY_SETTINGS && MY_SETTINGS.feedbackEmail) || '').trim();

(function () {
  var $ = function (id) { return document.getElementById(id); };
  var form = $('lf-fb-form'), send = $('lf-fb-send'), status = $('lf-fb-status');
  var sending = false;
  var MAX_PHOTOS = 3, MAX_TOTAL = 9.5 * 1024 * 1024;   /* FormSubmit takes 10 MB of attachments per message */
  var photos = [];                                      /* { file, url } for each photo, already shrunk */
  /* photos go in file inputs filled from script, which needs DataTransfer; very old browsers just don't offer photos */
  var canAttach = typeof DataTransfer === 'function' && typeof File === 'function';

  function say(text, kind) {
    status.textContent = text;
    status.className = 'lf-fb-status' + (kind ? ' ' + kind : '');
  }
  function ready() { return /^\S+@\S+$/.test(FEEDBACK_TO) || /^[a-f0-9]{20,}$/i.test(FEEDBACK_TO); }

  /* ---------- Device and browser: a best guess from this device, shown in the form so it can be changed ---------- */
  function guessDevice() {
    var ua = navigator.userAgent || '', touch = navigator.maxTouchPoints || 0, m;
    var ios = (m = /OS (\d+)_(\d+)/.exec(ua)) ? ' (iOS ' + m[1] + '.' + m[2] + ')' : '';
    if (/iPhone/.test(ua)) return 'iPhone' + ios;
    if (/iPad/.test(ua) || (/Macintosh/.test(ua) && touch > 1)) return 'iPad' + ios;
    if (/Android/.test(ua)) return (/Mobile/.test(ua) ? 'Android phone' : 'Android tablet') +
      ((m = /Android (\d+)/.exec(ua)) ? ' (Android ' + m[1] + ')' : '');
    if (/CrOS/.test(ua)) return 'Chromebook';
    if (/Macintosh/.test(ua)) return 'Mac';
    if (/Windows/.test(ua)) return 'Windows computer';
    if (/Linux/.test(ua)) return 'Linux computer';
    return '';
  }
  function guessBrowser() {
    var ua = navigator.userAgent || '', m;
    function v(re) { return (m = re.exec(ua)) ? ' ' + m[1] : ''; }
    if (/EdgiOS|Edg\//.test(ua)) return 'Edge' + v(/(?:EdgiOS|Edg)\/(\d+)/);
    if (/FxiOS|Firefox\//.test(ua)) return 'Firefox' + v(/(?:FxiOS|Firefox)\/(\d+)/);
    if (/SamsungBrowser/.test(ua)) return 'Samsung Internet' + v(/SamsungBrowser\/(\d+)/);
    if (/OPR\/|OPiOS/.test(ua)) return 'Opera' + v(/(?:OPR|OPiOS)\/(\d+)/);
    if (/CriOS|Chrome\//.test(ua)) return 'Chrome' + v(/(?:CriOS|Chrome)\/(\d+)/);
    if (/Safari\//.test(ua) && /Version\//.test(ua)) return 'Safari' + v(/Version\/(\d+(?:\.\d+)?)/);
    return '';
  }

  /* ---------- Photos: shrunk on this device to a JPEG at most 1600 px across, so a few fit easily ---------- */
  function shrink(file) {
    return new Promise(function (resolve) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var s = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight)),
          w = Math.max(1, Math.round(img.naturalWidth * s)), h = Math.max(1, Math.round(img.naturalHeight * s));
        var c = document.createElement('canvas'), x = c.getContext('2d');
        c.width = w; c.height = h;
        x.fillStyle = '#fff'; x.fillRect(0, 0, w, h);   /* screenshots with see-through parts get a white background */
        x.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) { resolve(b ? new File([b], 'photo.jpg', { type: 'image/jpeg' }) : null); }, 'image/jpeg', 0.82);
      };
      img.onerror = function () { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    });
  }
  function renderPhotos() {
    var box = $('lf-fb-thumbs');
    box.textContent = '';
    photos.forEach(function (p, i) {
      var cell = document.createElement('div'), img = document.createElement('img'), x = document.createElement('button');
      cell.className = 'lf-fb-thumb';
      img.src = p.url; img.alt = 'Photo ' + (i + 1);
      x.type = 'button'; x.className = 'lf-fb-remove'; x.id = 'lf-fb-remove-' + i; x.dataset.remove = i;
      x.setAttribute('aria-label', 'Remove photo ' + (i + 1)); x.textContent = '✕';
      cell.appendChild(img); cell.appendChild(x); box.appendChild(cell);
    });
    box.hidden = !photos.length;
    $('lf-fb-add').hidden = !canAttach || photos.length >= MAX_PHOTOS;
    $('lf-fb-files').disabled = !canAttach || photos.length >= MAX_PHOTOS;
  }
  $('lf-fb-files').addEventListener('change', function () {
    var picked = Array.prototype.slice.call(this.files || []), room = MAX_PHOTOS - photos.length, input = this;
    if (!picked.length) return;
    var extra = picked.length > room;
    picked = picked.slice(0, room);
    say('Getting your photos ready…', 'note');
    Promise.all(picked.map(shrink)).then(function (files) {
      var bad = 0, total = photos.reduce(function (n, p) { return n + p.file.size; }, 0);
      files.forEach(function (f) {
        if (!f) { bad++; return; }
        if (total + f.size > MAX_TOTAL) { bad++; return; }
        total += f.size;
        photos.push({ file: new File([f], 'photo-' + (photos.length + 1) + '.jpg', { type: 'image/jpeg' }), url: URL.createObjectURL(f) });
      });
      input.value = '';
      renderPhotos();
      say(bad ? 'One of those couldn’t be added. Try a screenshot or a different photo.' :
        extra ? 'Only ' + MAX_PHOTOS + ' photos fit, so the first ones were added.' : '', bad ? 'bad' : extra ? 'note' : '');
    });
  });
  $('lf-fb-thumbs').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-remove]');
    if (!b) return;
    var i = Number(b.dataset.remove);
    URL.revokeObjectURL(photos[i].url);
    photos.splice(i, 1);
    renderPhotos();
    var next = $('lf-fb-remove-' + Math.min(i, photos.length - 1));
    (next || $('lf-fb-files')).focus({ preventScroll: true });
  });

  /* ---------- Sending ---------- */
  function sendText(body) {
    /* no photos: sent from this page, so you never leave it */
    fetch('https://formsubmit.co/ajax/' + FEEDBACK_TO, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (r) { return r.json(); }).then(function (d) {
      if (d && (d.success === true || d.success === 'true')) {
        form.reset();
        $('lf-fb-device').value = guessDevice(); $('lf-fb-browser').value = guessBrowser();
        say('Thank you! Your message is on its way.', 'good');
      } else {
        /* before the form is activated, FormSubmit explains what to do; show that to whoever is testing */
        say('The message didn’t send.' + (d && d.message ? ' ' + d.message : ' Please try again later.'), 'bad');
      }
    }).catch(function () {
      say('The message didn’t send. Check that you’re online, then try again.', 'bad');
    }).then(function () {
      sending = false;
      send.disabled = false;
      send.textContent = 'Send';
    });
  }
  function sendWithPhotos(body) {
    /* photos: FormSubmit takes attachments through an ordinary form post, so the page goes to FormSubmit
       (which may ask "I'm not a robot") and then comes back here with #feedback-sent */
    var f = document.createElement('form');
    f.method = 'POST'; f.enctype = 'multipart/form-data'; f.hidden = true;
    f.action = 'https://formsubmit.co/' + FEEDBACK_TO;
    body._next = location.href.split('#')[0] + '#feedback-sent';
    Object.keys(body).forEach(function (k) {
      var i = document.createElement('input');
      i.type = 'hidden'; i.name = k; i.value = body[k];
      f.appendChild(i);
    });
    photos.forEach(function (p, n) {
      var i = document.createElement('input'), dt = new DataTransfer();
      i.type = 'file'; i.name = 'photo' + (n + 1);
      dt.items.add(p.file); i.files = dt.files;
      f.appendChild(i);
    });
    document.body.appendChild(f);
    f.submit();
  }
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (sending || !ready()) return;
    var message = $('lf-fb-message').value.trim(), name = $('lf-fb-name').value.trim(), email = $('lf-fb-email');
    var device = $('lf-fb-device').value.trim(), browser = $('lf-fb-browser').value.trim();
    if (!message) { say('Please write a message first.', 'bad'); $('lf-fb-message').focus(); return; }
    if (email.value.trim() && !email.checkValidity()) {
      say('That email address doesn’t look right. Check it, or leave it blank.', 'bad'); email.focus(); return;
    }
    var body = {
      _subject: 'Vocal Range Piano feedback' + (name ? ' from ' + name : ''),
      _template: 'table',
      _honey: $('lf-fb-trap').value,
      message: message,
      page: location.href.split('#')[0]
    };
    /* the optional fields only when filled in: FormSubmit uses the email for its Reply button */
    if (name) body.name = name;
    if (email.value.trim()) body.email = email.value.trim();
    if (device) body.device = device;
    if (browser) body.browser = browser;
    if (photos.length) body.photos = String(photos.length);
    sending = true;
    send.disabled = true;
    send.textContent = 'Sending…';
    say(photos.length ? 'Sending… you may be asked to tick “I’m not a robot”, then you’ll come back here.' : '', photos.length ? 'note' : '');
    if (photos.length) sendWithPhotos(body); else sendText(body);
  });

  /* ---------- When the page opens ---------- */
  send.disabled = !ready();
  $('lf-fb-device').value = guessDevice();
  $('lf-fb-browser').value = guessBrowser();
  if (!canAttach) $('lf-fb-add').parentNode.hidden = true;
  renderPhotos();
  if (location.hash === '#feedback-sent') {
    /* back from FormSubmit after sending with photos */
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
    say('Thank you! Your message and photos are on their way.', 'good');
  } else if (!ready()) {
    say('Sending isn’t switched on yet, so this form can’t send messages.', 'note');
  }
})();
