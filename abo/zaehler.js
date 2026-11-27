// Kauf-Trichter ohne Einwilligung (Thread „Kauf-Trichter richtig messen“, 27. Nov 2026): wie der Schrittzähler in start/start.js.
// Der Server zählt nur Schritt und Tag hoch (backend/quiz-counter.mjs, feste Liste „<weg>_<stufe>“). Nichts wird im Browser
// gespeichert, nichts wird als Kennung, Quelle oder Antwort gesendet. Testläufe (?src=test, utm_source=test) und eigene
// Geräte (Merkzeichen von /intern/, nur gelesen) zählen nicht.
// Nutzung: DemenzZaehler.once("lp_cta") zählt je Seitenaufruf höchstens einmal, DemenzZaehler.count("lp_view") jedes Mal.
(function () {
  var params = new URLSearchParams(location.search);
  var test = [params.get("src"), params.get("utm_source")].some(function (value) { return String(value || "").trim().toLowerCase() === "test"; });
  var internal = false;
  try { internal = localStorage.getItem("demenzcoach.internal.v1") === "1"; } catch (e) { /* privater Modus */ }
  var gate = (window.DEMENZ_ABO_CONFIG && window.DEMENZ_ABO_CONFIG.translatorGate && window.DEMENZ_ABO_CONFIG.translatorGate.endpoint) || "";
  var endpoint = String(gate).replace(/\/v1\/translator-web$/, "") + "/v1/quiz-count";
  var counted = {};
  function count(step) {
    if (test || internal || !/^https:/.test(endpoint) || !/^[a-z_]{2,40}$/.test(String(step))) return;
    try {
      fetch(endpoint, { method: "POST", body: JSON.stringify({ step: step }), keepalive: true,
        credentials: "omit", referrerPolicy: "no-referrer", headers: { "Content-Type": "text/plain" } }).catch(function () {});
    } catch (e) { /* Zählen darf die Seite nie stören */ }
  }
  function once(step) {
    if (counted[step]) return;
    counted[step] = true;
    count(step);
  }
  window.DemenzZaehler = Object.freeze({ count: count, once: once, test: test || internal });
})();
