// „Über Mama“-Blatt für Web-Abonnenten (Daniels Wahl 8. Nov): Gewohnheiten, Vorlieben und was beruhigt,
// zum Ausdrucken für Nachbarn, Tagespflege oder Geschwister. Nichtmedizinisch: keine Felder für Krankheiten
// oder Medikamente. Alles bleibt in diesem Browser (localStorage), nichts wird gesendet.
// ?vorschau=1 zeigt das Blatt ohne Anmeldung (nur zur Ansicht).
import { subscriberState } from "./konto.js";

const config = window.DEMENZ_ABO_CONFIG;
const data = window.DEMENZ_PLAN_DATA;
const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const storageKey = "demenzCoachUeber";
const maxLength = 600;

export const fields = [
  { key: "name", label: "Name oder Anrede", hint: "So heißt sie oder er gern, zum Beispiel „Mama“ oder „Frau Berg“.", single: true },
  { key: "menschen", label: "Wichtige Menschen", hint: "Zum Beispiel: Tochter Anna, Enkel Max, Nachbarin Frau Kurz" },
  { key: "leben", label: "Aus dem Leben", hint: "Beruf, Heimat, eine schöne Zeit, über die sie oder er gern erzählt" },
  { key: "mag", label: "Mag gern", hint: "Essen, Getränke, Musik, Beschäftigung" },
  { key: "beruhigt", label: "Das beruhigt", hint: "Sätze, Dinge oder kleine Rituale, die helfen" },
  { key: "unruhig", label: "Das macht unruhig", hint: "Was besser vermieden wird" },
  { key: "tag", label: "Ein normaler Tag", hint: "Aufstehen, Essen, Ruhezeit, Schlafen" },
  { key: "saetze", label: "Sätze, die oft kommen, und was hilft", hint: "Zum Beispiel: „Ich will nach Hause.“ Dann hilft: „Erzähl mir, wie es da ist.“" },
  { key: "kontakt", label: "Bei Fragen bitte anrufen", hint: "Name und Telefonnummer", single: true }
];

function read() {
  try { const value = JSON.parse(localStorage.getItem(storageKey) || "null"); return value && typeof value === "object" ? value : {}; } catch { return {}; }
}
function save(values) {
  try { localStorage.setItem(storageKey, JSON.stringify(values)); } catch { /* privates Fenster */ }
}
function plan() {
  try { return JSON.parse(localStorage.getItem(data.storageKey) || "null") || {}; } catch { return {}; }
}

// Erste Werte aus dem Fragebogen: Name bzw. Anrede und der gewählte Moment mit dem ersten Satz.
function initialValues() {
  const stored = read();
  if (Object.keys(stored).length) return stored;
  const saved = plan();
  const relation = data.relations.find((item) => item.key === saved.relation);
  const moment = data.situations.find((item) => item.key === saved.situation && item.say);
  return {
    name: String(saved.name || relation?.call || "").slice(0, 60),
    saetze: moment ? `„${moment.quote}“ Dann hilft: „${moment.say[0]}“` : ""
  };
}

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
  for (const name of ["loading", "signed-out", "no-subscription", "form"]) $(name).hidden = name !== id;
}

const titleFor = (values) => (values.name ? `Über ${values.name}` : "Blatt für Helfer");

function renderSheet(values) {
  const parts = [el("h1", { text: titleFor(values) })];
  for (const field of fields.slice(1)) {
    const text = String(values[field.key] || "").trim();
    if (text) parts.push(el("section", {}, [el("h2", { text: field.label }), el("p", { text })]));
  }
  parts.push(el("p", { class: "ueber-sheet-foot", text: "Erstellt mit Demenz Coach · dementiacoachapp.com" }));
  $("sheet").replaceChildren(...parts);
}

function renderForm() {
  const values = initialValues();
  const inputs = fields.map((field) => {
    const id = `feld-${field.key}`;
    const input = field.single
      ? el("input", { id, type: "text", maxlength: String(maxLength), "aria-describedby": `${id}-hint` })
      : el("textarea", { id, rows: "3", maxlength: String(maxLength), "aria-describedby": `${id}-hint` });
    input.value = String(values[field.key] || "");
    input.addEventListener("input", () => {
      values[field.key] = input.value.slice(0, maxLength);
      save(values);
      $("form-title").textContent = titleFor(values);
      renderSheet(values);
    });
    return el("div", { class: "ueber-field" }, [
      el("label", { for: id, text: field.label }),
      el("p", { class: "ueber-field-hint", id: `${id}-hint`, text: field.hint }),
      input
    ]);
  });
  $("fields").replaceChildren(...inputs);
  $("form-title").textContent = titleFor(values);
  renderSheet(values);
  $("print").addEventListener("click", () => window.print());
  show("form");
}

async function start() {
  if (params.get("vorschau") === "1") return renderForm();
  const state = await subscriberState(config);
  if (state === "active") return renderForm();
  show(state === "no-subscription" ? "no-subscription" : "signed-out");
  if (state === "error") {
    $("error").textContent = "Die Seite lädt gerade nicht. Bitte versuch es gleich noch einmal.";
    $("error").hidden = false;
  }
}
if (typeof document !== "undefined") start();
