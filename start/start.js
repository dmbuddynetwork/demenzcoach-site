// Fragebogen-Landingpage für Meta (Facebook, Instagram) und TikTok (Daniel, 8. Nov 2026).
// Aufbau nach Noom/BetterMe (Daniel, 8. Nov 12:04: „adaptiere es 1:1“): 11 Fragen zum Alltag (keine Diagnose,
// kein Stadium; mit ?m=<moment> aus der Anzeige 10), Zwischenbildschirme, „Plan wird erstellt“, E-Mail vor dem Ergebnis,
// Konkrete Hilfe als Vorschau, Angebotsseite, dann die Web-Kasse (/abo/?weiter=1). Sätze aus den geprüften Satz-Seiten.
// Datenschutz: freie Angaben bleiben in dieser Seite; nur feste Auswahl-Schlüssel werden im selben Tab
// kurz für Neuladen gemerkt. Werbe- und Analyse-Ereignisse laufen über die gemeinsame
// Einwilligung (DemenzConsent) und tragen nur den Schritt, nie eine Antwort.
(() => {
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  // Quelle: erst src/utm_source. Ohne beides aus dem App-Browser erkennen (Facebook, Instagram und TikTok entfernen den Referrer,
  // der Besuch liefe sonst als „direkt“). Es wird nichts gespeichert, nur der Name der Quelle als Text benutzt.
  const guessSource = () => {
    const agent = navigator.userAgent || "";
    let from = "";
    try { from = new URL(document.referrer).hostname; } catch { /* kein Referrer */ }
    if (/FBAN|FBAV|FB_IAB|FBIOS/u.test(agent) || /(^|\.)facebook\.com$|(^|\.)fb\.com$|^l\.facebook\.com$/u.test(from)) return "fb_app";
    if (/Instagram/u.test(agent) || /(^|\.)instagram\.com$/u.test(from)) return "ig_app";
    if (/musical_ly|BytedanceWebview|TikTok/iu.test(agent) || /tiktok\.com$/u.test(from)) return "tiktok_app";
    return "ads";
  };
  // Kampagnen-Framework (Daniel, 20. Nov 2026): /start/?k=<kampagne>&a=<anzeige> füllt Überschrift, Frage und Moment aus
  // intern/kampagnen/kampagnen.json (geschützt; öffentlich nur kampagnen/data.js mit den aktiven). Entwürfe zeigt nur die Vorschau der Verwaltung (&vorschau=1 mit #v=…).
  // Ohne Kampagne bleibt alles wie bisher. Die Adresse behält k und a, jeder Schritt trägt sie mit.
  const clean = (value, max = 30) => String(value || "").toLowerCase().replace(/[^a-z0-9-]/gu, "").slice(0, max);
  const kampagnenDaten = window.DEMENZ_KAMPAGNEN || { standard: {}, kampagnen: [] };
  const vorschau = params.get("vorschau") === "1";
  let kampagne = null, anzeige = "";
  (() => {
    const id = clean(params.get("k")), ad = clean(params.get("a"), 12);
    let found = kampagnenDaten.kampagnen.find((item) => item.id === id && (item.status === "aktiv" || vorschau)) || null;
    // Vorschau in der Verwaltung: ungespeicherte Änderungen kommen als JSON im Adress-Anker (#v=…), nur mit vorschau=1.
    if (vorschau) { try { const hash = new URLSearchParams(location.hash.slice(1)).get("v"); if (hash && hash.length < 20000) found = { ...(found || {}), ...JSON.parse(hash), id: id || "vorschau" }; } catch { /* Hash ungültig */ } }
    if (found) { kampagne = found; anzeige = ad; }
  })();
  const landing = { ...(kampagnenDaten.standard || {}), ...(kampagne?.landing || {}) };
  const source = (params.get("src") || params.get("utm_source") || kampagne?.src || guessSource()).toLowerCase().replace(/[^a-z0-9_-]/gu, "").slice(0, 30) || "ads";
  const config = window.DEMENZ_ABO_CONFIG || {};
  if (params.get("embed") === "1") document.documentElement.classList.add("start-embedded");

  const svg = (paths) => `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
  const icons = {
    arrow: svg('<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>'),
    nachhause: svg('<path d="M3.5 11 12 4l8.5 7"/><path d="M5.5 9.5V20h13V9.5"/><path d="M10 20v-5.5h4V20"/>'),
    wiederholt: svg('<path d="M20 11a8 8 0 0 0-14.3-4.9L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.3 4.9L20 16"/><path d="M20 20v-4h-4"/>'),
    mutter: svg('<rect x="4" y="3" width="16" height="18" rx="1.5"/><circle cx="12" cy="10" r="3"/><path d="M7 18c.8-2.6 2.7-4 5-4s4.2 1.4 5 4"/>'),
    wer: svg('<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .8-1 1.5v.6"/><path d="M12 16.8v.2"/>'),
    geld: svg('<path d="M4 7.5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a1 1 0 0 1-1-1z"/><path d="M4 7.5 15 4.5v3"/><path d="M16 13.5h4"/>'),
    arbeit: svg('<rect x="3.5" y="7.5" width="17" height="12" rx="1.5"/><path d="M9 7.5V5.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><path d="M3.5 12.5h17"/>'),
    waschen: svg('<path d="M5 21V6a3 3 0 0 1 6 0"/><path d="M8.5 9h5a2.5 2.5 0 0 0-5 0Z"/><path d="M10 13v1.2M13 13v1.2M16 13v1.2M11.5 16.5v1.2M14.5 16.5v1.2"/>'),
    andere: svg('<circle cx="6" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="18" cy="12" r="1"/>'),
    lock: svg('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
    shield: svg('<path d="M12 3 5 6v5c0 4.4 3 8.3 7 9.5 4-1.2 7-5.1 7-9.5V6z"/><path d="m9 12 2 2 4-4"/>'),
    chat: svg('<path d="M4 5.5h16v10H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/>'),
    calendar: svg('<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 9.5h16M8.5 3v4M15.5 3v4"/><path d="m9 14.5 2 2 4-4"/>'),
    gift: svg('<rect x="4" y="9" width="16" height="11" rx="1.5"/><path d="M3 9h18v-.5A1.5 1.5 0 0 0 19.5 7h-15A1.5 1.5 0 0 0 3 8.5z"/><path d="M12 7v13"/><path d="M12 7c-1.5-3-5-3.5-5-1.2C7 7 9.5 7 12 7zm0 0c1.5-3 5-3.5 5-1.2C17 7 14.5 7 12 7z"/>')
  };

  const data = window.DEMENZ_PLAN_DATA;
  const { relations, situations, frequencies, burdens, storageKey } = data;
  // Zusätzliche Fragen (Daniel, 20. Nov 2026: Länge und Zwischenstopps wie BetterMe, die Länge ist bewusst: Investition).
  // Nur Alltag und Gefühle, nichts Medizinisches, keine Diagnose, kein Stadium. Antworten bleiben im Browser.
  const opt = (...labels) => labels.map((label, index) => ({ key: String(index), label }));
  const extra = {
    age: opt("Unter 40", "40 bis 49", "50 bis 59", "60 bis 69", "70 oder älter"),
    personAge: opt("Unter 70", "70 bis 79", "80 bis 89", "90 oder älter"),
    reaction: opt("Wird traurig und weint", "Wird laut oder wütend", "Zieht sich zurück", "Wird unruhig und läuft herum", "Fragt immer wieder dasselbe"),
    visits: opt("Jeden Tag", "Ein paar Mal pro Woche", "Selten", "Fast nie"),
    outings: opt("Jeden Tag", "Ein paar Mal pro Woche", "Nur mit Begleitung", "Kaum noch"),
    meals: opt("Gut", "Muss ans Essen erinnert werden", "Lehnt Essen oft ab", "Will ständig essen"),
    helpreact: opt("Nimmt die Hilfe an", "Wehrt ab", "Wird ärgerlich", "Ganz unterschiedlich"),
    feeling: opt("Ich bin erschöpft", "Ich fühle mich schuldig", "Ich bin traurig", "Ich bin wütend", "Ich lasse es schnell los"),
    sleep: opt("Gut", "Mal so, mal so", "Eher schlecht", "Kaum"),
    breaks: opt("Jeden Tag", "Ein paar Mal pro Woche", "Selten", "Fast nie"),
    work: opt("Vollzeit", "Teilzeit", "Ich bin in Rente", "Ich bin nicht berufstätig"),
    when: opt("Morgens", "Mittags", "Nachmittags", "Abends"),
    joy: opt("Ein ruhiger Abend", "Weniger Streit", "Mehr gemeinsames Lachen", "Weniger schlechtes Gewissen", "Mehr Kraft für mich"),
    moments: opt("Aufstehen und Anziehen", "Waschen und Duschen", "Essen und Trinken", "Spazieren und Rausgehen", "Besuch und Telefon", "Abend und Schlafengehen", "Nachts"),
    calms: opt("Musik und Lieder", "Alte Fotos", "Ein Spaziergang", "Etwas zu essen oder zu trinken", "Eine Berührung oder Umarmung", "Eine Aufgabe zum Helfen", "Ich weiß es noch nicht"),
    helpers: opt("Familie", "Freunde oder Nachbarn", "Pflegedienst", "Tagespflege", "Ich mache fast alles allein"),
    learn: opt("Kurze Sätze zum Nachsprechen", "Kleine Erklärungen", "Beispiele aus dem Alltag", "Zum Vorlesen oder Ausdrucken")
  };
  const singleNames = ["age", "personAge", "reaction", "visits", "outings", "meals", "helpreact", "feeling", "sleep", "breaks", "work", "when", "joy"];
  const multiNames = ["moments", "calms", "helpers", "learn"];
  const requestedContext = params.get("s") || params.get("m") || "";
  const contextCandidate = window.DemenzSituationContext?.resolve(requestedContext) || null;
  // Invalid or excluded keys use the existing general entry, never an invented situation.
  const directMode = params.get("direkt") === "1" && (!requestedContext || Boolean(contextCandidate));
  const directContext = directMode ? contextCandidate : null;

  const answers = { relation: null, name: "", situation: null, frequency: null, dayTime: null, duration: null, living: null,
    tries: [], goal: null, burden: null, minutes: null, email: "",
    age: null, personAge: null, reaction: null, visits: null, outings: null, meals: null, helpreact: null, feeling: null, sleep: null,
    breaks: null, work: null, when: null, joy: null, moments: [], calms: [], helpers: [], learn: [] };
  let plan = "yearly";
  let offer = { yearly: 6999, monthly: 1299, currency: "eur", trialDays: 7, offers: null };
  // Willkommenspreis (angebot.js): Preis vom Server; die Gültigkeit prüft die Kasse erneut.
  // Keine sichtbare Frist: eine dauerhaft bindende Begrenzung ist für den veröffentlichten Flow nicht belegt.
  const deals = window.DemenzAngebot;
  let dealAsked = false;
  let reservationEnded = false;
  const clockStops = [];
  // Geld-zurück-Garantie (Daniel, 9. Nov 2026): 30 Tage ab der ersten Zahlung, Bedingungen auf /abo/garantie.html.
  const guaranteeDays = 30;
  // Gutscheincode wie BetterMe („testi_nov26“: Name plus Monat). Nur eine Bezeichnung für den echten Willkommenspreis,
  // er wird automatisch angewendet; der Preis selbst kommt vom Server.
  const promoCode = () => {
    const base = (forWho() || "willkommen").normalize("NFD").replace(/[^A-Za-z]/gu, "").toLowerCase().slice(0, 10) || "willkommen";
    const month = new Intl.DateTimeFormat("en", { month: "short" }).format(new Date()).toLowerCase();
    return `${base}_${month}${String(new Date().getFullYear()).slice(2)}`;
  };

  const euro = (cents) => new Intl.NumberFormat("de-DE", { style: "currency", currency: offer.currency.toUpperCase() }).format(cents / 100);
  const who = () => answers.name || (answers.relation?.call ?? "") || "sie oder er";
  const forWho = () => answers.name || answers.relation?.call || "";
  const dateText = (date) => new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "long" }).format(date);
  const inDays = (days) => new Date(Date.now() + days * 86_400_000);

  // Messen nur über die gemeinsame Einwilligung der Website (lovable-home.js, DemenzConsent):
  // GA4 nur mit Statistik-, Meta/TikTok nur mit Werbe-Einwilligung. Nie Antworten, Namen oder E-Mail senden.
  const track = (name, marketing) => {
    try { window.DemenzConsent?.track?.(name, { entry: source, ...(kampagne ? { kampagne: kampagne.id, anzeige: anzeige || "" } : {}) }); } catch { /* ohne Einwilligung nichts */ }
    try { if (marketing) window.DemenzConsent?.trackMarketing?.(marketing); } catch { /* */ }
  };

  const el = (tag, props = {}, children = []) => {
    const node = document.createElement(tag);
    // Value-free draft contract exists before a form control can be edited, even while the header loads.
    if (["input", "textarea", "select"].includes(tag)) {
      node.dataset.formDraft = "v1";
      const edited = () => { node.dataset.formEdited = "true"; };
      node.addEventListener("input", edited); node.addEventListener("change", edited);
    }
    for (const [key, value] of Object.entries(props)) {
      if (key === "text") node.textContent = value;
      else if (key === "html") node.innerHTML = value; // nur für feste Symbole, nie für Eingaben
      else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
      else node.setAttribute(key, value);
    }
    for (const child of [].concat(children)) if (child) node.append(child);
    return node;
  };
  // Der Fortschritt steht einmal in der bestehenden Schrittanzeige.
  const next = (name) => el("button", { type: "button", class: "abo-button start-next", text: "Weiter", onclick: () => go(after(name)) });

  function optionList(items, chosen, onPick) {
    let choosing = false;
    return el("ul", { class: "start-options", role: "list" }, items.map((item) => {
      const button = el("button", { type: "button", class: "start-option", "aria-pressed": String(chosen === item), onclick: () => {
        if (choosing) return;
        choosing = true;
        button.setAttribute("aria-pressed", "true");
        setTimeout(() => { if (button.isConnected) onPick(item); }, 160);
      } });
      if (item.key && icons[item.key] && items === situations) button.insertAdjacentHTML("beforeend", icons[item.key]);
      button.append(el("span", { text: item.label }), el("i", { class: "start-dot", "aria-hidden": "true" }));
      return el("li", {}, button);
    }));
  }
  // Mehrfachauswahl (wie Noom): Kästchen zum Antippen, dann „Weiter“.
  function multiList(items, picked) {
    return el("ul", { class: "start-options", role: "list" }, items.map((item) => {
      const button = el("button", { type: "button", class: "start-option start-multi", "aria-pressed": String(picked.includes(item)), onclick: () => {
        const index = picked.indexOf(item);
        if (index >= 0) picked.splice(index, 1); else picked.push(item);
        button.setAttribute("aria-pressed", String(index < 0));
        saveProgress(current);
      } }, [el("span", { text: item.label }), el("span", { class: "start-box", "aria-hidden": "true" })]);
      return el("li", {}, button);
    }));
  }

  // ---- Ablauf ----------------------------------------------------------------------------------
  // Aufbau wie die umsatzstärksten Web-Funnels (Noom, BetterMe): erst kennenlernen (11 kurze Fragen), dazwischen
  // Bestätigung und eine echte Zahl, „Plan wird erstellt“, E-Mail vor dem Ergebnis, Ergebnis mit Zeitstrahl, dann
  // eine lange Angebotsseite. Anzeige und Seite passen zusammen: ?m=<moment> setzt den Moment, die Frage entfällt.
  const preset = situations.find((item) => item.say && item.key === (params.get("m") || landing.moment)) || null;
  if (preset) answers.situation = preset;
  if (directMode) answers.situation = directContext?.planKey ? situations.find(item => item.key === directContext.planKey) || null : null;
  // Vom Übersetzer (Angebotskarte): der zuletzt eingegebene Satz bleibt nur in diesem Tab und wird nur angezeigt.
  let typed = "";
  try { typed = String(sessionStorage.getItem("demenzCoachKiOffen") || "").slice(0, 120); } catch { /* */ }
  // Fünf Abschnitte wie BetterMe („Mein Profil“ bis „Fast geschafft“), dazwischen Zwischenstopps (Infoseiten).
  const sectionDefs = [
    { title: "Über euch", steps: ["relation", "age", "personAge", "hello", "living", "duration", "situation"] },
    { title: "Euer Alltag", steps: ["frequency", "dayTime", "thanks", "moments", "reaction", "feelings", "visits", "outings", "meals",
      "helpreact", "calms", "tries", "insight"] },
    { title: "Du selbst", steps: ["feeling", "sleep", "breaks", "helpers", "self", "work"] },
    { title: "Dein Ziel", steps: ["goal", "burden", "hope", "minutes", "learn", "when", "content", "step"] },
    { title: "Fast geschafft", steps: ["joy", "motivate", "how"] }
  ].map((section) => ({ ...section, steps: section.steps.filter((step) => !(preset && step === "situation")) }));
  const flow = [...sectionDefs.flatMap((section) => section.steps), "building", "email", "newsletter", "name", "result", "reveal", "plan"];
  const answerFor = { relation: "relation", situation: "situation", frequency: "frequency", dayTime: "dayTime", duration: "duration",
    living: "living", goal: "goal", burden: "burden", minutes: "minutes",
    ...Object.fromEntries(singleNames.map((name) => [name, name])) };
  const interstitials = ["thanks", "insight", "how", "hello", "feelings", "self", "hope", "content", "step", "motivate",
    "building", "email", "newsletter", "name", "result", "reveal", "plan"];
  const isQuestion = (name) => !interstitials.includes(name);
  const questions = flow.filter(isQuestion).length;
  const stepNumber = (name) => flow.slice(0, flow.indexOf(name) + 1).filter(isQuestion).length;
  const after = (name) => flow[flow.indexOf(name) + 1];
  const bare = (quote) => quote.replace(/[.!?]+$/u, "");

  // Kurzlebige Wiederaufnahme im selben Tab. Keine Namen, E-Mail-Adressen oder freien Sätze.
  const progressKey = "demenzCoachQuizProgress.v1";
  const progressMaxAge = 30 * 60 * 1000;
  let progressExpiryTimer;
  const progressContext = JSON.stringify([source, preset?.key || ""]);
  const choiceSets = { relation: relations, situation: situations, frequency: frequencies,
    dayTime: data.dayTimes, duration: data.durations, living: data.livings,
    goal: data.goals, burden: burdens, minutes: data.minutes, ...Object.fromEntries(singleNames.map((name) => [name, extra[name]])) };
  const multiSets = Object.fromEntries(multiNames.map((name) => [name, extra[name]]));
  const forgetProgress = () => { clearTimeout(progressExpiryTimer); try { sessionStorage.removeItem(progressKey); } catch { /* privates Fenster */ } };
  function saveProgress(screen) {
    if (directMode) return;
    if (screen === "relation") { forgetProgress(); return; }
    const choices = {};
    for (const [key, items] of Object.entries(choiceSets)) {
      if (items.includes(answers[key])) choices[key] = answers[key].key;
    }
    const tries = answers.tries.filter(item => data.tries.includes(item)).map(item => item.key);
    const multi = Object.fromEntries(Object.entries(multiSets).map(([key, items]) => [key, answers[key].filter(item => items.includes(item)).map(item => item.key)]));
    try {
      sessionStorage.setItem(progressKey, JSON.stringify({ version: 1, at: Date.now(), context: progressContext, screen, choices, tries, multi }));
      clearTimeout(progressExpiryTimer);
      progressExpiryTimer = setTimeout(forgetProgress, progressMaxAge);
    } catch { /* ohne Speicher normal weiter */ }
  }
  function restoreProgress() {
    let saved;
    try { saved = JSON.parse(sessionStorage.getItem(progressKey) || "null"); } catch { forgetProgress(); return "relation"; }
    if (!saved) return "relation";
    if (saved.version !== 1 || saved.context !== progressContext || !Number.isFinite(saved.at)
      || saved.at > Date.now() || Date.now() - saved.at >= progressMaxAge || !flow.includes(saved.screen)
      || !saved.choices || typeof saved.choices !== "object" || !Array.isArray(saved.tries)) {
      forgetProgress(); return "relation";
    }
    for (const [key, items] of Object.entries(choiceSets)) answers[key] = items.find(item => item.key === saved.choices[key]) || null;
    if (preset) answers.situation = preset;
    answers.tries = data.tries.filter(item => saved.tries.includes(item.key));
    for (const [key, items] of Object.entries(multiSets)) answers[key] = items.filter(item => Array.isArray(saved.multi?.[key]) && saved.multi[key].includes(item.key));
    answers.name = answers.relation?.call || "";
    // Ergebnis und Angebot brauchen eine E-Mail; diese wird im Checkpoint nicht gespeichert.
    const screen = flow.indexOf(saved.screen) >= flow.indexOf("building") ? "email" : saved.screen;
    return flow.slice(0, flow.indexOf(screen)).find(step => answerFor[step] && !answers[answerFor[step]]) || screen;
  }
  const chosen = () => (answers.situation?.say ? answers.situation : situations[0]);
  const pick = (name, key) => (item) => { answers[key] = item; go(after(name)); };

  const screens = {
    // Erster Bildschirm wie BetterMe: große Überschrift, „Test in 2 Minuten“, Bildkarten zum Antippen.
    relation: () => {
      const choose = (item) => {
        if (answers.relation !== item) answers.name = item.call;
        answers.relation = item;
        go(after("relation"));
      };
      const pictures = { mama: "v-umarmung.webp", papa: "papa.webp", partner: "paar.webp", grosseltern: "grosseltern.webp" };
      const short = { mama: "Mutter", papa: "Vater", partner: "Partner", grosseltern: "Oma oder Opa" };
      return [
        el("h1", { class: (kampagne ? landing.grossbuchstaben !== false : !preset) ? "start-center start-hero" : "start-center",
          text: kampagne ? landing.ueberschrift : preset ? `Was sagen bei „${bare(preset.quote)}“?` : landing.ueberschrift || "Tipps und Tricks zum Ausdrucken" }),
        typed ? el("p", { class: "start-typed", text: `Deine Frage: „${typed}“` }) : null,
        landing.unterzeile ? el("p", { class: "start-lead start-center", text: landing.unterzeile }) : null,
        el("h2", { class: "start-question start-center", text: landing.frage || "Für wen suchst du Hilfe?" }),
        el("div", { class: "start-pics" }, relations.filter((item) => pictures[item.key]).map((item) => el("button", {
          type: "button", class: "start-pic", "aria-label": item.label, onclick: () => choose(item)
        }, [el("img", { src: `../assets/zeichnungen/${pictures[item.key]}`, alt: "", width: "200", height: "180" }),
          el("span", {}, [short[item.key], el("span", { html: icons.arrow })])]))),
        optionList(relations.filter((item) => !pictures[item.key]), answers.relation, choose),
        // Wie Noom/Liven: Hinweis auf die Bedingungen schon unter der ersten Frage (nur Information, keine Einwilligung per Klick).
        el("p", { class: "start-small start-center" }, ["Es gelten die ", el("a", { href: "/nutzungsbedingungen.html", text: "Nutzungsbedingungen" }), " und der ", el("a", { href: "/datenschutz.html", text: "Datenschutz" }), ". Deine Antworten bleiben auf deinem Gerät."])
      ];
    },
    name: () => {
      const input = el("input", { id: "name", type: "text", autocomplete: "off", maxlength: "30", placeholder: "Zum Beispiel Mama, Papa, Gisela" });
      input.value = answers.name;
      const save = () => { answers.name = input.value.replace(/\s+/gu, " ").trim().slice(0, 30); go(after("name")); };
      input.addEventListener("keydown", (event) => { if (event.key === "Enter") save(); });
      return [
        el("h1", { text: `Wie nennst du ${answers.relation?.pron ?? "die Person"}?` }),
        el("p", { class: "start-lead", text: "So wird die Person in deiner Übersicht genannt. Der Name bleibt auf deinem Gerät." }),
        el("label", { for: "name", class: "sr-only", text: "Name" }),
        input,
        el("button", { type: "button", class: "abo-button", text: "Weiter", onclick: save }),
        el("button", { type: "button", class: "abo-link-button", text: "Überspringen", onclick: () => { answers.name = ""; go(after("name")); } })
      ];
    },
    situation: () => [
      el("h1", { text: "Was ist gerade am schwersten?" }),
      el("p", { class: "start-lead", text: "Wähle, was am häufigsten vorkommt." }),
      optionList(situations, answers.situation, pick("situation", "situation"))
    ],
    frequency: () => [
      el("h1", { text: preset ? `Wie oft hörst du „${bare(preset.quote)}“?` : "Wie oft passiert das?" }),
      optionList(frequencies, answers.frequency, pick("frequency", "frequency"))
    ],
    dayTime: () => [
      el("h1", { text: "Wann ist es meistens am schwersten?" }),
      optionList(data.dayTimes, answers.dayTime, pick("dayTime", "dayTime"))
    ],
    thanks: () => [
      el("img", { class: "start-art", src: "../assets/zeichnungen/nach-hause-ruhig.webp", width: "720", height: "702", alt: "" }),
      el("h1", { text: "Danke, dass du das teilst" }),
      el("p", { text: `Hilfe zu suchen ist ein wichtiger erster Schritt. Viele Familien erleben genau das${answers.dayTime && answers.dayTime.key !== "immer" ? `, oft ${answers.dayTime.text}` : ""}. Du machst nichts falsch.` }),
      next("thanks")
    ],
    duration: () => [
      el("h1", { text: `Seit wann begleitest du ${forWho() || "die Person"}?` }),
      optionList(data.durations, answers.duration, pick("duration", "duration"))
    ],
    living: () => [
      el("h1", { text: "Wie lebt ihr gerade?" }),
      optionList(data.livings, answers.living, pick("living", "living"))
    ],
    tries: () => [
      el("h1", { text: "Was hast du schon versucht?" }),
      el("p", { class: "start-lead", text: "Du kannst mehreres wählen." }),
      multiList(data.tries, answers.tries),
      next("tries")
    ],
    insight: () => {
      const explained = answers.tries.some((item) => item.key === "erklaeren" || item.key === "widersprechen");
      return [
        el("p", { class: "start-big-number", text: "1,8 Mio." }),
        el("h1", { text: "Menschen in Deutschland leben mit Demenz" }),
        el("p", { class: "start-small", text: "Quelle: Deutsche Alzheimer Gesellschaft, Stand Ende 2023" }),
        el("div", { class: "start-card" }, [
          el("p", { text: explained
            ? "Erklären und Widersprechen probieren fast alle zuerst. Oft wird es dadurch aber schwerer, weil die Person ihre Welt gerade anders erlebt."
            : "Hinter fast jedem Menschen mit Demenz stehen Angehörige, die jeden Tag nach den richtigen Worten suchen." }),
          el("p", { text: "Fachleute raten: erst das Gefühl aufgreifen, dann die Fakten. Genau dafür ist dein Plan gemacht." })
        ]),
        next("insight")
      ];
    },
    goal: () => [
      el("h1", { text: "Was wünschst du dir am meisten?" }),
      optionList(data.goals, answers.goal, pick("goal", "goal"))
    ],
    burden: () => [
      el("h1", { text: "Was ist für dich am schwersten?" }),
      optionList(burdens, answers.burden, pick("burden", "burden"))
    ],
    minutes: () => [
      el("h1", { text: "Wie viel Zeit hast du dafür?" }),
      el("p", { class: "start-lead", text: "Du kannst auch mit einem einzelnen Satz oder einem kleinen Schritt beginnen." }),
      optionList(data.minutes, answers.minutes, pick("minutes", "minutes"))
    ],
    how: () => [
      el("h1", { text: "So unterstützt dich Demenz Coach" }),
      el("ol", { class: "start-steps", role: "list" }, [
        ["Eure Situation zuerst", answers.situation?.say ? `Wir beginnen mit „${bare(chosen().quote)}“.` : "Wähle eine Alltagssituation oder beschreibe selbst, was gerade schwierig ist."],
        ["Sätze zum Sagen", "Ruhige Sätze, die du gleich ausprobieren kannst."],
        ["Ein kleiner Schritt", "Was du tun kannst, in wenigen Minuten."],
        ["Wochenplan als Ergänzung", "Weitere Alltagssituationen in kleinen Schritten kennenlernen."]
      ].map(([title, text]) => el("li", {}, [el("strong", { text: title }), el("span", { text })]))),
      next("how")
    ],
    building: () => {
      // Ehrlicher Lade-Ring: Es wird nichts berechnet. Die Angaben sind schon da und werden nur nacheinander gezeigt.
      const selected = [
        ["Situation", bare(chosen().quote)],
        ["Tageszeit", answers.dayTime?.text],
        ["Dein Ziel", answers.goal?.text]
      ].filter(([, value]) => value);
      const still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const ring = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      ring.setAttribute("viewBox", "0 0 100 100");
      ring.setAttribute("class", "start-ring" + (still ? " is-done" : ""));
      ring.setAttribute("aria-hidden", "true");
      ring.innerHTML = '<circle class="start-ring-bg" cx="50" cy="50" r="42"/><circle class="start-ring-fg" cx="50" cy="50" r="42"/>';
      const rows = selected.map(([label, value], index) => el("div", { class: "start-summary-row" + (still ? " is-shown" : ""), style: `--i:${index}` }, [el("dt", { text: label }), el("dd", { text: value })]));
      const button = el("button", { type: "button", class: "abo-button start-next start-build-next", text: "Weiter", onclick: () => go(after("building"), { replace: true }) });
      if (!still) {
        rows.forEach((row, index) => setTimeout(() => row.classList.add("is-shown"), 700 + index * 900));
        setTimeout(() => ring.classList.add("is-done"), 700 + selected.length * 900);
        button.classList.add("is-waiting");
        setTimeout(() => button.classList.remove("is-waiting"), 700 + selected.length * 900);
      }
      return [
        el("div", { class: "start-ring-wrap" }, [ring]),
        el("h1", { class: "start-center", text: "Wir legen deine Antworten zusammen" }),
        el("p", { class: "start-lead start-center", text: "Das sind deine Angaben bisher. Als Nächstes zeigen wir dir das Ergebnis." }),
        el("dl", { class: "start-summary" }, rows),
        button
      ];
    },
    email: () => emailScreen(),
    newsletter: () => newsletterScreen(),
    result: () => resultScreen(),
    reveal: () => revealScreen(),
    plan: () => planScreen()
  };

  // Weitere Fragen: Einzelauswahl geht sofort weiter, Mehrfachauswahl mit „Weiter“ (wie BetterMe).
  const person = () => forWho() || "die Person";
  const singleTitles = {
    age: () => "Wie alt bist du?",
    personAge: () => `Wie alt ist ${person()} ungefähr?`,
    reaction: () => `Wie reagiert ${person()} meistens, wenn es schwierig wird?`,
    visits: () => `Wie oft hat ${person()} Besuch oder Gesellschaft?`,
    outings: () => `Geht ${person()} noch nach draußen?`,
    meals: () => "Wie läuft das Essen meistens?",
    helpreact: () => `Wie reagiert ${person()}, wenn du hilfst?`,
    feeling: () => "Wie geht es dir nach einem schwierigen Moment?",
    sleep: () => "Wie gut schläfst du gerade?",
    breaks: () => "Wie oft hast du Zeit für dich?",
    work: () => "Bist du berufstätig?",
    when: () => "Wann hast du am ehesten Zeit?",
    joy: () => "Stell dir vor, es klappt besser. Worüber freust du dich am meisten?"
  };
  for (const name of singleNames) {
    screens[name] = () => [el("h1", { text: singleTitles[name]() }), optionList(extra[name], answers[name], pick(name, name))];
  }
  const multiTitles = {
    moments: () => "Bei welchen Momenten ist es am schwersten?",
    calms: () => `Was beruhigt ${person()} manchmal?`,
    helpers: () => "Wer hilft dir im Alltag?",
    learn: () => "Wie lernst du am liebsten?"
  };
  for (const name of multiNames) {
    screens[name] = () => [el("h1", { text: multiTitles[name]() }), el("p", { class: "start-lead", text: "Du kannst mehreres wählen." }),
      multiList(extra[name], answers[name]), next(name)];
  }
  // Zwischenstopps (Zeichnung, kurze Überschrift, zwei Sätze). Keine erfundenen Zahlen, Logos oder Zitate.
  const infoPages = {
    hello: ["together.webp", "Du bist nicht allein", "Viele Angehörige suchen jeden Tag nach den richtigen Worten. Mit jeder Antwort wird dein Plan genauer."],
    feelings: ["schritt-zurueck.webp", "Erst das Gefühl, dann die Fakten", "Hinter vielen Sätzen steckt ein Gefühl: Angst, Sehnsucht oder der Wunsch, gebraucht zu werden. Dein Plan zeigt dir, was dahinter stecken könnte."],
    self: ["pause-tochter.webp", "Auch du zählst", "Wer sich kümmert, braucht selbst Pausen. Dein Plan hat kleine Hilfen für dich, die nur wenige Minuten brauchen."],
    hope: ["ruhig-abend.webp", "Wir helfen dir, ruhig zu bleiben", "Mit passenden Sätzen wird es leichter, nicht zu streiten. Du bekommst jeden Tag einen Moment mit Sätzen zum Sagen."],
    content: ["words.webp", "So entstehen deine Sätze", "Die Sätze stammen aus unseren Übersetzer-Seiten. Sie sind ruhig, einfach und ohne Vorwurf. Dein Plan wählt die aus, die zu eurem Alltag passen."],
    step: ["ruhig-hilfe.webp", "Kleine Schritte reichen", "Du musst nicht alles auf einmal ändern. Dein Plan gibt dir jeden Tag einen kleinen Schritt, der in wenigen Minuten klappt."],
    motivate: ["v-garten.webp", "Denk an einen guten Moment", "Gab es zuletzt einen Augenblick, der leichter war? Ein Lächeln, ein Lied, ein gemeinsamer Tee. Darauf baut dein Plan auf."]
  };
  for (const [name, [image, title, text]] of Object.entries(infoPages)) {
    screens[name] = () => [el("img", { class: "start-art", src: `../assets/zeichnungen/${image}`, width: "600", height: "600", alt: "" }),
      el("h1", { text: title }), el("p", { text }), next(name)];
  }

  // ---- E-Mail vor dem Ergebnis (wie BetterMe und Yazio: Pflicht, direkt nach „Plan wird erstellt“) ----------
  // Die Adresse bleibt in diesem Tab, bis jemand ein Abo startet (dann geht sie an Stripe für Bestätigung und Rechnung).
  // Für den Willkommenspreis schickt angebot.js sie an unseren Server, der nur einen Prüfwert speichert.
  // Werbe-Mails nur mit dem eigenen Schritt danach (Kopplungsverbot, Art. 7 Abs. 4 DSGVO): kein Haken, keine Vorauswahl.
  const validEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u.test(value);
  function emailScreen() {
    const input = el("input", { id: "email", type: "email", autocomplete: "email", inputmode: "email", placeholder: "name@beispiel.de" });
    input.value = answers.email;
    const status = el("p", { class: "start-small", role: "status" });
    let sending = false;
    const send = async () => {
      if (sending) return;
      const value = input.value.trim();
      if (!validEmail(value)) { status.textContent = "Bitte gib deine E-Mail-Adresse ein."; input.focus(); return; }
      answers.email = value;
      try { sessionStorage.setItem("demenzCoachEmail", value); } catch { /* */ }
      track(directMode ? "direct_offer_email" : "quiz_email_submit");
      if (directMode) {
        // The existing contact requirement remains before checkout. Reserve an intro
        // only with this validated address, then let the visitor review the real price.
        sending = true;
        if (validEmail(answers.email) && offer.offers?.intro && deals && !dealAsked && !reservationEnded) {
          dealAsked = true;
          status.textContent = "Dein Angebot wird geladen …";
          try { await deals.start("intro", { email: value }); } catch { /* regular tariff remains available */ }
        }
        go("plan", { replace: true });
      } else go(after("email"), { replace: true });
    };
    input.addEventListener("keydown", (event) => { if (event.key === "Enter") send(); });
    return [
      el("h1", { text: directMode ? "E-Mail für die Vertragsbestätigung" : forWho() ? `Gib deine E-Mail ein, um den persönlichen Plan für ${forWho()} zu erhalten` : "Gib deine E-Mail ein, um deinen persönlichen Plan zu erhalten" }),
      directMode ? el("p", { class: "start-lead", text: "An diese Adresse schicken wir die Vertragsbestätigung, wenn du ein Abo abschließt." }) : null,
      el("label", { for: "email", class: "sr-only", text: "E-Mail-Adresse" }),
      input,
      el("button", { type: "button", class: "abo-button", text: directMode ? "Angebot prüfen" : "Weiter", onclick: send }),
      status,
      el("p", { class: "start-small" }, [directMode
        ? "Startest du ein Abo, schicken wir die Vertragsbestätigung an diese Adresse. Für einen Willkommenspreis prüfen wir die Adresse. Keine Werbung ohne dein Ja. "
        : "Wir respektieren deine Privatsphäre und tun alles für den Schutz deiner persönlichen Daten. Deine Daten werden entsprechend unserer Datenschutzerklärung verarbeitet. Startest du ein Abo, schicken wir die Vertragsbestätigung an diese Adresse. Keine Werbung ohne dein Ja. ",
        el("a", { href: "/datenschutz.html", text: "Datenschutz" }), "."])
    ].filter(Boolean);
  }

  // ---- Eigener Schritt für Tipps per E-Mail (wie BetterMe: „Ja, ich bin dabei / Kein Interesse“) ------------
  // Brevo-Liste „Demenz-Übersetzer (DE)“ mit Double-Opt-in. Gesendet wird nur die E-Mail-Adresse.
  const brevoFormURL = "https://dec91d68.sibforms.com/serve/MUIFALjTPrtulR3_pbWZasFlp2rp0I3qK7mXYVC3KPxVznmdzl5zJcBcHNQiuQXilaqGKzd7Y81EDGqt0Ho9tpwQ03SIAGBPrNlnZmT4-JP71DtgDYfd8GrQ11Bg7dNW8tibwtNvt9az78pC4_-kaczKbgGgb_IXoNCZKWhxM8olcup0XJhMqKiLQmUhpO6tpo4UNTUP3JXYHknJrg==";
  function newsletterScreen() {
    const yes = el("button", { type: "button", class: "abo-button", text: "Ja, ich bin dabei", onclick: async () => {
      yes.disabled = true;
      const body = new FormData();
      body.append("EMAIL", answers.email);
      body.append("email_address_check", "");
      body.append("locale", "de");
      try {
        await fetch(brevoFormURL, { method: "POST", body, credentials: "omit", referrerPolicy: "no-referrer", headers: { Accept: "application/json" } });
      } catch { /* Liste ist ein Extra */ }
      track("quiz_newsletter_yes");
      go(after("newsletter"), { replace: true });
    } });
    return [
      el("img", { class: "start-art", src: "../assets/zeichnungen/worte-fehlen.webp", width: "260", height: "240", alt: "" }),
      el("h1", { class: "start-center", text: "Möchtest du jede Woche einen neuen Satz per E-Mail?" }),
      el("p", { class: "start-lead start-center", text: "Kostenlos. Ein ruhiger Satz für einen schwierigen Moment, abmelden mit einem Klick." }),
      yes,
      el("button", { type: "button", class: "abo-button abo-button-light", text: "Kein Interesse", onclick: () => { track("quiz_newsletter_no"); go(after("newsletter"), { replace: true }); } }),
      el("p", { class: "start-small start-center" }, ["Bei „Ja“ kommt zuerst eine E-Mail zum Bestätigen. ", el("a", { href: "/datenschutz.html#e-mail-liste", text: "Datenschutz" }), "."])
    ];
  }

  // Vorschau auf die konkrete Hilfe, ohne Lernprognose oder Wirkungsdarstellung.
  function resultScreen() {
    if (!completed) { completed = true; track("quiz_complete", "Lead"); window.DemenzTeller?.stage("complete"); }
    const s = chosen();
    const name = forWho();
    // Kurve „Jetzt → Nach 4 Wochen“ wie BetterMe („dein Plan ist bereit“). Nur Veranschaulichung, ausdrücklich keine Messung.
    const svgNS = "http://www.w3.org/2000/svg";
    const chart = document.createElementNS(svgNS, "svg");
    chart.setAttribute("viewBox", "0 0 320 170");
    chart.setAttribute("class", "start-graph");
    chart.setAttribute("role", "img");
    chart.setAttribute("aria-label", "Veranschaulichung: Sicherheit im Gespräch steigt von Woche 1 bis Woche 4");
    chart.innerHTML = '<defs><linearGradient id="gfill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#47408c" stop-opacity=".25"/><stop offset="1" stop-color="#47408c" stop-opacity="0"/></linearGradient></defs>'
      + '<g stroke="#d9d6ee" stroke-width="1"><path d="M30 20H300M30 60H300M30 100H300M30 140H300"/></g>'
      + '<path d="M30 130C100 126 150 100 200 70S270 32 300 28V140H30Z" fill="url(#gfill)"/>'
      + '<path class="start-graph-line" d="M30 130C100 126 150 100 200 70S270 32 300 28" fill="none" stroke="#47408c" stroke-width="4" stroke-linecap="round"/>'
      + '<circle cx="30" cy="130" r="7" fill="#fff" stroke="#47408c" stroke-width="4"/><circle cx="300" cy="28" r="8" fill="#47408c"/>'
      + '<g font-family="system-ui,sans-serif" font-size="11" fill="#5b5870" text-anchor="middle"><text x="30" y="162">Jetzt</text><text x="97" y="162">Woche 1</text><text x="164" y="162">Woche 2</text><text x="231" y="162">Woche 3</text><text x="291" y="162">Woche 4</text></g>';
    return [
      el("h1", { text: name ? `${name}: Dein Plan ist bereit!` : "Dein Plan ist bereit!" }),
      el("div", { class: "start-graph-card" }, [
        el("p", { class: "start-graph-title", text: "Sicherheit im Gespräch" }),
        chart,
        el("p", { class: "start-small", text: "Dieses Diagramm dient der Veranschaulichung. Es ist keine Messung und kein Versprechen. Wie schnell es hilft, ist bei jedem anders." })
      ]),
      el("ul", { class: "start-chips", role: "list" }, [
        el("li", { text: "Für den Einstieg geeignet" }),
        el("li", { text: "An deine Antworten angepasst" })
      ]),
      el("div", { class: "start-card" }, [
        el("p", { class: "start-small", text: answers.situation?.say ? "Deine gewählte Situation" : "Ein Beispiel für die Hilfe" }),
        el("h2", { text: `„${s.quote}“` }),
        el("p", { class: "plan-label", text: "Ein Satz zum Ausprobieren" }),
        el("ul", { class: "start-say", role: "list" }, [el("li", { text: `„${s.say[0]}“` })])
      ]),
      el("p", { class: "start-small", text: "Satzideen, nächste Schritte und weitere Alltagssituationen zum Nachschauen. Der Wochenplan ist eine zusätzliche Hilfe." }),
      el("button", { type: "button", class: "abo-button", text: "Weiter", onclick: () => go(after("result")) })
    ];
  }

  // ---- Enthüllung des Willkommenspreises (wie BetterMe: Rubbellos vor der Preisseite) -----------------------
  // Alle bekommen denselben Preis; das Rubbeln deckt ihn nur auf (kein Gewinnspiel, keine Zufallsbehauptung).
  // Beim Öffnen wird der Einführungspreis für diese E-Mail angefragt (angebot.js).
  function revealScreen() {
    const intro = offer.offers?.intro;
    const deal = deals?.current();
    if (!intro || !deals || deals.ended("intro") && !deal) { setTimeout(() => { if (current === "reveal") go("plan", { replace: true }); }); return []; }
    if (!dealAsked) {
      dealAsked = true;
      deals.start("intro", { email: answers.email }).then((started) => {
        if (!started && current === "reveal") go("plan", { replace: true });
      });
    }
    const percent = Math.floor((1 - intro.firstYear / offer.yearly) * 100);
    const prize = el("div", { class: "start-prize" }, [
      el("span", { class: "start-prize-icon", html: icons.gift }),
      el("strong", { text: `${percent} % Rabatt` }),
      el("span", { text: `Dein erstes Jahr ${euro(intro.firstYear)} statt ${euro(offer.yearly)}` }),
      el("span", { class: "start-prize-code" }, ["Promo-Code ", el("b", { text: promoCode() })]),
      el("span", { class: "start-small", text: "Wird automatisch an der Kasse angewendet" })
    ]);
    const canvas = el("canvas", { class: "start-scratch", width: "600", height: "300", "aria-hidden": "true" });
    const button = el("button", { type: "button", class: "abo-button", text: "Aufdecken" });
    let revealed = false;
    const reveal = () => {
      if (revealed) return;
      revealed = true;
      canvas.classList.add("start-scratch-gone");
      button.textContent = "Weiter zum Angebot";
      track("quiz_reveal");
    };
    button.addEventListener("click", () => { if (revealed) go("plan", { replace: true }); else reveal(); });
    // Rubbelfläche: lila Schicht, die mit Finger oder Maus weggerieben wird; ab etwa 45 % ist alles frei.
    requestAnimationFrame(() => {
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return reveal();
      context.fillStyle = "#47408c";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "#ffffff";
      context.font = "700 40px system-ui, sans-serif";
      context.textAlign = "center";
      context.fillText("Hier rubbeln", canvas.width / 2, canvas.height / 2 + 14);
      context.globalCompositeOperation = "destination-out";
      let moves = 0;
      const rub = (event) => {
        if (revealed || (event.buttons === 0 && event.pointerType === "mouse")) return;
        const box = canvas.getBoundingClientRect();
        context.beginPath();
        context.arc((event.clientX - box.left) * (canvas.width / box.width), (event.clientY - box.top) * (canvas.height / box.height), 46, 0, Math.PI * 2);
        context.fill();
        if (++moves % 12 === 0) {
          const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
          let clear = 0;
          for (let index = 3; index < pixels.length; index += 64) if (pixels[index] === 0) clear += 1;
          if (clear / (pixels.length / 64) > 0.45) reveal();
        }
      };
      canvas.addEventListener("pointerdown", (event) => { canvas.setPointerCapture?.(event.pointerId); rub(event); });
      canvas.addEventListener("pointermove", rub);
    });
    return [
      el("h1", { class: "start-center", text: "Ein Willkommensgeschenk für dich" }),
      el("p", { class: "start-lead start-center", text: "Rubbel die Karte frei oder tippe auf Aufdecken." }),
      el("div", { class: "start-scratch-card" }, [prize, canvas]),
      button,
      el("p", { class: "start-small start-center", text: `Willkommenspreis für das erste Jahr des Jahresplans, inkl. MwSt. Danach ${euro(offer.yearly)} im Jahr. ${offer.trialDays > 0 ? `Die ${offer.trialDays} Tage kostenlos bleiben.` : ""}` })
    ];
  }

  // ---- Angebotsseite 1:1 nach BetterMe, Liven und Noom (lange Seite) --------------------------------
  // Oben eine feste Leiste mit Probezeit und Knopf, konkrete Situationsvorschau,
  // Rabatt-Box, Tarife mit Preis pro Tag, Knopf, sicher bezahlen, was du bekommst, Probezeit, FAQ, Tarife noch einmal.
  // Keine erfundenen Bewertungen, Nutzerzahlen oder unbelegte zeitliche Verknappung.
  // Bildpaar vom Üben (sessionStorage, nur Pfade zu unseren eigenen Zeichnungen).
  function simulatorPair() {
    if (!directMode || source !== "simulator") return null;
    const fallback = { before: "/assets/zeichnungen/nach-hause.webp", after: "/assets/zeichnungen/nach-hause-ruhig.webp" };
    try {
      const value = JSON.parse(sessionStorage.getItem("demenzCoachSimPair") || "null");
      const ok = (path) => typeof path === "string" && /^\/assets\/zeichnungen\/[a-z0-9-]+\.webp$/u.test(path);
      return value && ok(value.before) && ok(value.after) ? { before: value.before, after: value.after } : fallback;
    } catch { return fallback; }
  }

  // Stimmen von Angehörigen (stimmen.js): Karten zum Wischen mit „Mehr lesen“, wie BetterMe „Ergebnisse, auf die wir stolz sind“.
  // Echte Texte, Vornamen mit Zustimmung (Daniel, 20. Nov 2026). Keine Sterne, keine Zahlen, kein Wirkungsversprechen.
  function voices() {
    const all = Array.isArray(window.DemenzStimmen) ? window.DemenzStimmen : [];
    if (!all.length) return null;
    const featured = [0, 2, 3, 5, 10, 48, 49, 8].map((index) => all[index]).filter(Boolean);
    const card = (voice, clamp) => {
      const text = el("p", { class: clamp ? "start-voice-text is-clamped" : "start-voice-text", text: `„${voice.text}“` });
      const parts = [el("strong", { text: `${voice.name}, ${voice.rolle}` }), text];
      if (clamp && voice.text.length > 150) {
        const more = el("button", { type: "button", class: "abo-link-button", text: "Mehr lesen", "aria-expanded": "false", onclick: () => {
          const open = text.classList.toggle("is-clamped") === false;
          more.textContent = open ? "Weniger" : "Mehr lesen";
          more.setAttribute("aria-expanded", String(open));
        } });
        parts.push(more);
      }
      return el(clamp ? "figure" : "li", { class: "start-voice", ...(clamp ? { role: "listitem" } : {}) }, parts);
    };
    return el("section", { class: "start-voices", "aria-label": "Stimmen von Angehörigen" }, [
      el("h2", { class: "start-section start-center start-big-title", text: "Das sagen Angehörige" }),
      el("div", { class: "start-voice-row", role: "list" }, featured.map((voice) => card(voice, true))),
      el("details", { class: "start-voices-all" }, [
        el("summary", { text: `Alle ${all.length} Stimmen lesen` }),
        el("ul", { role: "list" }, all.map((voice) => card(voice, false)))
      ]),
      el("p", { class: "start-small", text: "Stimmen von Angehörigen, die Demenz Coach ausprobiert haben. Vornamen mit Zustimmung. Einzelne Erfahrungen, kein Versprechen für dein Ergebnis." })
    ]);
  }

  function planScreen() {
    const s = chosen();
    if (validEmail(answers.email) && offer.offers?.intro && deals && !dealAsked && !reservationEnded) {
      dealAsked = true;
      deals.start("intro", { email: answers.email }).then((started) => { if (started && current === "plan") render("plan"); });
    }
    const deal = offer.offers ? deals?.current() : null;
    const firstYear = deal ? deal.firstYear : offer.yearly;
    const perDay = (cents, days) => euro(Math.round(cents / days));
    const yearlyText = deal ? `${euro(firstYear)} im ersten Jahr, danach ${euro(offer.yearly)} pro Jahr` : `${euro(offer.yearly)} pro Jahr`;
    // Preise immer mit Hinweis auf die Umsatzsteuer (PAngV § 6 Abs. 1 Nr. 1).
    const priceText = (key) => `${key === "yearly" ? yearlyText : `${euro(offer.monthly)} pro Monat`} inkl. MwSt.`;
    // Nur ein belegbarer Vergleich (Jahrespreis gegenüber 12 Monatszahlungen), keine unbelegte Spitzenstellung wie „Beliebt“.
    const saving = Math.floor((1 - offer.yearly / (offer.monthly * 12)) * 20) * 5;
    const name = forWho();
    // Labels wie BetterMe („GET MY PLAN“, „MOST POPULAR“). Statt „Beliebtester“ (ohne Verkaufszahlen nicht belegbar, UWG)
    // steht auf dem Jahresplan „Bester Preis“: belegbar, weil er pro Tag am günstigsten ist.
    const ctaText = "Plan anfordern";

    const tables = [];
    const select = (key) => {
      plan = key;
      for (const table of tables) for (const card of table.querySelectorAll("[data-plan]")) card.setAttribute("aria-checked", String(card.dataset.plan === key));
      for (const node of document.querySelectorAll("[data-start-price]")) node.textContent = `Dein Abo beginnt: ${priceText(plan)}. Vorher online kündbar.`;
      for (const node of document.querySelectorAll("[data-start-fine]")) node.textContent = fineText();
    };
    // Tarifkarte wie BetterMe: Kreis, Name groß, alter Preis → neuer Preis, rechts groß der Tagespreis.
    const tier = (key, title, line, cents, days, was, band) => el("button", { type: "button", class: "start-tier", role: "radio", "data-plan": key, "aria-checked": String(plan === key), onclick: () => select(key) }, [
      band ? el("span", { class: "start-ribbon", text: band }) : null,
      el("span", { class: "start-tier-body" }, [
        el("span", { class: "abo-radio", "aria-hidden": "true" }),
        el("span", { class: "start-tier-text" }, [el("strong", { text: title }), line]),
        el("span", { class: "start-day" }, [was ? el("s", { text: perDay(was, days) }) : null, el("strong", { text: perDay(cents, days) }), el("span", { text: "pro Tag" })])
      ])
    ]);
    const table = () => {
      const yearlyLine = deal
        ? el("span", {}, [el("s", { text: euro(offer.yearly) }), ` → ${euro(firstYear)} im 1. Jahr`])
        : el("span", { text: `${euro(offer.yearly)} pro Jahr` });
      const group = el("div", { role: "radiogroup", "aria-label": "Tarif", class: "start-tiers" }, [
        tier("monthly", "1-Monats-Plan", el("span", { text: `${euro(offer.monthly)} pro Monat` }), offer.monthly, 30, null, null),
        tier("yearly", "12-Monats-Plan", yearlyLine, firstYear, 365, deal ? offer.yearly : null, saving >= 10 ? `Bester Preis · Spare ${deal ? Math.floor((1 - firstYear / (offer.monthly * 12)) * 100) : saving} %` : "Bester Preis")
      ]);
      tables.push(group);
      return group;
    };
    const cta = () => el("button", { type: "button", class: "abo-button start-cta", text: ctaText, onclick: checkout });
    const fineText = () => (offer.trialDays > 0
      ? `Heute zahlst du 0,00 €. Kündige ich nicht vor Ablauf der ${offer.trialDays} Tage, kostet das Abo danach ${priceText(plan)} und verlängert sich, bis ich kündige. Online kündbar über „Verträge hier kündigen“, ohne Anmeldung.`
      : `Du zahlst ${priceText(plan)}, bis du kündigst. Online kündbar über „Verträge hier kündigen“, ohne Anmeldung.`);
    const fine = () => el("p", { class: "start-fine", "data-start-fine": "", text: fineText() });
    // Zahlungs-Logos wie BetterMe („Guaranteed safe checkout“). Nur Wege, die die Kasse wirklich anbietet (Stripe: Karte, Apple Pay, Google Pay).
    const payLogos = [
      ["Visa", '<svg viewBox="0 0 60 24" aria-hidden="true"><text x="30" y="18" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="17" font-weight="900" font-style="italic" fill="#1a1f71" letter-spacing="1">VISA</text></svg>'],
      ["Mastercard", '<svg viewBox="0 0 60 24" aria-hidden="true"><circle cx="24" cy="12" r="9" fill="#eb001b"/><circle cx="36" cy="12" r="9" fill="#f79e1b"/><path d="M30 5.3a9 9 0 0 1 0 13.4a9 9 0 0 1 0-13.4z" fill="#ff5f00"/></svg>'],
      ["Apple Pay", '<svg viewBox="0 0 60 24" aria-hidden="true"><path d="M13.6 7.3c.6-.8 1-1.8.9-2.8-.9 0-2 .6-2.6 1.4-.6.6-1.1 1.7-.9 2.7 1 .1 2-.5 2.6-1.3zm.9 1.5c-1.4-.1-2.7.8-3.3.8-.7 0-1.7-.8-2.9-.8-1.5 0-2.8.9-3.6 2.2-1.5 2.7-.4 6.6 1.1 8.8.7 1.1 1.6 2.2 2.7 2.2s1.5-.7 2.8-.7 1.7.7 2.9.7 1.9-1.1 2.6-2.1c.8-1.2 1.1-2.4 1.2-2.5 0 0-2.3-.9-2.3-3.5 0-2.2 1.8-3.2 1.9-3.3-1-1.5-2.6-1.7-3.1-1.8z" fill="#000"/><text x="20" y="18" font-family="-apple-system,Helvetica,Arial,sans-serif" font-size="14" font-weight="600" fill="#000">Pay</text></svg>'],
      ["Google Pay", '<svg viewBox="0 0 60 24" aria-hidden="true"><text x="7" y="18" font-family="Arial,Helvetica,sans-serif" font-size="15" font-weight="700"><tspan fill="#4285f4">G</tspan><tspan fill="#5f6368" font-weight="500"> Pay</tspan></text></svg>']
    ];
    const payments = () => el("div", { class: "start-pay" }, [
      el("p", { class: "start-pay-title" }, [el("span", { html: icons.lock }), "Sicher bezahlen, SSL-verschlüsselt"]),
      el("ul", { role: "list", "aria-label": "Zahlungswege" }, payLogos.map(([name, svg]) => el("li", { title: name, "aria-label": name, html: svg })))
    ]);
    const guarantee = () => el("p", { class: "start-guarantee" }, [el("span", { html: icons.shield }),
      el("span", {}, [el("strong", { text: `${guaranteeDays} Tage Geld-zurück-Garantie` }), " ", el("a", { href: "/abo/garantie.html", text: "Bedingungen" })])]);
    const scrollToPlans = () => document.querySelector(".start-tiers")?.scrollIntoView({ behavior: "smooth", block: "center" });

    // Uhr nur mit echtem Ende: die Reservierung des Willkommenspreises vom Server (angebot.js, an die E-Mail gebunden).
    // Läuft sie ab, verschwindet der Sonderpreis wirklich. Ohne Reservierung gibt es keine Uhr.
    for (const stop of clockStops.splice(0)) stop();
    const clock = (soft) => {
      if (!deal) return null;
      const minutes = el("b", { text: "--" }), seconds = el("b", { text: "--" });
      const node = el("span", { class: `start-clock${soft ? " start-clock-soft" : ""}`, role: "timer", "aria-label": "Zeit für den Willkommenspreis" }, [
        minutes, el("i", { text: ":" }), seconds, el("small", { text: "Minuten" }), el("small"), el("small", { text: "Sekunden" })]);
      clockStops.push(deals.countdown(deal, (text) => { const [m, sec] = text.split(":"); minutes.textContent = m.padStart(2, "0"); seconds.textContent = sec; },
        () => { deals.drop(deal.kind); reservationEnded = true; if (current === "plan") render("plan"); }));
      return node;
    };

    // Fester Kopf wie BetterMe: links die Uhr (oder die Probezeit), rechts „Plan anfordern“.
    const head = el("div", { class: "start-head" }, [
      clock(false) || el("p", { class: "start-head-text" }, [el("strong", { text: offer.trialDays > 0 ? `${offer.trialDays} Tage kostenlos` : "Dein gewähltes Abo" }), el("span", { text: offer.trialDays > 0 ? "Heute 0,00 €" : `ab ${perDay(firstYear, 365)} pro Tag` })]),
      el("button", { type: "button", class: "start-head-button", text: "Plan anfordern", onclick: scrollToPlans })
    ]);

    // Nur tatsächlich vorhandene Hilfen zeigen. Keine Vorher-/Nachher-Wirkung versprechen.
    const hasSpecificPlan = !directMode || Boolean(answers.situation?.say);
    const preview = directMode && !directContext ? null : el("div", { class: "start-card" }, [
      el("p", { class: "start-small", text: directContext || answers.situation?.say ? "Deine gewählte Situation" : "Zum Beispiel" }),
      el("h2", { text: `„${directContext?.title || s.quote}“` }),
      el("p", { text: "Satzideen zum Ausprobieren und kleine nächste Schritte für diesen Moment." })
    ]);
    const gets = [directMode && !directContext ? "Satzideen und nächste Schritte für schwierige Situationen" : "Satzideen und nächste Schritte für die gewählte Situation", "Weitere Alltagssituationen zum Nachschauen",
      "Ein Blatt über die Person für Helfer ausfüllen", "Wochenplan als zusätzliche Hilfe"];
    if (answers.burden?.key === "kraft") gets.splice(3, 0, "Kleine Hilfen für dich selbst");
    const faq = [
      ["Was kostet es?", (deal
        ? `12-Monats-Plan: ${euro(firstYear)} im ersten Jahr, danach ${euro(offer.yearly)} im Jahr. 1-Monats-Plan: ${euro(offer.monthly)} im Monat.`
        : `${euro(offer.yearly)} im Jahr oder ${euro(offer.monthly)} im Monat, je nach Wahl.`) + (offer.trialDays > 0 ? ` In den ${offer.trialDays} Tagen zahlst du nichts.` : " Alle Preise inkl. MwSt.")],
      ["Was ist, wenn es uns nicht hilft?", `Dann bekommst du dein Geld zurück. Es gilt eine ${guaranteeDays} Tage Geld-zurück-Garantie ab der ersten Zahlung: Unter „Verträge hier kündigen“ die Garantie wählen, fertig. Die Bedingungen stehen auf der Seite Geld-zurück-Garantie.`],
      ["Wie kündige ich?", `Online über „Verträge hier kündigen“ unten auf jeder Seite, ohne Anmeldung.${offer.trialDays > 0 ? " Kündigst du in der Probezeit, zahlst du nichts." : ""}`],
      ["Gilt das auch in der App?", "Ja. Du meldest dich in der iPhone-App mit demselben Konto an, dann ist alles freigeschaltet."],
      ["Ist das eine medizinische Beratung?", "Nein. Demenz Coach hilft bei Worten und Alltag. Es ersetzt keinen ärztlichen Rat. Im Notfall 112."],
      ["Was passiert mit meinen Antworten?", "Sie bleiben auf deinem Gerät. Wir senden sie nicht und speichern sie nicht."]
    ];
    // Gutschein-Ticket wie BetterMe: Code und daneben die echte Restzeit der Reservierung.
    const ticket = () => (deal ? el("div", { class: "start-ticket" }, [
      el("p", { class: "start-ticket-title" }, [el("span", { html: icons.gift }), "Promo-Code angewendet!"]),
      el("div", { class: "start-ticket-body" }, [
        el("p", { class: "start-ticket-code" }, [el("span", { class: "start-ticket-check", text: "✓" }), promoCode()]),
        clock(true) || el("p", { class: "start-ticket-code", text: euro(firstYear) })
      ])
    ]) : null);

    // Vom Üben (src=simulator): „Jetzt / Dein Ziel“ wie BetterMe, mit dem Bildpaar der geübten Situation (aufgeregt / ruhig).
    const pair = simulatorPair();
    // Bildpaar „Jetzt / Dein Ziel“ wie BetterMe auch für den Fragebogen (Zeichnungen, keine Messwerte).
    const heroPics = pair || (!directMode ? { before: "/assets/zeichnungen/nach-hause.webp", after: "/assets/zeichnungen/nach-hause-ruhig.webp" } : null);
    const level = (filled) => el("span", { class: "start-level", "aria-hidden": "true" }, [1, 2, 3].map((n) => el("i", { class: n <= filled ? "on" : "" })));
    const row = (label, value, filled) => el("div", { class: "start-hero-row" }, [el("span", { text: label }), el("strong", { text: value }), filled ? level(filled) : null]);
    const hero = heroPics ? el("div", { class: "start-hero" }, [
      el("div", { class: "start-hero-pics" }, [
        el("p", { class: "start-hero-tabs" }, [el("span", { text: "Jetzt" }), el("span", { text: "Dein Ziel" })]),
        el("img", { src: heroPics.before, width: "480", height: "420", alt: "Jetzt: die Person ist aufgeregt" }),
        el("img", { src: heroPics.after, width: "480", height: "420", alt: "Dein Ziel: die Person ist ruhig" })
      ]),
      el("div", { class: "start-hero-rows" }, [
        el("div", {}, [row("Im Gespräch", "Angespannt"), row("Du fühlst dich", "Unsicher", 1)]),
        el("div", {}, [row("Im Gespräch", "Ruhig"), row("Du fühlst dich", "Sicher", 3)])
      ])
    ]) : null;

    // Was im Plan steckt: Zeilen mit Symbol, Titel und einer Zeile darunter (wie BetterMe „Was ist in deinem Plan enthalten“).
    const included = [
      [icons.chat, "Gespräche üben", "Eine KI spielt die Person. Du übst, was du sagen kannst."],
      [icons.wiederholt, "Passende Sätze", "Für die Situation, die dich gerade beschäftigt"],
      [icons.nachhause, "Viele Alltagssituationen", "Zum Nachschauen, mit Zeichnungen"],
      [icons.mutter, "Ein Blatt für Helfer", "Über die Person, zum Ausfüllen und Weitergeben"],
      [icons.calendar, "Wochenplan", "Kleine Schritte für jede Woche"]
    ];
    if (answers.burden?.key === "kraft") included.push([icons.shield, "Kleine Hilfen für dich", "Damit du selbst Kraft behältst"]);
    const includedList = el("ul", { class: "start-included", role: "list" }, included.map(([icon, title, text]) =>
      el("li", {}, [el("span", { class: "start-included-icon", html: icon }), el("span", {}, [el("strong", { text: title }), el("span", { text })])])));

    // Bilder aus dem Plan wie BetterMe: echte Bildschirme in hellen Handy-Rahmen. Das mittlere Handy ist groß, die Nachbarn schauen
    // seitlich hervor, darunter Punkte, kein Text (Daniel 20. Nov: „kleiner wie bei BetterMe, ohne Text darunter“). Der Text bleibt als Alt-Text.
    const shotList = [
      ["ueben-waehlen", "Antwort wählen"],
      ["ueben-rueckmeldung", "Sofort Rückmeldung"],
      ["ueben-geschafft", "Die Person wird ruhig"],
      ["app-result", "Passende Sätze"],
      ["app-plan", "Jeden Tag ein Schritt"],
      ["app-help", "Soforthilfe"]
    ];
    const slides = shotList.map(([file, caption], index) => el("figure", { class: index === 0 ? "is-on" : "" }, [
      el("span", { class: "start-phone" }, [el("img", { src: `/assets/angebot/${file}.webp`, width: "720", height: "1566", loading: index < 3 ? "eager" : "lazy", decoding: "async", alt: caption })])
    ]));
    const dots = shotList.map((_, index) => el("button", { type: "button", class: index === 0 ? "is-on" : "", "aria-label": `Bild ${index + 1} von ${shotList.length}` }));
    const track = el("div", { class: "start-shots-track" }, slides);
    const goTo = (index) => track.scrollTo({ left: slides[index].offsetLeft - (track.clientWidth - slides[index].offsetWidth) / 2, behavior: "smooth" });
    let shotFrame = 0;
    track.addEventListener("scroll", () => {
      cancelAnimationFrame(shotFrame);
      shotFrame = requestAnimationFrame(() => {
        const middle = track.scrollLeft + track.clientWidth / 2;
        let active = 0;
        slides.forEach((slide, index) => { if (Math.abs(slide.offsetLeft + slide.offsetWidth / 2 - middle) < Math.abs(slides[active].offsetLeft + slides[active].offsetWidth / 2 - middle)) active = index; });
        slides.forEach((slide, index) => slide.classList.toggle("is-on", index === active));
        dots.forEach((dot, index) => dot.classList.toggle("is-on", index === active));
      });
    }, { passive: true });
    slides.forEach((slide, index) => slide.addEventListener("click", () => goTo(index)));
    dots.forEach((dot, index) => dot.addEventListener("click", () => goTo(index)));
    const shots = el("div", { class: "start-shots", role: "region", "aria-label": "Bilder aus dem Plan" }, [track, el("div", { class: "start-shots-dots" }, dots)]);

    // Übungsplan für 7 Tage (nur vom Üben): je Tag eine Situation. Tag 1 ist die gerade geübte Situation und ist geschafft.
    const weekDays = [
      ["Ich will nach Hause.", "/assets/zeichnungen/nach-hause.webp"],
      ["Ich will nicht duschen.", "/assets/zeichnungen/tuch-mama.webp"],
      ["Du hast mein Geld gestohlen!", "/assets/zeichnungen/s-money.webp"],
      ["Ich will nicht ins Bett.", "/assets/zeichnungen/s-evening.webp"],
      ["Ich muss zur Arbeit.", "/assets/zeichnungen/work.webp"],
      ["Ich habe heute noch nichts gegessen.", "/assets/zeichnungen/together.webp"],
      ["Wo ist meine Mutter?", "/assets/zeichnungen/s-dead.webp"],
      ["Wer sind Sie?", "/assets/zeichnungen/s-recognize.webp"]
    ];
    const practiced = pair ? weekDays.findIndex(([, image]) => image === pair.before) : -1;
    const days = (practiced > 0 ? [weekDays[practiced], ...weekDays.filter((_, index) => index !== practiced)] : weekDays).slice(0, 7);
    const week = pair ? el("ol", { class: "start-week", role: "list" }, days.map(([quote, image], index) =>
      el("li", { class: index === 0 ? "done" : "" }, [
        el("img", { src: image, width: "64", height: "56", loading: "lazy", alt: "" }),
        el("span", {}, [el("small", { text: `Tag ${index + 1}` }), el("strong", { text: `„${quote}“` })]),
        el("span", { class: "start-week-mark", "aria-label": index === 0 ? "Geschafft" : "", text: index === 0 ? "✓" : "" })
      ]))) : null;

    const offerBlock = () => [ticket(), table(), cta(), fine(), payments()];

    return [
      head,
      reservationEnded && !deal ? el("p", { class: "start-small start-center start-ended", text: "Der Willkommenspreis ist nicht mehr verfügbar. Es gilt der normale Preis." }) : null,
      hero,
      el("h1", { class: "start-center start-plan-title", text: pair ? "Dein Übungsplan für Gespräche ist bereit!" : directContext ? `Hilfe bei „${directContext.title}“` : (name ? `Dein Plan für ${name} ist bereit!` : "Dein Plan ist bereit!") }),
      directMode && directContext ? el("p", { class: "start-small", text: "Wenn du fortfährst, findest du diese Situation in deiner Übersicht in diesem Browser wieder. Deine bisherigen Angaben bleiben erhalten." }) : null,
      // Reihenfolge wie BetterMe: Titel, Promo-Code, Tarife, Knopf; die Situation folgt darunter.
      ...offerBlock(),
      pair ? null : preview,
      el("h2", { class: "start-section start-center start-big-title", text: "Was ist in deinem Plan enthalten" }),
      shots,
      includedList,
      week ? el("div", { class: "start-weekcard" }, [
        el("h2", { text: "Dein Übungsplan für 7 Tage" }),
        el("p", { class: "start-weekbar", role: "img", "aria-label": "1 von 7 Tagen geschafft" }, [el("span", { text: "Dein Fortschritt" }), el("i", {}, [el("b")]), el("span", { text: "1 von 7" })]),
        week
      ]) : null,
      hasSpecificPlan && !pair ? el("div", { class: "start-card" }, [
        el("h2", { text: `Wenn „${s.quote}“ fällt` }),
        el("p", { class: "start-small", text: "Probier heute einen dieser Sätze:" }),
        el("ul", { class: "start-say", role: "list" }, s.say.map((line) => el("li", { text: `„${line}“` })))
      ]) : null,
      voices(),
      el("h2", { class: "start-section start-center start-big-title", text: "Häufig gestellte Fragen" }),
      el("div", { class: "start-faq" }, faq.map(([question, answer], index) => el("details", index === 0 ? { open: "" } : {}, [el("summary", { text: question }), el("p", { text: answer })]))),
      el("h2", { class: "start-section start-center start-big-title", text: pair ? "Ruhiger reden. Ab heute üben." : "Starte heute mit deinem Plan" }),
      ...offerBlock(),
      el("div", { class: "start-guarantee-card" }, [
        el("span", { html: icons.shield }),
        el("h2", { text: `${guaranteeDays}-Tage-Geld-zurück-Garantie` }),
        el("p", { text: `Hilft dir der Plan nicht, bekommst du dein Geld zurück. Wähle innerhalb von ${guaranteeDays} Tagen nach der ersten Zahlung unter „Verträge hier kündigen“ die Geld-zurück-Garantie. Wir erstatten den vollen Betrag, das Abo endet sofort.` }),
        el("p", {}, ["Weitere Infos und Bedingungen findest du hier: ", el("a", { href: "/abo/garantie.html", text: "Geld-zurück-Garantie" }), "."])
      ]),
      el("p", { class: "start-small start-legal" }, [
        `${offer.trialDays > 0 ? `Nach ${offer.trialDays} Tagen beginnt das Abo und läuft` : "Das Abo beginnt sofort und läuft"} zum gewählten Preis weiter, bis du kündigst. Der Jahresplan hat eine Laufzeit von einem Jahr und ist danach mit einer Frist von einem Monat kündbar, der Monatsplan jederzeit zum Monatsende.${deal ? " Der Sonderpreis gilt für das erste Jahr des Jahresplans." : ""} Alle Preise inklusive gesetzlicher Umsatzsteuer. Kündigen geht online ohne Anmeldung. Es gelten die `,
        el("a", { href: "/nutzungsbedingungen.html", text: "Nutzungsbedingungen" }), " und die ",
        el("a", { href: "/abo/widerruf.html", text: "Widerrufsbelehrung" }),
        ". Allgemeine Kommunikations- und Alltagshilfe, kein Medizinprodukt."
      ])
    ];
  }

  function checkout() {
    if (directMode && !validEmail(answers.email)) { go("email"); return; }
    track(directMode ? "direct_offer_checkout" : "quiz_checkout", "InitiateCheckout");
    // Für „Mein Plan“ nach dem Kauf: bleibt in diesem Browser, wird nie gesendet.
    try {
      if (directMode) {
        if (directContext) {
          const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
          const previous = saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
          // Preserve all previous answers; add only the explicitly selected public key.
          localStorage.setItem(storageKey, JSON.stringify({ ...previous, directSituation: directContext.key }));
        }
      } else localStorage.setItem(storageKey, JSON.stringify({
        name: forWho(), relation: answers.relation?.key ?? null, situation: chosen().key, burden: answers.burden?.key ?? null,
        dayTime: answers.dayTime?.key ?? null, goal: answers.goal?.key ?? null, savedAt: new Date().toISOString().slice(0, 10)
      }));
    } catch { /* privater Modus: Plan startet dann mit dem häufigsten Moment */ }
    const campaign = (params.get("utm_campaign") || (kampagne && kampagne.id !== "vorschau" ? kampagne.id : "")).toLowerCase().replace(/[^a-z0-9_-]/gu, "").slice(0, 60);
    const src = directMode ? `direkt_${source}`.slice(0, 40) : `quiz_${source}${preset ? `_${preset.key}` : ""}`.slice(0, 40);
    // Kasse als Fenster auf dieser Seite (kasse.js, wie BetterMe/Yazio). Ohne das Modul wie bisher die Seite /abo/.
    const kasse = window.DemenzKasse;
    if (!kasse || !config.firebase?.apiKey) {
      (window.top !== window ? window.top.location : location).href = `/abo/?plan=${plan}&src=${src}${campaign ? `&c=${campaign}` : ""}&weiter=1`;
      return;
    }
    const deal = plan === "yearly" && offer.offers ? deals?.forCheckout() : null;
    history.pushState({ screen: "plan", sheet: true }, "", location.href);
    kasse.open({ plan, email: answers.email, offer: deal, source: src, campaign, track: (name) => track(name),
      onClose: () => { if (history.state?.sheet) history.back(); },
      onOfferExpired: () => { if (deal) deals.drop(deal.kind); reservationEnded = true; render("plan"); } });
  }

  // ---- Navigation (Zurück-Taste des Handys funktioniert über die Browser-Historie) ----------------
  let current = null;
  let completed = false;
  const restart = el("button", { type: "button", class: "abo-link-button", text: "Neu anfangen", onclick: () => {
    forgetProgress();
    for (const key of Object.keys(choiceSets)) answers[key] = null;
    if (preset) answers.situation = preset;
    answers.name = ""; answers.email = ""; answers.tries = []; typed = "";
    try { sessionStorage.removeItem("demenzCoachEmail"); sessionStorage.removeItem("demenzCoachKiOffen"); } catch { /* */ }
    completed = false;
    plan = "yearly";
    history.replaceState({ screen: "relation" }, "", location.href);
    render("relation");
    const heading = $("screen").querySelector("h1");
    heading?.setAttribute("tabindex", "-1");
    heading?.focus();
  } });
  $("footer").prepend(restart);
  const footer = $("footer");
  footer.classList.add("start-footer-clean");
  const footerLinks = el("nav", { class: "start-footer-clean-links", "aria-label": "Weitere Links" }, [...footer.querySelectorAll("a")]);
  const footerControls = el("div", { class: "start-footer-clean-controls" }, [restart]);
  footer.prepend(footerLinks, footerControls);
  // Dasselbe Bedienelement mit bestehendem Handler, keine Kopie und keine neue Einwilligung.
  let footerObserver;
  const placePrivacySettings = () => {
    const settings = document.querySelector(".consent-settings");
    if (!settings) return false;
    footerControls.append(settings);
    footerObserver?.disconnect();
    return true;
  };
  if (!placePrivacySettings()) {
    footerObserver = new MutationObserver(placePrivacySettings);
    footerObserver.observe(document.body, { childList: true });
  }
  const sections = sectionDefs;
  const bars = sections.map(() => el("span", {}, el("i")));
  $("progress").style.setProperty("--sections", String(sections.length));
  $("progress").replaceChildren(...bars);
  // Schrittzähler ohne Einwilligung (Daniel, 19. Nov 2026): Der Server zählt nur Schritt und Tag hoch.
  // Nichts wird im Browser gespeichert, nichts wird als Kennung, Quelle oder Antwort gesendet.
  const countEndpoint = `${String(config.translatorGate?.endpoint || "").replace(/\/v1\/translator-web$/u, "")}/v1/quiz-count`;
  const countStep = (name) => {
    if (!/^https:/u.test(countEndpoint)) return;
    try {
      fetch(countEndpoint, { method: "POST", body: JSON.stringify({ step: directMode ? "direct" : name }), keepalive: true,
        credentials: "omit", referrerPolicy: "no-referrer", headers: { "Content-Type": "text/plain" } }).catch(() => {});
    } catch { /* Zählen darf den Fragebogen nie stören */ }
  };
  function render(name) {
    current = name;
    countStep(name);
    const screen = $("screen");
    screen.replaceChildren(...screens[name]().filter(Boolean));
    screen.dataset.kind = isQuestion(name) ? "question" : name;
    document.body.dataset.screen = name;
    const done = !isQuestion(name) && flow.indexOf(name) >= flow.indexOf("building");
    const index = sections.findIndex((section) => section.steps.includes(name));
    sections.forEach((section, number) => {
      const share = done || number < index ? 1 : number > index ? 0 : (section.steps.indexOf(name) + 1) / section.steps.length;
      bars[number].firstChild.style.width = `${Math.round(share * 100)}%`;
    });
    $("count").textContent = done ? "" : sections[index]?.title ?? "";
    $("back").style.visibility = ["relation", "email", "newsletter", "name"].includes(name) ? "hidden" : "visible";
    // Wie bei BetterMe: auf der allerersten Seite weder Abschnittsname noch Fortschrittsleiste.
    $("progress").hidden = done || name === "relation";
    $("count").hidden = done || name === "relation";
    // Rechtliche Links (AGB, Datenschutz, Impressum, Widerruf, Kündigen) stehen auf jedem Schritt unten, klein.
    $("footer").hidden = false;
    restart.hidden = name === "relation" || directMode;
    window.scrollTo({ top: 0 });
    saveProgress(name);
    if (name !== "plan") track(directMode ? "direct_offer_contact" : `quiz_${name}`);
  }
  function go(name, { replace = false } = {}) {
    if (isQuestion(current)) window.DemenzTeller?.stage("first_answer");
    history[replace ? "replaceState" : "pushState"]({ screen: name }, "", location.href);
    render(name);
  }
  // Ausstiegsangebot (wie BetterMe/Noom): Wer die Angebotsseite mit „Zurück“ verlassen will, bekommt einmal
  // pro Browser 39,99 € fürs erste Jahr (ohne Uhr und ohne Knappheitsbehauptung, UWG). Danach geht „Zurück“ ganz normal.
  function showExitOffer() {
    const exit = offer.offers?.exit;
    deals.markExitShown();
    track("quiz_exit_offer");
    const close = () => { dialog.remove(); document.body.classList.remove("start-noscroll"); };
    const accept = el("button", { type: "button", class: "abo-button", text: `Für ${euro(exit.firstYear)} starten`, onclick: async () => {
      accept.disabled = true;
      const started = await deals.start("exit", { email: answers.email });
      close();
      plan = "yearly";
      track("quiz_exit_offer_click");
      if (started) checkout(); else render("plan");
    } });
    const dialog = el("div", { class: "start-exit", role: "dialog", "aria-modal": "true", "aria-labelledby": "exit-title" }, [
      el("div", { class: "start-exit-card" }, [
        el("h2", { id: "exit-title", text: "Warte kurz" }),
        el("p", { text: `Dein erstes Jahr für ${euro(exit.firstYear)}. Danach ${euro(offer.yearly)} im Jahr, vorher online kündbar.` }),
        el("p", { class: "start-small", text: `Willkommenspreis für das erste Jahr, inkl. MwSt. ${offer.trialDays > 0 ? `Die ${offer.trialDays} Tage kostenlos bleiben.` : ""}` }),
        accept,
        el("button", { type: "button", class: "abo-button abo-button-light", text: "Nein danke", onclick: () => { close(); history.back(); } })
      ])
    ]);
    document.body.append(dialog);
    document.body.classList.add("start-noscroll");
    accept.focus();
  }

  window.addEventListener("popstate", (event) => {
    if (window.DemenzKasse?.isOpen()) { window.DemenzKasse.close(); return; }
    if (directMode) { render("plan"); return; }
    if (current === "plan" && offer.offers?.exit && deals && !deals.exitShown() && event.state?.screen !== "plan") {
      history.pushState({ screen: "plan" }, "", location.href);
      showExitOffer();
      return;
    }
    let name = event.state?.screen || "relation";
    if (!flow.includes(name)) name = "relation";
    if (["building", "email", "newsletter", "name"].includes(name)) name = "how";
    if (name === "reveal") name = "result";
    // Ohne Antwort zurück auf die erste offene Frage.
    const open = flow.slice(0, flow.indexOf(name)).find((step) => answerFor[step] && !answers[answerFor[step]]);
    render(open || name);
  });
  $("back").addEventListener("click", () => history.back());

  // Preise vom Server (dieselben wie die Kasse); bis dahin die festen Preise (69,99 € / 12,99 €).
  if (config.endpoint) {
    fetch(`${config.endpoint}/config`).then((response) => response.ok ? response.json() : null).then((data) => {
      if (!data?.plans) return;
      offer = { yearly: data.plans.yearly.amount, monthly: data.plans.monthly.amount, currency: data.plans.yearly.currency || "eur", trialDays: data.trialDays ?? 7, offers: data.offers || null };
      if (current === "plan" || current === "reveal") render(current);
    }).catch(() => {});
  }

  // Direkt-Angebot (z. B. vom Üben): eine schon bestätigte Konto-Adresse aus diesem Tab übernehmen, wie BetterMe nach der Anmeldung.
  if (directMode) { try { const known = sessionStorage.getItem("demenzCoachEmail") || ""; if (validEmail(known)) answers.email = known; } catch { /* */ } }
  const resumed = directMode ? "plan" : restoreProgress();
  history.replaceState({ screen: resumed }, "", location.href);
  render(resumed);
  track(directMode ? "direct_offer_view" : "quiz_start");
})();
