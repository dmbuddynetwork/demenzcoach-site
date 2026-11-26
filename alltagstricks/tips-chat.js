// Eingabeleiste unten wie auf der Startseite (gleiche Bauteile und Klassen wie translator.js, Stil aus einfach.css).
// Die Tipp-Seiten haben kein eigenes Eingabefeld: Abschicken legt den Satz im Browser ab (gleicher Weg wie nach der
// Anmeldung, sessionStorage „demenzCoachKiOffen“) und öffnet die Startseite, die ihn dort sofort beantwortet.
// Nichts geht an einen Server, bevor die Startseite die Antwort holt.
(function () {
  'use strict';
  if (!document.body.classList.contains('einfach') || document.querySelector('.translator-chat')) return;
  var make = function (tag, className, attributes) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    Object.keys(attributes || {}).forEach(function (name) { node.setAttribute(name, attributes[name]); });
    return node;
  };
  var field = make('input', 'translator-chat-input', { type: 'text', maxlength: '200', autocomplete: 'off', enterkeyhint: 'send', placeholder: 'Was ist passiert?', 'aria-label': 'Deine Situation' });
  var send = make('button', 'translator-chat-send', { type: 'submit' });
  send.textContent = 'Antwort finden';
  var form = make('form', 'translator-chat-form', { 'data-related-link': 'tips_chat' });
  form.append(field, send);
  var panel = make('div', 'translator-chat-panel');
  panel.append(form);
  var chat = make('aside', 'translator-chat translator-chat-in', { 'aria-label': 'Andere Situation beschreiben' });
  chat.append(panel);
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var text = field.value.trim() || (window.DcBeispiele ? window.DcBeispiele.current(field) : '');
    if (!text) { field.focus(); return; }
    try { sessionStorage.setItem('demenzCoachKiOffen', JSON.stringify({ text: text.slice(0, 200), until: Date.now() + 900000 })); } catch (e) { /* ohne Speicher öffnet die Startseite leer */ }
    location.href = '/de/';
  });
  var place = function () {
    var viewport = window.visualViewport;
    var inset = viewport ? Math.max(0, innerHeight - viewport.height - viewport.offsetTop) : 0;
    chat.style.bottom = inset ? inset + 'px' : '';
  };
  if (window.visualViewport) { visualViewport.addEventListener('resize', place); visualViewport.addEventListener('scroll', place); }
  document.body.append(chat);
  // Wechselnde Beispielsätze im leeren Feld, gleiche Liste wie auf der Startseite (/eingabe-beispiele.js).
  var examples = function () { window.DcBeispiele.attach(field, { prefix: 'z. B. ', maxChars: innerWidth < 480 ? 29 : 44 }); };
  if (window.DcBeispiele) examples();
  else { var script = make('script', '', { src: '/eingabe-beispiele.js' }); script.onload = examples; document.head.append(script); }
})();
