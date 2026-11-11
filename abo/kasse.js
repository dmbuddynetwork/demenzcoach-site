// Der Fragebogen öffnet dieselbe gehostete Stripe-Kasse wie /abo/.
// Ein Gastkonto erhält vor der Weiterleitung eine stabile UID für Stripe/Adapty.
import { openHostedCheckout } from "./hosted-checkout.js";
const config = window.DEMENZ_ABO_CONFIG || {};
const firebaseVersion = "12.16.0";
let firebase = null;
let auth = null;
let publicConfig = null;
let sheet = null;

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === "text") node.textContent = value;
    else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value);
  }
  for (const child of children) node.append(child);
  return node;
}

async function api(path, { method = "GET", body, token } = {}) {
  const headers = {};
  if (body) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${config.endpoint}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || `HTTP ${response.status}`);
    error.code = data.code;
    throw error;
  }
  return data;
}

async function signedInUser() {
  if (!auth) {
    const [{ initializeApp }, authModule] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${firebaseVersion}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${firebaseVersion}/firebase-auth.js`)
    ]);
    firebase = authModule;
    auth = firebase.getAuth(initializeApp(config.firebase));
    auth.languageCode = "de";
    await new Promise((resolve) => { const stop = firebase.onAuthStateChanged(auth, () => { stop(); resolve(); }); });
  }
  // Wie Noom und BetterMe: erst bezahlen, Konto danach. Das Gast-Konto trägt den Kauf, die Nummer kommt auf der Danke-Seite dazu.
  return auth.currentUser ?? (await firebase.signInAnonymously(auth)).user;
}

function close() {
  if (!sheet) return;
  const previous = sheet;
  sheet = null;
  previous.node.remove();
  clearTimeout(previous.timer);
  document.removeEventListener("keydown", previous.onKey);
  document.body.classList.remove("start-noscroll");
  previous.onClose?.();
  if (previous.trigger?.isConnected) previous.trigger.focus();
}

// open({ plan, email, offer, source, campaign, onClose, onOfferExpired, track })
export async function open(options) {
  if (sheet) return; // Ignore double taps while a session is being prepared.
  const trigger = document.activeElement;
  const title = el("h2", { id: "kasse-title", tabindex: "-1", text: "Deinen Plan erhalten" });
  const status = el("p", { class: "kasse-loading", role: "status", text: "Deine sichere Zahlungsseite wird geöffnet …" });
  const error = el("p", { class: "abo-error", role: "alert", hidden: "" });
  const retry = el("button", { class: "abo-button", type: "button", text: "Erneut versuchen", hidden: "" });
  const closeButton = el("button", { class: "kasse-close", type: "button", "aria-label": "Schließen", text: "×", onclick: close });
  const card = el("div", { class: "kasse-card", role: "dialog", "aria-modal": "true", "aria-labelledby": "kasse-title" }, [closeButton, title, status, error, retry]);
  const node = el("div", { class: "kasse", onclick: (event) => { if (event.target === node) close(); } }, [card]);
  const onKey = (event) => {
    if (event.key === "Escape") close();
    if (event.key === "Tab") {
      const buttons = [...card.querySelectorAll("button:not([disabled]), a[href]")].filter((item) => !item.hidden);
      const first = buttons[0], last = buttons.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === title)) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === title)) {
        event.preventDefault(); first.focus();
      }
    }
  };
  const attempt = { node, onKey, trigger, onClose: options.onClose, timer: null };
  sheet = attempt;
  document.addEventListener("keydown", onKey);
  document.body.append(node);
  document.body.classList.add("start-noscroll");
  title.focus();
  attempt.timer = setTimeout(() => {
    if (sheet === attempt) status.textContent = "Das Laden dauert länger. Du kannst zurückgehen und es erneut versuchen.";
  }, 15_000);
  const current = () => sheet === attempt;
  retry.addEventListener("click", () => {
    if (!current()) return;
    attempt.onClose = null; // Internal retry must not trigger the funnel browser-back callback.
    close(); open(options);
  });
  try {
    const [loadedConfig, user] = await Promise.all([publicConfig ? Promise.resolve(publicConfig) : api("/config"), signedInUser()]);
    if (!current()) return;
    publicConfig = loadedConfig;
    await window.DemenzTeller?.ready;
    if (!current()) return;
    const token = await user.getIdToken();
    if (!current()) return;
    const session = await api("/session", {
      method: "POST", token,
      body: { checkoutUI: "hosted", plan: options.plan, termsVersion: publicConfig.textVersions?.terms,
        source: options.source, campaign: options.campaign, ...window.DemenzTeller?.attribution(),
        ...(options.offer ? { offer: options.offer } : {}), ...(options.email ? { email: options.email } : {}) }
    });
    if (!current()) return;
    clearTimeout(attempt.timer);
    try { options.track?.("checkout_redirect"); } catch { /* Analytics must not block checkout. */ }
    openHostedCheckout(session.url);
  } catch (problem) {
    if (!current()) return;
    clearTimeout(attempt.timer);
    status.hidden = true;
    if (problem.code === "already_subscribed") {
      error.replaceWith(el("p", { text: "Du hast bereits ein Abo. Prüfe deinen Zahlungsstatus in der Abo-Verwaltung." }));
      retry.replaceWith(el("a", { class: "abo-button", href: "/abo/", text: "Abo verwalten" }));
      return;
    }
    if (problem.code === "offer_expired" || problem.code === "invalid_offer") {
      close(); options.onOfferExpired?.(); return;
    }
    error.textContent = problem.code === "email_required" ? "Bitte geh zurück und gib deine E-Mail-Adresse ein."
      : problem.code === "terms_outdated" ? "Bitte lade die Seite neu."
      : "Die Zahlungsseite konnte nicht geöffnet werden. Bitte versuch es erneut.";
    error.hidden = false;
    retry.hidden = false;
  }
}
export const isOpen = () => Boolean(sheet);
window.DemenzKasse = Object.freeze({ open, close, isOpen });
