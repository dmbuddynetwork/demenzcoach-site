// Freigabe der KI-Antworten im Web-Übersetzer (Daniels Wahl 8. Nov: „1 gratis, dann Probezeit“).
//
// Bekannte Sätze beantwortet der Übersetzer im Browser, die bleiben immer kostenlos. Nur eigene Sätze,
// die an die KI gehen, zählen: Ohne Abo gibt es eine kostenlose KI-Antwort pro Browser, danach zeigt die
// Seite die Angebotskarte; sie führt in den Fragebogen (/start/), danach Angebot mit 7 Tagen kostenlos. Mit Web-Abo (dasselbe Firebase-Konto wie die App,
// GET /entitlement) gibt es unbegrenzt Antworten.
//
// Aus, solange DEMENZ_ABO_CONFIG.translatorGate.enabled nicht true ist: Dann ändert sich am Übersetzer
// nichts. Einschalten erst zusammen mit dem Go-live der Web-Kasse (docs/WEB_CHECKOUT.md).
//
// Die Zählung liegt nur in diesem Browser (localStorage). Der eingegebene Satz wird nie gesendet und nur
// für die Rückkehr nach der Kasse in diesem Tab gemerkt (sessionStorage).
//
// Einbau im Übersetzer: /abo/abo-config.js und /abo/ki-freigabe.js laden, dann
//   const access = await DemenzKiFreigabe.check({ language: "de" });
//   if (access.allowed) { …KI fragen…; nach einer echten Antwort DemenzKiFreigabe.noteAnswer(); }
//   else box.append(DemenzKiFreigabe.offerCard({ sentence: typed }));
//   beim Laden: const offen = DemenzKiFreigabe.takePending(); if (offen) …Satz erneut übersetzen…
(function (root) {
  "use strict";
  const config = root.DEMENZ_ABO_CONFIG || {};
  const gate = config.translatorGate || {};
  const storageKey = "demenzCoachKi";
  const pendingKey = "demenzCoachKiOffen";
  const firebaseVersion = "12.16.0";
  const subscriberCacheMs = 12 * 60 * 60 * 1000;
  const checkTimeoutMs = 6000;
  // Wie die umsatzstärksten Web-Funnels: jeder Einstieg läuft über den persönlichen Fragebogen, nicht direkt zur Kasse.
  const offerURL = "/start/?src=uebersetzer_ki";
  const signInURL = "/abo/?src=uebersetzer_ki&weiter=1";

  function read() {
    try {
      const value = JSON.parse(root.localStorage.getItem(storageKey) || "null");
      return value && typeof value === "object" ? value : {};
    } catch { return {}; }
  }
  function write(patch) {
    try { root.localStorage.setItem(storageKey, JSON.stringify({ ...read(), ...patch })); } catch { /* privates Fenster */ }
  }
  const enabled = () => gate.enabled === true;
  const freeAnswers = () => (Number.isInteger(gate.freeAnswers) && gate.freeAnswers >= 0 ? gate.freeAnswers : 1);
  // Rückweg nach der Kasse: nur eigene Pfade, nie eine fremde Adresse.
  const safePath = (value) => (/^\/[A-Za-z0-9/_.-]{0,120}$/u.test(String(value || "")) && !String(value).startsWith("//") ? String(value) : "");

  const track = (name, values = {}) => {
    try { root.DemenzConsent?.track?.(name, values); } catch { /* ohne Einwilligung nichts */ }
  };

  function withTimeout(promise) {
    let timer;
    const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("timeout")), checkTimeoutMs); });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
  }

  async function checkSubscriber() {
    const saved = read();
    if (Number(saved.activeUntil) > Date.now()) return true;
    if (!config.firebase?.apiKey || !config.endpoint) return false;
    const [{ initializeApp, getApps }, auth] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${firebaseVersion}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${firebaseVersion}/firebase-auth.js`)
    ]);
    const firebaseAuth = auth.getAuth(getApps()[0] || initializeApp(config.firebase));
    const user = await new Promise((resolve) => {
      const stop = auth.onAuthStateChanged(firebaseAuth, (current) => { stop(); resolve(current); });
    });
    if (!user) return false;
    const response = await fetch(`${config.endpoint}/entitlement`, { headers: { Authorization: `Bearer ${await user.getIdToken()}` } });
    if (!response.ok) throw new Error(`entitlement ${response.status}`);
    const entitlement = await response.json();
    write({ activeUntil: entitlement.active ? Date.now() + subscriberCacheMs : 0 });
    return entitlement.active === true;
  }

  let running = null;
  async function check({ language = "de" } = {}) {
    // Die Web-Kasse gibt es nur auf Deutsch (Euro, deutsches Recht). Andere Sprachen bleiben wie bisher.
    if (!enabled() || language !== "de") return { allowed: true, reason: "off" };
    if ((Number(read().used) || 0) < freeAnswers()) return { allowed: true, reason: "free" };
    try {
      running ||= checkSubscriber().finally(() => { running = null; });
      if (await withTimeout(running)) return { allowed: true, reason: "subscriber" };
    } catch {
      // Prüfung nicht erreichbar: lieber antworten als zahlende Kunden aussperren.
      return { allowed: true, reason: "check_failed" };
    }
    return { allowed: false, reason: "limit" };
  }

  function noteAnswer() {
    if (!enabled()) return;
    write({ used: (Number(read().used) || 0) + 1 });
  }

  function takePending() {
    try {
      const value = root.sessionStorage.getItem(pendingKey);
      root.sessionStorage.removeItem(pendingKey);
      return value ? String(value).slice(0, 200) : "";
    } catch { return ""; }
  }

  function returnPath() {
    return safePath(read().returnTo);
  }

  function el(doc, tag, className, text) {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  // Angebotskarte im Stil der App: weiße Karte, ein lila Knopf, zwei Schriftgrößen.
  function offerCard({ sentence = "", returnTo = root.location?.pathname || "/demenz-uebersetzer/", doc = root.document } = {}) {
    const remember = () => {
      write({ returnTo: safePath(returnTo) || "/demenz-uebersetzer/" });
      try { if (sentence) root.sessionStorage.setItem(pendingKey, String(sentence).slice(0, 200)); } catch { /* */ }
    };
    const card = el(doc, "div", "ki-angebot");
    card.setAttribute("role", "region");
    card.setAttribute("aria-label", "Dein persönlicher Plan");
    card.append(
      el(doc, "p", "ki-angebot-titel", "Hol dir deinen persönlichen Plan"),
      el(doc, "p", "", "Deine kostenlose KI-Antwort hast du genutzt. Beantworte ein paar kurze Fragen. Dann bekommst du Sätze für eure schwierigsten Momente und unbegrenzt Antworten auf eigene Sätze.")
    );
    const button = el(doc, "a", "ki-angebot-knopf", "Plan in 2 Minuten erstellen");
    button.href = offerURL;
    button.addEventListener("click", () => { remember(); track("ki_offer_click", { source: "uebersetzer_ki" }); });
    const price = el(doc, "p", "ki-angebot-klein", "7 Tage kostenlos, danach 69,99 € im Jahr oder 12,99 € im Monat. Vorher online kündbar.");
    const already = el(doc, "p", "ki-angebot-klein");
    const signIn = el(doc, "a", "", "Schon ein Abo? Anmelden");
    signIn.href = signInURL;
    signIn.addEventListener("click", remember);
    already.append(signIn);
    card.append(button, price, already);
    track("ki_limit_shown", { source: "uebersetzer_ki" });
    return card;
  }

  root.DemenzKiFreigabe = Object.freeze({ check, noteAnswer, offerCard, takePending, returnPath, offerURL, signInURL });
})(typeof window !== "undefined" ? window : globalThis);
