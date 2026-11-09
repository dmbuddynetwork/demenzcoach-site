// Willkommenspreis im Web (Daniel, 8. Nov 2026: „1. Jahr 49,99 €, Ausstieg 39,99 €“).
//
// Die Angebote kommen vom Server (POST {endpoint}/offer) mit fester Ablaufzeit und Signatur. Die Kasse
// (POST /session) wendet den Stripe-Gutschein nur an, solange das Angebot gilt (7 Tage, nur als technisches Fenster).
// Uhr „reserviert für 14:59“ (Daniel, 9. Nov 2026): nur mit echtem Ende (UWG Anhang Nr. 7). Der Server bindet das
// Willkommensfenster (15 Minuten) an einen Prüfwert der E-Mail; dieselbe E-Mail bekommt nie ein neues Fenster, auch nicht
// nach gelöschtem Browser-Speicher oder auf einem anderen Gerät. Danach gilt der normale Preis.
// Ein Ausstiegsangebot erscheint höchstens einmal pro Browser.
(function (root) {
  "use strict";
  const config = root.DEMENZ_ABO_CONFIG || {};
  const storageKey = "demenzCoachAngebot";
  const kinds = ["exit", "intro"]; // bestes zuerst

  function read() {
    try {
      const value = JSON.parse(root.localStorage.getItem(storageKey) || "null");
      return value && typeof value === "object" ? value : {};
    } catch { return {}; }
  }
  function write(patch) {
    try { root.localStorage.setItem(storageKey, JSON.stringify({ ...read(), ...patch })); } catch { /* privates Fenster */ }
  }
  const valid = (offer) => Boolean(offer && typeof offer.token === "string" && Number(offer.expiresAt) > Date.now() && Number.isInteger(offer.firstYear));

  // Holt (oder setzt fort) ein Angebot beim Server. Ohne Verbindung: kein Angebot, normaler Preis.
  // Mit E-Mail: Fenster gilt für diese Adresse (Server). Antwort 409 = Fenster vorbei, dann kein Angebot mehr.
  async function start(kind, { email = "" } = {}) {
    if (!config.endpoint) return null;
    const saved = read()[kind];
    const response = await fetch(`${config.endpoint}/offer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, ...(saved ? { expiresAt: saved.expiresAt, token: saved.token } : {}), ...(email ? { email } : {}) })
    }).catch(() => null);
    if (response?.status === 409) { drop(kind); write({ [`${kind}Ended`]: true }); return null; }
    if (!response?.ok) return null;
    const offer = await response.json().catch(() => null);
    if (!valid(offer)) return null;
    const keep = { kind: offer.kind, expiresAt: offer.expiresAt, token: offer.token, firstYear: offer.firstYear, regular: offer.regular };
    write({ [kind]: keep });
    return keep;
  }

  // Das beste noch gültige Angebot (Ausstieg vor Willkommen), sonst null.
  function current() {
    const saved = read();
    for (const kind of kinds) if (valid(saved[kind])) return saved[kind];
    return null;
  }
  const forCheckout = () => {
    const offer = current();
    return offer ? { kind: offer.kind, expiresAt: offer.expiresAt, token: offer.token } : null;
  };
  function drop(kind) {
    const saved = read();
    delete saved[kind];
    try { root.localStorage.setItem(storageKey, JSON.stringify(saved)); } catch { /* */ }
  }
  const ended = (kind) => read()[`${kind}Ended`] === true;
  const exitShown = () => read().exitShown === true;
  const markExitShown = () => write({ exitShown: true });

  // „14:59“ bis zum Ablauf; ruft onTick jede Sekunde und onEnd einmal am Ende.
  function countdown(offer, onTick, onEnd) {
    let timer = null;
    const tick = () => {
      const left = Math.max(0, Math.ceil((offer.expiresAt - Date.now()) / 1000));
      onTick(`${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`);
      if (left === 0) { root.clearInterval(timer); onEnd?.(); }
    };
    tick();
    timer = root.setInterval(tick, 1000);
    return () => root.clearInterval(timer);
  }

  root.DemenzAngebot = Object.freeze({ start, current, forCheckout, drop, ended, exitShown, markExitShown, countdown });
})(typeof window !== "undefined" ? window : globalThis);
