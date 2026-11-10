// Persönliche Hilfe für Web-Abonnenten: gewählte Situation zuerst, weitere Hilfen und ergänzender Wochenplan,
// Liste zum Ausdrucken, App-Hinweis. Freigabe über GET /entitlement mit dem Firebase-Konto (dasselbe wie die App).
// ?vorschau=1 zeigt den Plan ohne Anmeldung (die Inhalte sind ohnehin öffentlich, nur zur Ansicht).
import { subscriberState } from "./konto.js";

const config = window.DEMENZ_ABO_CONFIG;
const data = window.DEMENZ_PLAN_DATA;
const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);

const svg = (paths) => `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
const arrow = svg('<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>');

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === "text") node.textContent = value;
    else node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) if (child) node.append(child);
  return node;
}
function show(id) {
  for (const name of ["loading", "signed-out", "no-subscription", "plan"]) $(name).hidden = name !== id;
}

function savedPlan() {
  try { return JSON.parse(localStorage.getItem(data.storageKey) || "null") || {}; } catch { return {}; }
}

function card(moment) {
  const children = [
    el("p", { class: "plan-label", text: "Was dahintersteckt" }),
    el("p", { text: moment.meaning ?? moment.text }),
    el("p", { class: "plan-label", text: "Das kannst du sagen" }),
    el("ul", { class: "start-say", role: "list" }, moment.say.map((line) => el("li", { text: `„${line}“` }))),
    el("p", { class: "plan-label", text: "Das kannst du tun" }),
    el("p", { text: moment.tip })
  ];
  if (moment.href) children.push(el("p", { class: "start-small" }, el("a", { href: moment.href, text: `Mehr zu „${moment.quote.replace(/[.!?]+$/u, "")}“` })));
  return el("div", { class: "start-card" }, children);
}

const dayMs = 24 * 60 * 60 * 1000;
let entitlementStart = "";
// Woche des Plans: ab dem ersten Öffnen in diesem Browser (nur lokal gespeichert). ?woche=3 zeigt Woche 3 zur Ansicht.
function planWeek(saved) {
  const preview = Number.parseInt(params.get("woche") || "", 10);
  if (Number.isInteger(preview) && preview >= 1 && preview <= 99) return preview;
  // Mit Konto zählt der Abo-Beginn (gleich wie die Wochen-E-Mail), sonst das erste Öffnen in diesem Browser.
  let start = Date.parse(entitlementStart || saved.start || "");
  if (!Number.isFinite(start)) {
    start = Date.now();
    try { localStorage.setItem(data.storageKey, JSON.stringify({ ...saved, start: new Date(start).toISOString() })); } catch { /* privates Fenster */ }
  }
  return Math.max(1, Math.floor((Date.now() - start) / (7 * dayMs)) + 1);
}
const weekMoment = (week) => data.weeks[(week - 2) % data.weeks.length];

function dayDetails(label, title, body) {
  return el("details", { class: "plan-day" }, [
    el("summary", {}, [el("span", { class: "plan-day-no", text: label }), el("span", { text: title })]),
    body
  ]);
}

function selfCareCard() {
  const self = data.selfCare;
  return el("div", { class: "start-card" }, [
    el("p", { text: self.text }),
    el("p", { class: "plan-label", text: "Das kannst du sagen" }),
    el("ul", { class: "start-say", role: "list" }, self.say.map((line) => el("li", { text: `„${line}“` }))),
    el("p", { class: "plan-label", text: "Gut zu wissen" }),
    el("p", { text: self.tip })
  ]);
}

function renderPlan() {
  const saved = savedPlan();
  const directContext = window.DemenzSituationContext?.resolve(saved.directSituation) || null;
  const who = String(saved.name || "").slice(0, 30);
  const person = who || "sie oder er";
  const moments = data.situations.filter((item) => item.say);
  const selected = directContext ? moments.find(item => item.key === directContext.planKey) : moments.find(item => item.key === saved.situation);
  const first = selected || moments[0];
  const firstWeek = [first, ...moments.filter((item) => item !== first)].slice(0, 6);
  const week = planWeek(saved);

  // Die bestehende Eingabe bleibt auf der Startseite. Kein neuer Speicher und keine
  // Übertragung freier Angaben per URL; der Link führt direkt zum vorhandenen Feld.
  const nodes = [
    el("h1", { text: "Deine persönliche Hilfe" }),
    el("p", { class: "start-lead", text: who && !directContext ? `Wobei brauchst du im Alltag mit ${who} Unterstützung?` : "Wobei brauchst du heute Unterstützung?" }),
    el("a", { class: "abo-button", href: "/de/#translator-input", text: "Eigene Situation beschreiben" }),
    el("h2", { class: "start-section", text: directContext || selected ? "Deine gewählte Situation" : "Ein Beispiel für den Anfang" }),
    el("h3", { class: "plan-today", text: `„${directContext?.title || first.quote}“` }),
    directContext && !selected ? el("div", { class: "start-card" }, [
      el("p", { text: "Öffne die vorhandene Hilfe zu dieser Situation mit Satzideen und nächsten Schritten." }),
      el("a", { class: "abo-button abo-button-light", href: directContext.href, text: "Hilfe zu dieser Situation öffnen" })
    ]) : card(first)
  ];
  const weekly = [];
  if (week === 1) {
    weekly.push(
      el("p", { class: "start-lead", text: "Jeden Tag ein Moment, mit Sätzen zum Sagen und einem kleinen Schritt. Fang mit heute an." }),
      el("h2", { class: "plan-today", text: `Heute: Wenn ${person} sagt „${first.quote}“` }),
      card(first),
      el("h2", { class: "start-section", text: "Weitere Situationen in dieser Woche" })
    );
    firstWeek.slice(1).forEach((moment, index) => weekly.push(dayDetails(`Tag ${index + 2}`, `„${moment.quote}“`, card(moment))));
    weekly.push(dayDetails("Tag 7", data.selfCare.title, selfCareCard()));
    weekly.push(el("p", { class: "start-small abo-muted", text: "Ab nächster Woche kommt jede Woche ein neuer Moment dazu." }));
  } else {
    const current = weekMoment(week);
    weekly.push(
      el("p", { class: "start-lead", text: "Jede Woche ein neuer Moment, mit Sätzen zum Sagen und einem kleinen Schritt." }),
      el("h2", { class: "plan-today", text: `Woche ${week}: Wenn ${person} sagt „${current.quote}“` }),
      card(current),
      el("h2", { class: "start-section", text: "Deine bisherigen Momente" })
    );
    for (let earlier = week - 1; earlier >= 2 && earlier > week - 8; earlier -= 1) {
      const moment = weekMoment(earlier);
      weekly.push(dayDetails(`Woche ${earlier}`, `„${moment.quote}“`, card(moment)));
    }
    firstWeek.forEach((moment) => weekly.push(dayDetails("Woche 1", `„${moment.quote}“`, card(moment))));
    weekly.push(dayDetails("Woche 1", data.selfCare.title, selfCareCard()));
  }

  const row = (href, text) => {
    const link = el("a", { href }, el("span", { text }));
    link.insertAdjacentHTML("beforeend", arrow);
    return el("li", {}, link);
  };
  nodes.push(
    el("h2", { class: "start-section", text: "Weitere Hilfen für euren Alltag" }),
    el("ul", { class: "plan-rows", role: "list" }, [
      row("ueber-mama.html", aboutRow(saved)),
      row("/de/#e-tiles-more-title", "Weitere Alltagssituationen ansehen"),
      row("/demenz-uebersetzer/saetze-zum-ausdrucken.pdf", "Liste zum Ausdrucken")
    ]),
    el("details", { class: "plan-weekly" }, [
      el("summary", { text: "Wochenplan als zusätzliche Hilfe" }),
      el("div", { class: "plan-weekly-body" }, weekly)
    ]),
    el("p", { class: "start-small abo-muted", text: "Dein Name und die Auswahl aus dem Fragebogen bleiben in diesem Browser. Sie werden nicht mit der App synchronisiert." }),
    el("div", { class: "start-card" }, [
      el("p", {}, el("strong", { text: "Auf dem iPhone" })),
      el("p", { class: "abo-muted", text: "Lade Demenz Coach und melde dich in den Einstellungen mit demselben Konto an. Dein Abo gilt dort auch." }),
      el("a", { class: "abo-button abo-button-light", href: config.appStoreURL, text: "Demenz Coach laden" })
    ]),
    el("p", { class: "start-small" }, el("a", { href: "./", text: "Abo verwalten" }))
  );
  $("plan").replaceChildren(...nodes);
  show("plan");
}

// „Über Mama“, „Über Papa“ oder mit Namen; sonst neutral.
function aboutRow(saved) {
  const relation = data.relations.find((item) => item.key === saved.relation);
  const name = String(saved.name || "").slice(0, 30) || relation?.call || "";
  return name ? `Blatt „Über ${name}“ ausfüllen` : "Blatt für Helfer ausfüllen";
}

async function start() {
  if (params.get("vorschau") === "1") return renderPlan();
  const state = await subscriberState(config, (entitlement) => { entitlementStart = entitlement.startedAt || ""; });
  if (state === "active") return renderPlan();
  show(state === "no-subscription" ? "no-subscription" : "signed-out");
  if (state === "error") {
    $("error").textContent = "Deine Hilfe lädt gerade nicht. Bitte versuch es gleich noch einmal.";
    $("error").hidden = false;
  }
}
start();
