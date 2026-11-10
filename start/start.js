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
  const source = (params.get("src") || params.get("utm_source") || "ads").toLowerCase().replace(/[^a-z0-9_-]/gu, "").slice(0, 30) || "ads";
  const config = window.DEMENZ_ABO_CONFIG || {};

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
    gift: svg('<rect x="4" y="9" width="16" height="11" rx="1.5"/><path d="M3 9h18v-.5A1.5 1.5 0 0 0 19.5 7h-15A1.5 1.5 0 0 0 3 8.5z"/><path d="M12 7v13"/><path d="M12 7c-1.5-3-5-3.5-5-1.2C7 7 9.5 7 12 7zm0 0c1.5-3 5-3.5 5-1.2C17 7 14.5 7 12 7z"/>')
  };

  const data = window.DEMENZ_PLAN_DATA;
  const { relations, situations, frequencies, burdens, storageKey } = data;
  const requestedContext = params.get("s") || params.get("m") || "";
  const contextCandidate = window.DemenzSituationContext?.resolve(requestedContext) || null;
  // Invalid or excluded keys use the existing general entry, never an invented situation.
  const directMode = params.get("direkt") === "1" && (!requestedContext || Boolean(contextCandidate));
  const directContext = directMode ? contextCandidate : null;

  const answers = { relation: null, name: "", situation: null, frequency: null, dayTime: null, duration: null, living: null,
    tries: [], goal: null, burden: null, minutes: null, email: "" };
  let plan = "yearly";
  let offer = { yearly: 6999, monthly: 1299, currency: "eur", trialDays: 7, offers: null };
  // Willkommenspreis (angebot.js): Preis vom Server; die Gültigkeit prüft die Kasse erneut.
  // Keine sichtbare Frist: eine dauerhaft bindende Begrenzung ist für den veröffentlichten Flow nicht belegt.
  const deals = window.DemenzAngebot;
  let dealAsked = false;
  let reservationEnded = false;
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
    try { window.DemenzConsent?.track?.(name, { source }); } catch { /* ohne Einwilligung nichts */ }
    try { if (marketing) window.DemenzConsent?.trackMarketing?.(marketing); } catch { /* */ }
  };

  const el = (tag, props = {}, children = []) => {
    const node = document.createElement(tag);
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
  const preset = situations.find((item) => item.say && item.key === params.get("m")) || null;
  if (preset) answers.situation = preset;
  if (directMode) answers.situation = directContext?.planKey ? situations.find(item => item.key === directContext.planKey) || null : null;
  // Vom Übersetzer (Angebotskarte): der zuletzt eingegebene Satz bleibt nur in diesem Tab und wird nur angezeigt.
  let typed = "";
  try { typed = String(sessionStorage.getItem("demenzCoachKiOffen") || "").slice(0, 120); } catch { /* */ }
  const flow = ["relation", "name", ...(preset ? [] : ["situation"]), "frequency", "dayTime", "thanks", "duration", "living",
    "tries", "insight", "goal", "burden", "minutes", "how", "building", "email", "newsletter", "result", "reveal", "plan"];
  const answerFor = { relation: "relation", situation: "situation", frequency: "frequency", dayTime: "dayTime", duration: "duration",
    living: "living", goal: "goal", burden: "burden", minutes: "minutes" };
  const interstitials = ["thanks", "insight", "how", "building", "email", "newsletter", "result", "reveal", "plan"];
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
    goal: data.goals, burden: burdens, minutes: data.minutes };
  const forgetProgress = () => { clearTimeout(progressExpiryTimer); try { sessionStorage.removeItem(progressKey); } catch { /* privates Fenster */ } };
  function saveProgress(screen) {
    if (directMode) return;
    if (screen === "relation") { forgetProgress(); return; }
    const choices = {};
    for (const [key, items] of Object.entries(choiceSets)) {
      if (items.includes(answers[key])) choices[key] = answers[key].key;
    }
    const tries = answers.tries.filter(item => data.tries.includes(item)).map(item => item.key);
    try {
      sessionStorage.setItem(progressKey, JSON.stringify({ version: 1, at: Date.now(), context: progressContext, screen, choices, tries }));
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
        el("h1", { class: "start-center", text: preset ? `Was sagen bei „${bare(preset.quote)}“?` : "Persönliche Hilfe für schwierige Alltagssituationen" }),
        typed ? el("p", { class: "start-typed", text: `Deine Frage: „${typed}“` }) : null,
        el("p", { class: "start-lead start-center", text: `Wähle, wobei du Unterstützung brauchst · ${questions} kurze Fragen` }),
        el("h2", { class: "start-question start-center", text: "Für wen suchst du Hilfe?" }),
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
      // Diese Angaben sind schon vorhanden. Hier läuft keine Planberechnung.
      const selected = [
        ["Situation", bare(chosen().quote)],
        ["Tageszeit", answers.dayTime?.text],
        ["Dein Ziel", answers.goal?.text]
      ].filter(([, value]) => value);
      return [
        el("h1", { class: "start-center", text: "Deine Angaben im Überblick" }),
        el("dl", { class: "start-summary" }, selected.flatMap(([label, value]) => [el("dt", { text: label }), el("dd", { text: value })])),
        el("button", { type: "button", class: "abo-button start-next", text: "Weiter", onclick: () => go(after("building"), { replace: true }) })
      ];
    },
    email: () => emailScreen(),
    newsletter: () => newsletterScreen(),
    result: () => resultScreen(),
    reveal: () => revealScreen(),
    plan: () => planScreen()
  };

  // ---- E-Mail vor dem Ergebnis (wie BetterMe und Yazio: Pflicht, direkt nach „Plan wird erstellt“) ----------
  // Die Adresse bleibt in diesem Tab, bis jemand ein Abo startet (dann geht sie an Stripe für Bestätigung und Rechnung).
  // Für den Willkommenspreis schickt angebot.js sie an unseren Server, der nur einen Prüfwert speichert.
  // Werbe-Mails nur mit dem eigenen Schritt danach (Kopplungsverbot, Art. 7 Abs. 4 DSGVO): kein Haken, keine Vorauswahl.
  const validEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u.test(value);
  function emailScreen() {
    const input = el("input", { id: "email", type: "email", autocomplete: "email", inputmode: "email", placeholder: "Deine E-Mail-Adresse" });
    input.value = answers.email;
    const status = el("p", { class: "start-small", role: "status" });
    let sending = false;
    const send = async () => {
      if (sending) return;
      const value = input.value.trim();
      if (!validEmail(value)) { status.textContent = "Bitte gib deine E-Mail-Adresse ein."; input.focus(); return; }
      answers.email = value;
      try { sessionStorage.setItem("demenzCoachEmail", value); } catch { /* */ }
      track(directMode ? "direct_offer_email" : "quiz_email");
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
      el("h1", { text: directMode ? "E-Mail für die Vertragsbestätigung" : forWho() ? `Deine Hilfe für ${forWho()} ansehen` : "Deine persönliche Hilfe ansehen" }),
      el("p", { class: "start-lead", text: directMode ? "An diese Adresse schicken wir die Vertragsbestätigung, wenn du ein Abo abschließt." : "Gib deine E-Mail-Adresse ein, um zum Angebot zu kommen." }),
      el("label", { for: "email", class: "sr-only", text: "E-Mail" }),
      input,
      el("button", { type: "button", class: "abo-button", text: directMode ? "Angebot prüfen" : "Zum Angebot", onclick: send }),
      status,
      el("p", { class: "start-small" }, ["Startest du ein Abo, schicken wir die Vertragsbestätigung an diese Adresse. Für einen Willkommenspreis prüfen wir die Adresse. Keine Werbung ohne dein Ja. ",
        el("a", { href: "/datenschutz.html", text: "Datenschutz" }), "."])
    ];
  }

  // ---- Eigener Schritt für Tipps per E-Mail (wie BetterMe: „Ja, ich bin dabei / Kein Interesse“) ------------
  // Brevo-Liste „Demenz-Übersetzer (DE)“ mit Double-Opt-in. Gesendet wird nur die E-Mail-Adresse.
  const brevoFormURL = "https://dec91d68.sibforms.com/serve/MUIFALjTPrtulR3_pbWZasFlp2rp0I3qK7mXYVC3KPxVznmdzl5zJcBcHNQiuQXilaqGKzd7Y81EDGqt0Ho9tpwQ03SIAGBPrNlnZmT4-JP71DtgDYfd8GrQ11Bg7dNW8tibwtNvt9az78pC4_-kaczKbgGgb_IXoNCZKWhxM8olcup0XJhMqKiLQmUhpO6tpo4UNTUP3JXYHknJrg==";
  function newsletterScreen() {
    const yes = el("button", { type: "button", class: "abo-button", text: "Ja, gern", onclick: async () => {
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
    return [
      el("h1", { text: "Passende Worte für euren Alltag" }),
      el("p", { class: "start-lead", text: answers.situation?.say
        ? "Wir beginnen mit der Situation, die dich gerade beschäftigt."
        : "Hier siehst du ein Beispiel. Deine eigene Situation kannst du im Übersetzer beschreiben." }),
      el("div", { class: "start-card" }, [
        el("p", { class: "start-small", text: answers.situation?.say ? "Deine gewählte Situation" : "Ein Beispiel für die Hilfe" }),
        el("h2", { text: `„${s.quote}“` }),
        el("p", { class: "plan-label", text: "Ein Satz zum Ausprobieren" }),
        el("ul", { class: "start-say", role: "list" }, [el("li", { text: `„${s.say[0]}“` })]),
        el("p", { class: "plan-label", text: "Ein kleiner nächster Schritt" }),
        el("p", { text: s.tip })
      ]),
      el("p", { class: "start-small", text: "Satzideen, nächste Schritte und weitere Alltagssituationen zum Nachschauen. Der Wochenplan ist eine zusätzliche Hilfe." }),
      el("button", { type: "button", class: "abo-button", text: "Zum Angebot", onclick: () => go(after("result")) })
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
    const ctaText = directMode && validEmail(answers.email) ? "Weiter zur Zahlung" : "Persönliche Hilfe starten";

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
    const payments = () => el("ul", { class: "start-pay", role: "list", "aria-label": "Sicher bezahlen" }, [
      el("li", {}, [el("span", { html: icons.lock }), "SSL-verschlüsselt"]), el("li", { text: "Apple Pay" }), el("li", { text: "Google Pay" }), el("li", { text: "Karte" }), el("li", { text: "Stripe" })]);
    const guarantee = () => el("p", { class: "start-guarantee" }, [el("span", { html: icons.shield }),
      el("span", {}, [el("strong", { text: `${guaranteeDays} Tage Geld-zurück-Garantie` }), " ", el("a", { href: "/abo/garantie.html", text: "Bedingungen" })])]);
    const scrollToPlans = () => document.querySelector(".start-tiers")?.scrollIntoView({ behavior: "smooth", block: "center" });

    // Fester Kopf: sachliche Probezeit oder gewählter Plan, daneben der Knopf zu den Tarifen.
    const head = el("div", { class: "start-head" }, [
      el("p", { class: "start-head-text" }, [el("strong", { text: offer.trialDays > 0 ? `${offer.trialDays} Tage kostenlos` : "Dein gewähltes Abo" }), el("span", { text: offer.trialDays > 0 ? "Heute 0,00 €" : `ab ${perDay(firstYear, 365)} pro Tag` })]),
      el("button", { type: "button", class: "start-head-button", text: "Abo ansehen", onclick: scrollToPlans })
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
    // Gutschein-Ticket mit dem bestätigten Einführungspreis, ohne Zeitdruck.
    const ticket = () => (deal ? el("div", { class: "start-ticket" }, [
      el("p", { class: "start-ticket-title" }, [el("span", { html: icons.gift }), "Promo-Code angewendet!"]),
      el("div", { class: "start-ticket-body" }, [
        el("p", { class: "start-ticket-code" }, [el("span", { class: "start-ticket-check", text: "✓" }), promoCode()]),
        el("p", { class: "start-ticket-code", text: euro(firstYear) })
      ])
    ]) : null);

    return [
      head,
      reservationEnded && !deal ? el("p", { class: "start-small start-center start-ended", text: "Der Willkommenspreis ist nicht mehr verfügbar. Es gilt der normale Preis." }) : null,
      el("h1", { class: "start-center start-plan-title", text: directContext ? `Hilfe bei „${directContext.title}“` : "Passende Worte für euren Alltag" }),
      el("p", { class: "start-lead", text: name ? `Persönliche Hilfe für schwierige Alltagssituationen mit ${name}.` : "Persönliche Hilfe für schwierige Alltagssituationen." }),
      preview,
      directMode && directContext ? el("p", { class: "start-small", text: "Wenn du fortfährst, findest du diese Situation in deiner Übersicht in diesem Browser wieder. Deine bisherigen Angaben bleiben erhalten." }) : null,
      ticket(),
      table(),
      cta(),
      fine(),
      payments(),
      guarantee(),
      el("h2", { class: "start-section start-center", text: "Diese Hilfen gehören dazu" }),
      el("img", { class: "start-art", src: "../assets/zeichnungen/v-tanzen.webp", width: "600", height: "650", alt: "" }),
      el("ul", { class: "start-checks", role: "list" }, gets.map((text) => el("li", { text }))),
      hasSpecificPlan ? el("div", { class: "start-card" }, [
        el("h2", { text: `Wenn „${s.quote}“ fällt` }),
        el("p", { class: "start-small", text: "Probier heute einen dieser Sätze:" }),
        el("ul", { class: "start-say", role: "list" }, s.say.map((line) => el("li", { text: `„${line}“` })))
      ]) : el("div", { class: "start-card" }, [
        el("h2", { text: "Für eure eigene Situation" }),
        el("p", { text: "Beschreibe, was gerade schwierig ist, oder öffne die vorhandene Situationshilfe." }),
        el("a", { href: directContext?.href || "/de/#translator-input", text: "Zur kostenlosen Situationshilfe" })
      ]),
      offer.trialDays > 0 ? el("div", { class: "start-risk" }, [
        el("h2", { text: "Ohne Risiko testen" }),
        el("ol", { class: "start-timeline", role: "list" }, [
          el("li", {}, [el("strong", { text: "Heute" }), el("span", { text: "Alles freigeschaltet. Du zahlst 0,00 €." })]),
          el("li", {}, [el("strong", { text: dateText(inDays(offer.trialDays)) }), el("span", { "data-start-price": "", text: `Dein Abo beginnt: ${priceText(plan)}. Vorher online kündbar.` })])
        ])
      ]) : null,
      el("h2", { class: "start-section start-center", text: "Häufige Fragen" }),
      el("div", { class: "start-faq" }, faq.map(([question, answer]) => el("details", {}, [el("summary", { text: question }), el("p", { text: answer })]))),
      el("h2", { class: "start-section start-center", text: name ? `Persönliche Hilfe für ${name}` : "Persönliche Hilfe für euren Alltag" }),
      ticket(),
      table(),
      cta(),
      fine(),
      payments(),
      el("div", { class: "start-guarantee-card" }, [
        el("span", { html: icons.shield }),
        el("h2", { text: `${guaranteeDays} Tage Geld-zurück-Garantie` }),
        el("p", { text: `Hilft dir der Plan nicht, bekommst du dein Geld zurück. Wähle innerhalb von ${guaranteeDays} Tagen nach der ersten Zahlung unter „Verträge hier kündigen“ die Geld-zurück-Garantie. Wir erstatten den vollen Betrag, das Abo endet sofort.` }),
        el("a", { href: "/abo/garantie.html", text: "Bedingungen der Garantie" })
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
    const campaign = (params.get("utm_campaign") || "").toLowerCase().replace(/[^a-z0-9_-]/gu, "").slice(0, 60);
    const src = directMode ? `direkt_${source}`.slice(0, 40) : `quiz_${source}${preset ? `_${preset.key}` : ""}`.slice(0, 40);
    // Kasse als Fenster auf dieser Seite (kasse.js, wie BetterMe/Yazio). Ohne das Modul wie bisher die Seite /abo/.
    const kasse = window.DemenzKasse;
    if (!kasse || !config.firebase?.apiKey) {
      location.href = `../abo/?plan=${plan}&src=${src}${campaign ? `&c=${campaign}` : ""}&weiter=1`;
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
  const sections = [
    { title: "Über euch", steps: ["relation", "name", "situation", "frequency", "dayTime", "thanks"] },
    { title: "Euer Alltag", steps: ["duration", "living", "tries", "insight"] },
    { title: "Dein Ziel", steps: ["goal", "burden", "minutes", "how"] }
  ].map((section) => ({ ...section, steps: section.steps.filter((step) => flow.includes(step)) }));
  const bars = sections.map(() => el("span", {}, el("i")));
  $("progress").replaceChildren(...bars);
  function render(name) {
    current = name;
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
    $("back").style.visibility = ["relation", "email", "newsletter"].includes(name) ? "hidden" : "visible";
    $("progress").hidden = done;
    $("count").hidden = done;
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
    if (["building", "email", "newsletter"].includes(name)) name = "how";
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

  const resumed = directMode ? "plan" : restoreProgress();
  history.replaceState({ screen: resumed }, "", location.href);
  render(resumed);
  track(directMode ? "direct_offer_view" : "quiz_start");
})();
