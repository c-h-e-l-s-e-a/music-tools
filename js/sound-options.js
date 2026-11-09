/* ---------- Sound options: the keyboard's sound, the metronome's sound and its volume ----------
   The choices are the options in the two menus in index.html. They're remembered on this device,
   and changing one plays a short sample so you can hear it. */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var keyMenu = $('keySound'), clickMenu = $('clickSound'), volume = $('clickVolume');

  function load(name) { try { return localStorage.getItem(name); } catch (e) { return null; } }
  function save(name, value) { try { localStorage.setItem(name, value); } catch (e) {} }
  function offered(menu, value) { return Array.prototype.some.call(menu.options, function (o) { return o.value === value; }); }

  /* what was chosen last time, if it's still one of the options */
  var k = load('vrp-key-sound'), c = load('vrp-click-sound'), v = Number(load('vrp-click-volume'));
  if (k && offered(keyMenu, k)) keySound = k;
  if (c && offered(clickMenu, c)) clickSound = c;
  if (load('vrp-click-volume') !== null && v >= 0 && v <= 100) clickVolume = v / 100;
  keyMenu.value = keySound;
  clickMenu.value = clickSound;
  volume.value = Math.round(clickVolume * 100);

  keyMenu.addEventListener('change', function () {
    keySound = keyMenu.value;
    save('vrp-key-sound', keySound);
    wakeSound();
    playFreq(261.63);   /* middle C */
  });

  function sampleClick() {
    var ac = wakeSound();
    playClick(ac.currentTime + 0.02, true);
    playClick(ac.currentTime + 0.42, false);
  }
  clickMenu.addEventListener('change', function () {
    clickSound = clickMenu.value;
    save('vrp-click-sound', clickSound);
    if (!metroOn) sampleClick();   /* while it's running you hear the new sound on the next beat */
  });

  volume.addEventListener('input', function () { clickVolume = Number(volume.value) / 100; });
  volume.addEventListener('change', function () {
    save('vrp-click-volume', volume.value);
    if (!metroOn) sampleClick();
  });
})();
