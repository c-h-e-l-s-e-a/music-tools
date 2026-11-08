/* ---------- Footer: the name after "© 2026" comes from js/my-settings.js ----------
   Without that file, or with the name left blank, the line just reads "© 2026". */
(function () {
  var who = String((window.MY_SETTINGS && MY_SETTINGS.name) || '').trim();
  var line = document.getElementById('lf-copy');
  if (line) line.textContent = '© 2026' + (who ? ' ' + who : '');
})();
