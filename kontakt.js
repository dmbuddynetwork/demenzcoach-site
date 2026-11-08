// Kontaktformular: sendet Name, E-Mail, Thema und Nachricht an die Funktion contactForm (Firebase, europe-west1).
// Nichts wird im Browser gespeichert. Fällt die Funktion aus, steht die E-Mail-Adresse in der Fehlermeldung.
(function () {
  "use strict";
  var endpoint = "https://europe-west1-dementica-df17b.cloudfunctions.net/contactForm/v1/contact";
  var mail = "debby@dementiacoachapp.com";
  var form = document.getElementById("kontakt-form");
  if (!form) return;
  var status = document.getElementById("kontakt-status");
  var button = document.getElementById("kontakt-send");
  var english = (document.documentElement.getAttribute("lang") || "de").slice(0, 2) === "en";
  var texts = english ? {
    sending: "Sending …",
    ok: "Thank you, your message has arrived. We will reply by email.",
    missing: "Please fill in your name, email address and message (at least 10 characters) and tick the box for the privacy information.",
    limited: "Many messages came in just now. Please try again in a few minutes or write to " + mail + ".",
    error: "Sending did not work, sorry. Please write directly to " + mail + "."
  } : {
    sending: "Wird gesendet …",
    ok: "Danke, deine Nachricht ist angekommen. Wir antworten dir per E-Mail.",
    missing: "Bitte fülle Name, E-Mail-Adresse und Nachricht aus (mindestens 10 Zeichen) und setze das Häkchen bei den Datenschutz-Hinweisen.",
    limited: "Es kamen gerade sehr viele Nachrichten. Bitte versuche es in ein paar Minuten noch einmal oder schreibe an " + mail + ".",
    error: "Das Senden hat leider nicht geklappt. Bitte schreibe direkt an " + mail + "."
  };
  function show(state, text) {
    status.hidden = false;
    status.setAttribute("data-state", state);
    status.textContent = text;
  }
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var data = new FormData(form);
    var body = {
      name: String(data.get("name") || "").trim(),
      email: String(data.get("email") || "").trim(),
      topic: String(data.get("topic") || "sonstiges"),
      message: String(data.get("message") || "").trim(),
      website: String(data.get("website") || ""),
      privacyNoticeRead: Boolean(data.get("privacy"))
    };
    if (body.name.length < 2 || body.email.indexOf("@") < 1 || body.message.length < 10 || !body.privacyNoticeRead) {
      show("error", texts.missing);
      return;
    }
    button.disabled = true;
    show("sending", texts.sending);
    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "omit",
      referrerPolicy: "no-referrer"
    }).then(function (response) {
      if (response.ok) {
        form.reset();
        show("ok", texts.ok);
      } else if (response.status === 429) {
        show("error", texts.limited);
      } else if (response.status === 400) {
        show("error", texts.missing);
      } else {
        show("error", texts.error);
      }
    }).catch(function () {
      show("error", texts.error);
    }).then(function () {
      button.disabled = false;
    });
  });
})();
