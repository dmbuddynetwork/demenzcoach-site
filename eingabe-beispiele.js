// Wechselnde Beispiele im Eingabefeld (Daniel, 26. Nov): Im leeren Feld tippt sich langsam ein Beispielsatz,
// bleibt stehen und wird vom nächsten abgelöst. So sieht man, was man eingeben kann.
// Eine Liste für alle Eingabefelder (Startseite, untere Leiste, Tipp-Seiten): window.DcBeispiele.attach(feld, optionen).
// Schalter: feld.dataset.dcBeispiele = 'off' hält die Animation an (dann gilt der normale Platzhalter).
(function () {
  'use strict';
  if (window.DcBeispiele) return;
  var EXAMPLES = [
    'Mama will nach Hause.',
    'Papa fragt nach seiner Frau.',
    'Sie will nicht duschen.',
    'Er sagt: „Ich habe schon gegessen.“',
    'Sie sucht ihren Hund.',
    'Er will nachts aufstehen.',
    'Mama sagt: „Du hast mein Geld gestohlen.“',
    'Papa nimmt seine Tabletten nicht.',
    'Sie fragt immer wieder dasselbe.',
    'Er erkennt mich nicht mehr.'
  ];
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var TYPE_MS = 70;      // pro Buchstabe: langsam genug zum Mitlesen
  var HOLD_MS = 3200;    // fertiger Satz bleibt stehen
  var GAP_MS = 500;      // kurze Pause vor dem nächsten

  function attach(field, options) {
    if (!field || field.dataset.dcBeispieleAktiv) return;
    var opts = options || {};
    var prefix = opts.prefix || '';
    var maxChars = opts.maxChars || 0;
    var list = EXAMPLES.filter(function (text) { return !maxChars || (prefix + text).length <= maxChars; });
    if (!list.length) return;
    field.dataset.dcBeispieleAktiv = '1';
    var index = Math.floor(Math.random() * list.length);
    var timer = 0;
    var running = false;
    var off = function () { return field.dataset.dcBeispiele === 'off' || field.value !== '' || document.hidden; };
    var schedule = function (fn, ms) { clearTimeout(timer); timer = setTimeout(fn, ms); };
    var next = function () { index = (index + 1) % list.length; };
    var tick = function () {
      if (off()) { running = false; return; }
      var text = prefix + list[index];
      field.dataset.dcBeispielText = list[index];
      var shown = 0;
      var type = function () {
        if (off()) { running = false; return; }
        shown += 1;
        field.setAttribute('placeholder', text.slice(0, shown));
        if (shown < text.length) schedule(type, TYPE_MS);
        else schedule(function () { next(); schedule(tick, GAP_MS); }, HOLD_MS);
      };
      if (reduce) {
        // Ohne Bewegung: ganzer Satz auf einmal, Wechsel alle 5 Sekunden.
        field.setAttribute('placeholder', text);
        schedule(function () { next(); tick(); }, HOLD_MS + 1800);
        return;
      }
      type();
    };
    var start = function () {
      if (running && !off()) return;
      running = true;
      tick();
    };
    // Wieder anschalten, wenn das Feld leer wird oder der Schalter zurückspringt.
    field.addEventListener('input', function () { if (field.value === '') start(); });
    document.addEventListener('visibilitychange', function () { if (!document.hidden) start(); });
    new MutationObserver(function () { if (!off()) start(); }).observe(field, { attributes: true, attributeFilter: ['data-dc-beispiele'] });
    start();
  }

  // Leeres Feld + Absenden: das gerade gezeigte Beispiel gilt als Eingabe (Daniel, 26. Nov). Leer, wenn die Animation aus ist.
  function current(field) {
    if (!field || field.dataset.dcBeispiele === 'off' || field.value.trim() !== '') return '';
    return field.dataset.dcBeispielText || '';
  }

  window.DcBeispiele = { attach: attach, current: current, examples: EXAMPLES };
  document.dispatchEvent(new Event('dc-beispiele-ready'));
})();
