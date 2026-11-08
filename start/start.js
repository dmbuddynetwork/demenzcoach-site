// Fragebogen-Landingpage für Meta (Facebook, Instagram) und TikTok (Daniel, 8. Nov 2026).
// Aufbau nach Noom/BetterMe (Daniel, 8. Nov 12:04: „adaptiere es 1:1“): 11 Fragen zum Alltag (keine Diagnose,
// kein Stadium; mit ?m=<moment> aus der Anzeige 10), Zwischenbildschirme, „Plan wird erstellt“, E-Mail vor dem Ergebnis,
// Ergebnis mit Zeitstrahl, lange Angebotsseite, dann die Web-Kasse (/abo/?weiter=1). Sätze aus den geprüften Satz-Seiten.
// Datenschutz: Antworten und Name bleiben in dieser Seite (kein Speichern, kein Senden). Werbe- und Analyse-
// Ereignisse laufen über die gemeinsame Einwilligung (DemenzConsent) und tragen nur den Schritt, nie eine Antwort.
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
    lock: svg('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>')
  };

  const data = window.DEMENZ_PLAN_DATA;
  const { relations, situations, frequencies, burdens, storageKey } = data;

  const answers = { relation: null, name: "", situation: null, frequency: null, dayTime: null, duration: null, living: null,
    tries: [], goal: null, burden: null, minutes: null, email: "" };
  let plan = "yearly";
  let offer = { yearly: 6999, monthly: 1299, currency: "eur", trialDays: 7, offers: null };
  // Willkommenspreis (angebot.js): echtes Angebot vom Server mit Ablaufzeit; ohne es gilt der normale Preis.
  const deals = window.DemenzAngebot;
  let dealAsked = false;

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
  const next = (name) => el("button", { type: "button", class: "abo-button", text: "Weiter", onclick: () => go(after(name)) });

  function optionList(items, chosen, onPick) {
    return el("ul", { class: "start-options", role: "list" }, items.map((item) => {
      const button = el("button", { type: "button", class: "start-option", "aria-pressed": String(chosen === item), onclick: () => {
        button.setAttribute("aria-pressed", "true");
        setTimeout(() => onPick(item), 160);
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
  // Vom Übersetzer (Angebotskarte): der zuletzt eingegebene Satz bleibt nur in diesem Tab und wird nur angezeigt.
  let typed = "";
  try { typed = String(sessionStorage.getItem("demenzCoachKiOffen") || "").slice(0, 120); } catch { /* */ }
  const flow = ["relation", "name", ...(preset ? [] : ["situation"]), "frequency", "dayTime", "thanks", "duration", "living",
    "tries", "insight", "goal", "burden", "minutes", "how", "building", "email", "result", "plan"];
  const answerFor = { relation: "relation", situation: "situation", frequency: "frequency", dayTime: "dayTime", duration: "duration",
    living: "living", goal: "goal", burden: "burden", minutes: "minutes" };
  const interstitials = ["thanks", "insight", "how", "building", "email", "result", "plan"];
  const isQuestion = (name) => !interstitials.includes(name);
  const questions = flow.filter(isQuestion).length;
  const stepNumber = (name) => flow.slice(0, flow.indexOf(name) + 1).filter(isQuestion).length;
  const after = (name) => flow[flow.indexOf(name) + 1];
  const bare = (quote) => quote.replace(/[.!?]+$/u, "");
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
        el("h1", { class: "start-center", text: preset ? `Was sagen bei „${bare(preset.quote)}“?` : "Dein Plan für schwierige Momente mit Demenz" }),
        typed ? el("p", { class: "start-typed", text: `Deine Frage: „${typed}“` }) : null,
        el("p", { class: "start-lead start-center", text: `Test in 2 Minuten · ${questions} kurze Fragen` }),
        el("h2", { class: "start-question start-center", text: "Für wen suchst du Hilfe?" }),
        el("div", { class: "start-pics" }, relations.filter((item) => pictures[item.key]).map((item) => el("button", {
          type: "button", class: "start-pic", "aria-label": item.label, onclick: () => choose(item)
        }, [el("img", { src: `../assets/zeichnungen/${pictures[item.key]}`, alt: "", width: "200", height: "180" }),
          el("span", {}, [short[item.key], el("span", { html: icons.arrow })])]))),
        optionList(relations.filter((item) => !pictures[item.key]), answers.relation, choose)
      ];
    },
    name: () => {
      const input = el("input", { id: "name", type: "text", autocomplete: "off", maxlength: "30", placeholder: "Zum Beispiel Mama, Papa, Gisela" });
      input.value = answers.name;
      const save = () => { answers.name = input.value.replace(/\s+/gu, " ").trim().slice(0, 30); go(after("name")); };
      input.addEventListener("keydown", (event) => { if (event.key === "Enter") save(); });
      return [
        el("h1", { text: `Wie nennst du ${answers.relation?.pron ?? "die Person"}?` }),
        el("p", { class: "start-lead", text: "Dann klingt dein Plan nach euch. Der Name bleibt auf deinem Gerät." }),
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
      el("p", { class: "start-lead", text: "Dein Plan passt sich an. Auch 2 Minuten reichen." }),
      optionList(data.minutes, answers.minutes, pick("minutes", "minutes"))
    ],
    how: () => [
      el("h1", { text: "So funktioniert dein Plan" }),
      el("ol", { class: "start-steps", role: "list" }, [
        ["Jeden Tag ein Moment", `Zuerst „${bare(chosen().quote)}“, dann die nächsten häufigen Momente.`],
        ["Sätze zum Sagen", "Ruhige Sätze, die du gleich ausprobieren kannst."],
        ["Ein kleiner Schritt", "Was du tun kannst, in wenigen Minuten."],
        ["Jede Woche neu", "Ein neuer Moment pro Woche, im Web, in der App und per E-Mail."]
      ].map(([title, text]) => el("li", {}, [el("strong", { text: title }), el("span", { text })]))),
      next("how")
    ],
    building: () => {
      const lines = [`Sätze für „${bare(chosen().quote)}“`, `Passend für ${answers.dayTime?.key === "immer" || !answers.dayTime ? "euren Alltag" : answers.dayTime.text}`,
        answers.goal ? `Dein Ziel: ${answers.goal.text}` : "Was du jetzt tun kannst", "Dein Plan für die ersten 7 Tage"];
      const items = lines.map((text) => el("li", { class: "start-pending", text }));
      items.forEach((item, index) => setTimeout(() => item.classList.remove("start-pending"), 500 + index * 600));
      setTimeout(() => { if (current === "building") go(after("building"), { replace: true }); }, 500 + lines.length * 600 + 300);
      // Kreis mit Prozent wie bei BetterMe und Liven; läuft genau so lange wie die Liste.
      const total = 500 + lines.length * 600;
      const number = el("strong", { text: "0 %" });
      const ring = el("div", { class: "start-ring", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": "0" }, [
        el("div", { html: '<svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="52" fill="none" stroke="#ece9f7" stroke-width="10"/><circle class="start-ring-bar" cx="60" cy="60" r="52" fill="none" stroke="#47408c" stroke-width="10" stroke-linecap="round" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100" transform="rotate(-90 60 60)"/></svg>' }),
        number
      ]);
      const began = performance.now();
      const tick = () => {
        if (current !== "building") return;
        const percent = Math.min(100, Math.round(((performance.now() - began) / total) * 100));
        number.textContent = `${percent} %`;
        ring.setAttribute("aria-valuenow", String(percent));
        ring.querySelector(".start-ring-bar")?.setAttribute("stroke-dashoffset", String(100 - percent));
        if (percent < 100) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      return [
        ring,
        el("h1", { class: "start-center", text: forWho() ? `Dein Plan für ${forWho()} wird erstellt` : "Dein Plan wird erstellt" }),
        el("ul", { class: "start-checks", role: "list" }, items)
      ];
    },
    email: () => emailScreen(),
    result: () => resultScreen(),
    plan: () => planScreen()
  };

  // ---- E-Mail vor dem Ergebnis (wie Noom: „Wohin sollen wir deinen Plan schicken?“) ---------------
  // Brevo-Liste „Demenz-Übersetzer (DE)“ mit Double-Opt-in (dieselbe wie im Übersetzer). Gesendet wird nur die
  // E-Mail-Adresse, nie Antworten oder Namen. Überspringen ist möglich.
  const brevoFormURL = "https://dec91d68.sibforms.com/serve/MUIFALjTPrtulR3_pbWZasFlp2rp0I3qK7mXYVC3KPxVznmdzl5zJcBcHNQiuQXilaqGKzd7Y81EDGqt0Ho9tpwQ03SIAGBPrNlnZmT4-JP71DtgDYfd8GrQ11Bg7dNW8tibwtNvt9az78pC4_-kaczKbgGgb_IXoNCZKWhxM8olcup0XJhMqKiLQmUhpO6tpo4UNTUP3JXYHknJrg==";
  function emailScreen() {
    const input = el("input", { id: "email", type: "email", autocomplete: "email", inputmode: "email", placeholder: "Deine E-Mail-Adresse" });
    input.value = answers.email;
    const status = el("p", { class: "start-small", role: "status" });
    const button = el("button", { type: "button", class: "abo-button", text: "Plan ansehen" });
    const send = async () => {
      const value = input.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u.test(value)) { status.textContent = "Bitte gib deine E-Mail-Adresse ein."; input.focus(); return; }
      button.disabled = true;
      status.textContent = "Einen Moment …";
      const body = new FormData();
      body.append("EMAIL", value);
      body.append("email_address_check", "");
      body.append("locale", "de");
      try {
        await fetch(brevoFormURL, { method: "POST", body, credentials: "omit", referrerPolicy: "no-referrer", headers: { Accept: "application/json" } });
      } catch { /* Liste ist ein Extra: der Plan kommt trotzdem */ }
      answers.email = value;
      try { sessionStorage.setItem("demenzCoachEmail", value); } catch { /* */ }
      track("quiz_email");
      go(after("email"), { replace: true });
    };
    button.addEventListener("click", send);
    input.addEventListener("keydown", (event) => { if (event.key === "Enter") send(); });
    const privacy = el("a", { href: "/datenschutz.html#e-mail-liste", text: "Datenschutz" });
    return [
      el("h1", { text: "Dein Plan ist fertig. Wohin sollen wir ihn schicken?" }),
      el("p", { class: "start-lead", text: "Du bekommst die Liste mit Sätzen zum Ausdrucken und ab und zu einen neuen Satz per E-Mail." }),
      el("label", { for: "email", class: "sr-only", text: "E-Mail" }),
      input,
      button,
      status,
      el("p", { class: "start-small" }, ["Wir schicken dir zuerst eine E-Mail zum Bestätigen. Abmelden jederzeit mit einem Klick. ", privacy, "."]),
      el("button", { type: "button", class: "abo-link-button", text: "Ohne E-Mail weiter", onclick: () => { track("quiz_email_skip"); go(after("email"), { replace: true }); } })
    ];
  }

  // ---- Ergebnis mit Zeitstrahl (wie Noom: Prognose mit Datum, hier ehrlich: Momente, für die du Sätze hast) --
  function resultScreen() {
    if (!completed) { completed = true; track("quiz_complete", "Lead"); }
    const short = (date) => new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "short" }).format(date).replace(".", "");
    const points = [[1, "Heute"], [7, short(inDays(7))], [10, short(inDays(28))], [18, short(inDays(84))]];
    const width = 320;
    const height = 170;
    const x = (index) => 30 + index * ((width - 60) / (points.length - 1));
    const y = (count) => height - 30 - (count / 18) * (height - 60);
    const line = points.map(([count], index) => `${index ? "L" : "M"}${x(index).toFixed(1)} ${y(count).toFixed(1)}`).join(" ");
    const dots = points.map(([count], index) => `<circle cx="${x(index).toFixed(1)}" cy="${y(count).toFixed(1)}" r="5" fill="#47408c"/>`).join("");
    const labels = points.map(([count, label], index) => `<text x="${x(index).toFixed(1)}" y="${height - 8}" text-anchor="middle" font-size="12" fill="#55525e">${label}</text>`
      + `<text x="${x(index).toFixed(1)}" y="${(y(count) - 12).toFixed(1)}" text-anchor="middle" font-size="13" font-weight="700" fill="#2e2870">${count}</text>`).join("");
    const chart = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Momente, für die du Sätze hast: heute 1, nach 7 Tagen 7, nach 4 Wochen 10, nach 12 Wochen 18">`
      + `<path d="${line} L${x(points.length - 1).toFixed(1)} ${height - 30} L${x(0).toFixed(1)} ${height - 30} Z" fill="#ece9f7"/>`
      + `<path d="${line}" fill="none" stroke="#47408c" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${dots}${labels}</svg>`;
    return [
      el("h1", { text: forWho() ? `Dein Plan für ${forWho()} ist fertig` : "Dein Plan ist fertig" }),
      el("p", { class: "start-lead", text: `Bis ${dateText(inDays(7))} kennst du ruhige Sätze für die 7 häufigsten Momente, angefangen mit „${bare(chosen().quote)}“.` }),
      el("div", { class: "start-card start-chart" }, [
        el("p", { class: "start-small", text: "Momente, für die du passende Sätze hast" }),
        el("div", { html: chart })
      ]),
      el("p", { class: "start-small", text: "So ist der Plan aufgebaut: 7 Momente in der ersten Woche, danach jede Woche einer mehr. Allgemeine Hinweise ohne Gewähr." }),
      el("button", { type: "button", class: "abo-button", text: "Weiter", onclick: () => go(after("result")) })
    ];
  }

  // ---- Angebotsseite 1:1 nach BetterMe, Liven und Noom (lange Seite) --------------------------------
  // Oben eine feste Leiste mit Rabatt-Uhr und Knopf, Vorher/Nachher mit Zeichnungen, deine Angaben als Schilder,
  // Rabatt-Box, Tarife mit Preis pro Tag, Knopf, sicher bezahlen, was du bekommst, Probezeit, FAQ, Tarife noch einmal.
  // Alles ehrlich: keine erfundenen Bewertungen, Nutzerzahlen oder Garantien, keine Uhr und keine Knappheitsbehauptung.
  function planScreen() {
    const s = chosen();
    if (offer.offers?.intro && deals && !dealAsked) {
      dealAsked = true;
      deals.start("intro").then((started) => { if (started && current === "plan") render("plan"); });
    }
    const deal = offer.offers ? deals?.current() : null;
    const firstYear = deal ? deal.firstYear : offer.yearly;
    const perDay = (cents, days) => euro(Math.round(cents / days));
    const yearlyText = deal ? `${euro(firstYear)} im ersten Jahr, danach ${euro(offer.yearly)} pro Jahr` : `${euro(offer.yearly)} pro Jahr`;
    // Preise immer mit Hinweis auf die Umsatzsteuer (PAngV § 6 Abs. 1 Nr. 1).
    const priceText = (key) => `${key === "yearly" ? yearlyText : `${euro(offer.monthly)} pro Monat`} inkl. MwSt.`;
    // Nur ein belegbarer Vergleich (Jahrespreis gegenüber 12 Monatszahlungen), keine unbelegte Spitzenstellung wie „Beliebteste Wahl“.
    const saving = Math.floor((1 - offer.yearly / (offer.monthly * 12)) * 20) * 5;
    const name = forWho();

    // Tarife wie BetterMe: Band mit der Ersparnis, Auswahlkreis, alter Preis durchgestrichen, Preis pro Tag als Schild.
    const tables = [];
    const select = (key) => {
      plan = key;
      for (const table of tables) for (const card of table.querySelectorAll("[data-plan]")) card.setAttribute("aria-checked", String(card.dataset.plan === key));
      for (const node of document.querySelectorAll("[data-start-price]")) node.textContent = `Dein Abo beginnt: ${priceText(plan)}. Vorher online kündbar.`;
      for (const node of document.querySelectorAll("[data-start-fine]")) node.textContent = fineText();
    };
    const tag = (cents, days, was) => el("span", { class: "start-tag" }, [
      was ? el("s", { text: perDay(was, days) }) : null,
      el("strong", { text: perDay(cents, days) }),
      el("span", { text: "pro Tag" })
    ]);
    const table = () => {
      const yearly = el("button", { type: "button", class: "start-tier", role: "radio", "data-plan": "yearly", "aria-checked": String(plan === "yearly"), onclick: () => select("yearly") }, [
        saving >= 10 ? el("span", { class: "start-ribbon", text: `Spare ${saving} %` }) : null,
        el("span", { class: "start-tier-body" }, [
          el("span", { class: "abo-radio", "aria-hidden": "true" }),
          el("span", { class: "start-tier-text" }, [
            el("strong", { text: "Jahresplan" }),
            deal ? el("span", {}, [el("s", { text: euro(offer.yearly) }), ` ${euro(firstYear)} im 1. Jahr`]) : el("span", { text: `${euro(offer.yearly)} pro Jahr` })
          ]),
          tag(firstYear, 365, deal ? offer.yearly : null)
        ])
      ]);
      const monthly = el("button", { type: "button", class: "start-tier", role: "radio", "data-plan": "monthly", "aria-checked": String(plan === "monthly"), onclick: () => select("monthly") }, [
        el("span", { class: "start-tier-body" }, [
          el("span", { class: "abo-radio", "aria-hidden": "true" }),
          el("span", { class: "start-tier-text" }, [el("strong", { text: "Monatsplan" }), el("span", { text: `${euro(offer.monthly)} pro Monat` })]),
          tag(offer.monthly, 30)
        ])
      ]);
      const group = el("div", { role: "radiogroup", "aria-label": "Tarif", class: "start-tiers" }, [yearly, monthly]);
      tables.push(group);
      return el("div", {}, [group, el("p", { class: "start-small start-center", text: "Alle Preise inklusive gesetzlicher Umsatzsteuer (MwSt.)." })]);
    };
    const cta = () => el("button", { type: "button", class: "abo-button start-cta", text: "Meinen Plan holen", onclick: checkout });
    const fineText = () => (offer.trialDays > 0
      ? `${offer.trialDays} Tage kostenlos, heute zahlst du 0,00 €. Danach ${priceText(plan)}, bis du kündigst. Vorher online kündbar.`
      : `Du zahlst ${priceText(plan)}, bis du kündigst. Online kündbar.`);
    const fine = () => el("p", { class: "start-small start-fine", "data-start-fine": "", text: fineText() });
    const safe = () => el("p", { class: "start-safe" }, [el("span", { html: icons.lock }), el("span", { text: "Sicher bezahlen über Stripe: Apple Pay, Google Pay oder Karte" })]);
    const scrollToPlans = () => document.querySelector(".start-tiers")?.scrollIntoView({ behavior: "smooth", block: "center" });

    // Vorher/Nachher wie Liven/BetterMe, mit unseren Zeichnungen und ehrlichen Stufen.
    const level = (filled) => el("span", { class: "start-level", "aria-hidden": "true" }, [1, 2, 3].map((index) => el("i", { class: index <= filled ? "on" : "" })));
    const side = (title, image, rows, good) => el("div", { class: `start-side${good ? " start-side-good" : ""}` }, [
      el("p", { class: "start-side-title", text: title }),
      el("img", { src: `../assets/zeichnungen/${image}`, alt: "", width: "260", height: "240", loading: "eager" }),
      ...rows.map(([label, value, filled]) => el("div", { class: "start-side-row" }, [el("span", { text: label }), el("strong", { text: value }), level(filled)]))
    ]);
    const compare = el("div", { class: "start-compare" }, [
      side("Jetzt", "worte-fehlen.webp", [["Passende Worte", "fehlen oft", 1], ["Sicherheit", "gering", 1]]),
      side("Mit deinem Plan", "v-umarmung.webp", [["Passende Worte", "parat", 3], ["Sicherheit", "wächst", 3]], true)
    ]);
    const tags = [
      ["Am schwersten", `„${s.quote}“`],
      answers.goal ? ["Dein Ziel", answers.goal.label] : null,
      answers.dayTime ? ["Wann", answers.dayTime.label] : null,
      answers.minutes ? ["Zeit", answers.minutes.label] : null
    ].filter(Boolean);

    const gets = ["Jeden Tag ein Moment mit Sätzen zum Sagen", "Unbegrenzt eigene Sätze übersetzen lassen", "Jede Woche ein neuer Moment, auch per E-Mail",
      "Blatt für Helfer zum Ausdrucken", "In der iPhone-App und hier im Web"];
    if (answers.burden?.key === "kraft") gets.splice(3, 0, "Kleine Hilfen für dich selbst");
    const faq = [
      ["Was kostet es nach der Probezeit?", deal
        ? `Jahresplan: ${euro(firstYear)} im ersten Jahr, danach ${euro(offer.yearly)} im Jahr. Monatsplan: ${euro(offer.monthly)} im Monat. In den ${offer.trialDays} Tagen zahlst du nichts.`
        : `${euro(offer.yearly)} im Jahr oder ${euro(offer.monthly)} im Monat, je nach Wahl. In den ${offer.trialDays} Tagen zahlst du nichts.`],
      ["Wie kündige ich?", "Online über „Verträge hier kündigen“ unten auf jeder Seite, ohne Anmeldung. Kündigst du in der Probezeit, zahlst du nichts."],
      ["Gilt das auch in der App?", "Ja. Du meldest dich in der iPhone-App mit demselben Konto an, dann ist alles freigeschaltet."],
      ["Ist das eine medizinische Beratung?", "Nein. Demenz Coach hilft bei Worten und Alltag. Es ersetzt keinen ärztlichen Rat. Im Notfall 112."],
      ["Was passiert mit meinen Antworten?", "Sie bleiben auf deinem Gerät. Wir senden sie nicht und speichern sie nicht."]
    ];

    return [
      el("div", { class: "start-bar" }, [
        el("p", { class: "start-bar-text" }, deal
          ? ["Willkommenspreis für das erste Jahr"]
          : [name ? `Plan für ${name} ist bereit` : "Dein Plan ist bereit"]),
        el("button", { type: "button", class: "start-bar-button", text: "Plan holen", onclick: scrollToPlans })
      ]),
      compare,
      el("p", { class: "start-small start-center", text: "Beispielhafte Darstellung, kein Versprechen." }),
      el("h1", { class: "start-center", text: name ? `Dein Plan für ${name} ist fertig` : "Dein Plan ist fertig" }),
      el("ul", { class: "start-tags", role: "list" }, tags.map(([term, value]) => el("li", {}, [el("span", { text: term }), el("strong", { text: value })]))),
      deal ? el("div", { class: "start-promo" }, [
        el("p", { class: "start-promo-text" }, [el("strong", { text: "Willkommenspreis" }),
          el("span", { text: `Erstes Jahr ${euro(firstYear)}, danach ${euro(offer.yearly)} im Jahr` })])
      ]) : null,
      el("h2", { class: "start-section start-center", text: "Wähle deinen Plan" }),
      table(),
      cta(),
      fine(),
      safe(),
      el("h2", { class: "start-section start-center", text: "Das bekommst du" }),
      el("img", { class: "start-art", src: "../assets/zeichnungen/v-tanzen.webp", width: "600", height: "650", alt: "" }),
      el("ul", { class: "start-checks", role: "list" }, gets.map((text) => el("li", { text }))),
      el("div", { class: "start-card" }, [
        el("h2", { text: `Wenn ${who()} sagt: „${s.quote}“` }),
        el("p", { class: "start-small", text: "Probier heute einen dieser Sätze:" }),
        el("ul", { class: "start-say", role: "list" }, s.say.map((line) => el("li", { text: `„${line}“` })))
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
      el("h2", { class: "start-section start-center", text: name ? `Hol dir den Plan für ${name}` : "Hol dir deinen Plan" }),
      table(),
      cta(),
      fine(),
      safe(),
      el("p", { class: "start-small start-legal" }, [
        `Nach ${offer.trialDays} Tagen beginnt das Abo und läuft zum gewählten Preis weiter, bis du kündigst. Der Jahresplan hat eine Laufzeit von einem Jahr und ist danach mit einer Frist von einem Monat kündbar, der Monatsplan jederzeit zum Monatsende.${deal ? " Der Sonderpreis gilt für das erste Jahr des Jahresplans." : ""} Kündigen geht online ohne Anmeldung. Es gelten die `,
        el("a", { href: "/nutzungsbedingungen.html", text: "Nutzungsbedingungen" }), " und die ",
        el("a", { href: "/abo/widerruf.html", text: "Widerrufsbelehrung" }),
        ". Allgemeine Kommunikations- und Alltagshilfe, kein Medizinprodukt."
      ])
    ];
  }

  function checkout() {
    track("quiz_checkout", "InitiateCheckout");
    // Für „Mein Plan“ nach dem Kauf: bleibt in diesem Browser, wird nie gesendet.
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        name: forWho(), relation: answers.relation?.key ?? null, situation: chosen().key, burden: answers.burden?.key ?? null,
        dayTime: answers.dayTime?.key ?? null, goal: answers.goal?.key ?? null, savedAt: new Date().toISOString().slice(0, 10)
      }));
    } catch { /* privater Modus: Plan startet dann mit dem häufigsten Moment */ }
    const campaign = (params.get("utm_campaign") || "").toLowerCase().replace(/[^a-z0-9_-]/gu, "").slice(0, 60);
    location.href = `../abo/?plan=${plan}&src=quiz_${source}${preset ? `_${preset.key}` : ""}${campaign ? `&c=${campaign}` : ""}&weiter=1`;
  }

  // ---- Navigation (Zurück-Taste des Handys funktioniert über die Browser-Historie) ----------------
  let current = null;
  let completed = false;
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
    $("back").style.visibility = ["relation", "building", "email"].includes(name) ? "hidden" : "visible";
    $("progress").hidden = done;
    $("count").hidden = done;
    $("footer").hidden = name !== "relation" && name !== "plan";
    window.scrollTo({ top: 0 });
    if (name !== "plan") track(`quiz_${name}`);
  }
  function go(name, { replace = false } = {}) {
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
      const started = await deals.start("exit");
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
    if (current === "plan" && offer.offers?.exit && deals && !deals.exitShown() && event.state?.screen !== "plan") {
      history.pushState({ screen: "plan" }, "", location.href);
      showExitOffer();
      return;
    }
    let name = event.state?.screen || "relation";
    if (!flow.includes(name)) name = "relation";
    if (["building", "email"].includes(name)) name = "how";
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
      if (current === "plan") render("plan");
    }).catch(() => {});
  }

  history.replaceState({ screen: "relation" }, "", location.href);
  render("relation");
  track("quiz_start");
})();
